import bookingRepository from '../repositories/booking.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import payoutRepository from '../repositories/payout.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import userRepository from '../repositories/user.repository.js';
import cashfreePayoutAdapter from '../adapters/cashfree/cashfree-payout.adapter.js';
import notificationEvents from './notification-events.service.js';
import logger from '../utils/logger.js';
import {
    BadRequestError,
    NotFoundError,
    PayoutError,
} from '../utils/api-error.js';
import {
    CASHFREE_WEBHOOK_EVENTS,
    PAYOUT_MODES,
    PAYOUT_STATUS,
    PAYOUT_TRANSACTION_STATUS,
} from '../utils/constants.js';
import { serializePayout } from '../serializers/payout.serializer.js';

const NON_RETRYABLE_ERROR_CODES = new Set([
    'INSUFFICIENT_BALANCE',
    'INVALID_VPA',
    'INVALID_ACCOUNT',
    'IP_NOT_WHITELISTED',
    'INVALID_CREDENTIALS',
]);

const toObjectIdString = (value) => String(value?._id || value || '');
const getSettledBarberPayout = (payment) => (
    payment?.settlement?.barberPayout
    || payment?.settlement?.serviceAmount
    || 0
);

const generateTransferId = (barberId) => {
    // Cashfree requires transfer_id to be max 40 characters
    // Format: PO_<last12CharsOfBarberId>_<last10DigitsOfTimestamp>
    // Example: PO_940d358e7_7040473263 = 26 chars (well under 40 limit)
    const barberIdStr = String(barberId);
    const shortBarberId = barberIdStr.slice(-12);
    const shortTimestamp = Date.now().toString().slice(-10);
    return `PO_${shortBarberId}_${shortTimestamp}`;
};
const generateBeneficiaryId = (barberId) => `BARBER_${barberId}`;

const buildShopPayoutConfig = (shop, updates = {}) => ({
    ...(shop.payoutConfig || {}),
    ...updates,
});

const getShopAndBarber = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
        throw new NotFoundError('Shop');
    }

    const owner = await userRepository.findById(shop.ownerId);
    if (!owner) {
        throw new NotFoundError('Barber owner');
    }

    return {
        shop,
        barber: {
            _id: shop.ownerId,
            fullName: shop.accountHolderName || shop.ownerName || shop.shopName,
            phone: owner.phoneNumber,
            email: owner.email,
            upiId: shop.upiId,
            bankAccount: shop.payoutConfig?.bankAccount || null,
            ifsc: shop.payoutConfig?.ifsc || null,
        },
    };
};

const applyPayoutSuccess = async (payout, { utr, updatedAt }) => {
    const processedAt = updatedAt ? new Date(updatedAt) : new Date();

    await payoutRepository.updateById(payout._id, {
        status: PAYOUT_TRANSACTION_STATUS.SUCCESS,
        utr: utr || null,
        processedAt,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
        failureReason: null,
        errorCode: null,
    });

    await bookingRepository.updateManyByIds(payout.bookingIds, {
        payoutStatus: PAYOUT_STATUS.COMPLETED,
        payoutCompletedAt: processedAt,
        barberUtr: utr || null,
    });

    await paymentRepository.markSettledByIds(payout.paymentTransactionIds, processedAt);
    await notificationEvents.notifyPayoutStatus({
        payoutId: payout._id,
        barberId: payout.barberId,
        status: PAYOUT_TRANSACTION_STATUS.SUCCESS,
        amountInRupees: payout.amountInRupees,
    });
};

const applyPayoutFailure = async (payout, status, { failureReason, errorCode = null }) => {
    const bookingPayoutStatus = status === PAYOUT_TRANSACTION_STATUS.REVERSED
        ? PAYOUT_STATUS.REVERSED
        : PAYOUT_STATUS.FAILED;

    await payoutRepository.updateById(payout._id, {
        status,
        failureReason: failureReason || status,
        errorCode,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await bookingRepository.updateManyByIds(payout.bookingIds, {
        payoutStatus: bookingPayoutStatus,
        payoutCompletedAt: null,
        barberUtr: null,
    });

    if (
        status === PAYOUT_TRANSACTION_STATUS.REVERSED
        && Array.isArray(payout.paymentTransactionIds)
        && payout.paymentTransactionIds.length > 0
    ) {
        await paymentRepository.markUnsettledByIds(payout.paymentTransactionIds);
    }

    await notificationEvents.notifyPayoutStatus({
        payoutId: payout._id,
        barberId: payout.barberId,
        status,
        amountInRupees: payout.amountInRupees,
        failureReason: failureReason || status,
    });
};

const ensureRetryable = (error) => !NON_RETRYABLE_ERROR_CODES.has(error?.providerCode || error?.code);

async function ensureBeneficiary(shop, barber, beneficiaryId) {
    const existingBeneficiaryId = shop.payoutConfig?.beneficiaryId || beneficiaryId;
    const existing = await cashfreePayoutAdapter.getBeneficiary(existingBeneficiaryId);

    if (existing) {
        // Check if beneficiary details match current shop details
        const beneficiaryVpa = existing.beneficiary_instrument_details?.vpa;
        const beneficiaryBankAccount = existing.beneficiary_instrument_details?.bank_account_number;
        
        const vpaChanged = barber.upiId && beneficiaryVpa && barber.upiId !== beneficiaryVpa;
        const bankAccountChanged = barber.bankAccount && beneficiaryBankAccount && barber.bankAccount !== beneficiaryBankAccount;
        
        if (vpaChanged || bankAccountChanged) {
            // Payout details changed - remove old beneficiary and create new one
            logger.warn('[PayoutService] Beneficiary details mismatch, recreating', {
                shopId: shop._id,
                oldBeneficiaryId: existingBeneficiaryId,
                vpaChanged,
                bankAccountChanged,
                currentVpa: barber.upiId,
                beneficiaryVpa,
            });
            
            try {
                await cashfreePayoutAdapter.removeBeneficiary(existingBeneficiaryId);
                logger.info('[PayoutService] Old beneficiary removed', { beneficiaryId: existingBeneficiaryId });
            } catch (error) {
                if (error.statusCode !== 404) {
                    logger.error('[PayoutService] Failed to remove old beneficiary', {
                        beneficiaryId: existingBeneficiaryId,
                        error: error.message,
                    });
                }
            }
            
            // Create new beneficiary with updated details (fall through to creation logic below)
        } else {
            // Beneficiary details match - use existing
            if (shop.payoutConfig?.beneficiaryId !== existingBeneficiaryId) {
                await shopRepository.updateById(shop._id, {
                    payoutConfig: buildShopPayoutConfig(shop, {
                        beneficiaryId: existingBeneficiaryId,
                        beneficiaryCreatedAt: shop.payoutConfig?.beneficiaryCreatedAt || new Date(),
                        verifiedAt: new Date(),
                        verificationStatus: 'verified',
                    }),
                });
            }

            return existingBeneficiaryId;
        }
    }

    // Create new beneficiary (either doesn't exist or was removed due to mismatch)
    await cashfreePayoutAdapter.createBeneficiary({
        beneficiaryId,
        name: barber.fullName,
        phone: barber.phone,
        email: barber.email,
        vpa: barber.upiId,
        bankAccount: barber.bankAccount,
        ifsc: barber.ifsc,
    });

    await shopRepository.updateById(shop._id, {
        payoutConfig: buildShopPayoutConfig(shop, {
            beneficiaryId,
            beneficiaryCreatedAt: new Date(),
            verifiedAt: new Date(),
            verificationStatus: 'verified',
        }),
    });

    logger.info('[PayoutService] Beneficiary created/recreated', {
        shopId: shop._id,
        beneficiaryId,
        hasVpa: Boolean(barber.upiId),
        hasBankAccount: Boolean(barber.bankAccount),
    });

    return beneficiaryId;
}

export const triggerBarberPayout = async (barberId, bookingIds, totalPayoutInPaisa = null) => {
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        throw new BadRequestError('At least one booking is required for payout');
    }

    const bookings = await bookingRepository.findByIds(bookingIds);
    if (bookings.length !== bookingIds.length) {
        throw new NotFoundError('One or more bookings');
    }

    for (const booking of bookings) {
        if (booking.status !== 'completed') {
            throw new BadRequestError('All bookings must be completed before payout');
        }
        if (booking.paymentStatus !== 'success') {
            throw new BadRequestError('All bookings must have successful payments before payout');
        }
        if (![PAYOUT_STATUS.NOT_INITIATED, PAYOUT_STATUS.FAILED, PAYOUT_STATUS.REVERSED].includes(booking.payoutStatus)) {
            throw new BadRequestError('One or more bookings already has an active payout');
        }
    }

    const firstBooking = bookings[0];
    const { shop, barber } = await getShopAndBarber(firstBooking.shopId?._id || firstBooking.shopId);
    if (barberId && toObjectIdString(shop.ownerId) !== toObjectIdString(barberId)) {
        throw new BadRequestError('Bookings do not belong to the requested barber');
    }

    if (!barber.upiId && !(barber.bankAccount && barber.ifsc)) {
        throw new BadRequestError('Shop has no payout destination configured');
    }

    const paymentTransactions = await paymentRepository.findCompletedByBookingIds(bookingIds);
    if (paymentTransactions.length !== bookingIds.length) {
        throw new NotFoundError('Completed payment for one or more bookings');
    }

    const paymentMap = new Map(
        paymentTransactions.map((payment) => [toObjectIdString(payment.bookingId), payment]),
    );

    const computedTotalPayout = bookingIds.reduce((sum, bookingId) => {
        const payment = paymentMap.get(toObjectIdString(bookingId));
        return sum + getSettledBarberPayout(payment);
    }, 0);

    if (
        totalPayoutInPaisa
        && totalPayoutInPaisa > 0
        && computedTotalPayout > 0
        && totalPayoutInPaisa !== computedTotalPayout
    ) {
        throw new BadRequestError('Provided payout amount does not match settled payment amounts');
    }

    const payoutAmountInPaisa = computedTotalPayout;

    if (payoutAmountInPaisa <= 0) {
        throw new BadRequestError('Invalid payout amount');
    }

    const beneficiaryId = await ensureBeneficiary(
        shop,
        barber,
        shop.payoutConfig?.beneficiaryId || generateBeneficiaryId(shop.ownerId),
    );

    const transferId = generateTransferId(shop.ownerId);
    const amountInRupees = payoutAmountInPaisa / 100;
    const paymentTransactionIds = paymentTransactions.map((payment) => payment._id);

    const payoutTransaction = await payoutRepository.create({
        bookingIds,
        barberId: shop.ownerId,
        shopId: shop._id,
        paymentTransactionIds,
        transferId,
        beneficiaryId,
        amount: payoutAmountInPaisa,
        amountInRupees,
        transferMode: barber.upiId ? PAYOUT_MODES.UPI : PAYOUT_MODES.BANK,
        status: PAYOUT_TRANSACTION_STATUS.INITIATED,
        remarks: `EverCut EOD payout for ${bookingIds.length} booking(s)`,
    });

    await bookingRepository.updateManyByIds(bookingIds, {
        payoutTransactionId: payoutTransaction._id,
        payoutStatus: PAYOUT_STATUS.INITIATED,
    });

    try {
        const transferResponse = await cashfreePayoutAdapter.initiateTransfer({
            transferId,
            amountInRupees,
            beneficiaryId,
            transferMode: barber.upiId ? PAYOUT_MODES.UPI : PAYOUT_MODES.BANK,
            remarks: payoutTransaction.remarks,
        });

        await payoutRepository.updateById(payoutTransaction._id, {
            status: PAYOUT_TRANSACTION_STATUS.PENDING,
            gatewayTransferId: transferResponse.gatewayTransferId,
        });

        await bookingRepository.updateManyByIds(bookingIds, {
            payoutStatus: PAYOUT_STATUS.PENDING,
        });

        logger.info('[PayoutService] Aggregated payout initiated', {
            payoutId: payoutTransaction._id,
            barberId: toObjectIdString(shop.ownerId),
            bookingCount: bookingIds.length,
            amountInRupees,
            transferId,
        });

        const updatedPayout = await payoutRepository.updateById(payoutTransaction._id, {
            gatewayTransferId: transferResponse.gatewayTransferId,
        });
        return serializePayout(updatedPayout);
    } catch (error) {
        await payoutRepository.updateById(payoutTransaction._id, {
            status: PAYOUT_TRANSACTION_STATUS.FAILED,
            failureReason: error.message,
            errorCode: error.providerCode || error.code || null,
        });

        await bookingRepository.updateManyByIds(bookingIds, {
            payoutStatus: PAYOUT_STATUS.FAILED,
        });

        throw error instanceof PayoutError
            ? error
            : new PayoutError(error.message || 'Failed to initiate payout', error.code || null);
    }
};

export const handlePayoutWebhook = async (headers, rawBody, parsedBody) => {
    if (!cashfreePayoutAdapter.verifyWebhook(headers, rawBody)) {
        logger.warn('[PayoutService] Invalid Cashfree webhook signature');
        throw new BadRequestError('Invalid webhook signature');
    }

    const webhookData = cashfreePayoutAdapter.parseWebhookPayload(parsedBody);

    logger.info('[PayoutService] Payout webhook received', {
        event: webhookData.event,
        transferId: webhookData.transferId,
        status: webhookData.status,
    });

    // Handle non-transfer events (e.g., LOW_BALANCE_ALERT, BENEFICIARY_ADDED, etc.)
    if (!webhookData.transferId) {
        logger.info('[PayoutService] Non-transfer webhook event received', {
            event: webhookData.event,
        });
        return { processed: true, event: webhookData.event, note: 'Non-transfer event' };
    }

    const payout = await payoutRepository.findByTransferId(webhookData.transferId);
    if (!payout) {
        logger.warn('[PayoutService] Payout not found for webhook', {
            transferId: webhookData.transferId,
            event: webhookData.event,
        });
        return { processed: false, event: webhookData.event };
    }

    switch (webhookData.event) {
        case CASHFREE_WEBHOOK_EVENTS.TRANSFER_SUCCESS:
            if (payout.status === PAYOUT_TRANSACTION_STATUS.SUCCESS && payout.webhookProcessed) {
                return { processed: true, event: webhookData.event };
            }
            if (
                [PAYOUT_TRANSACTION_STATUS.FAILED, PAYOUT_TRANSACTION_STATUS.REVERSED].includes(payout.status)
                && payout.webhookProcessed
            ) {
                logger.warn('[PayoutService] Ignoring payout success for terminal state', {
                    payoutId: payout._id,
                    transferId: payout.transferId,
                    currentStatus: payout.status,
                });
                return { processed: true, event: webhookData.event };
            }
            await applyPayoutSuccess(payout, {
                utr: webhookData.utr,
                updatedAt: webhookData.updatedAt,
            });
            break;

        case CASHFREE_WEBHOOK_EVENTS.TRANSFER_FAILED:
            if (payout.status === PAYOUT_TRANSACTION_STATUS.FAILED && payout.webhookProcessed) {
                return { processed: true, event: webhookData.event };
            }
            if (payout.status === PAYOUT_TRANSACTION_STATUS.SUCCESS && payout.webhookProcessed) {
                logger.warn('[PayoutService] Ignoring payout failure after success', {
                    payoutId: payout._id,
                    transferId: payout.transferId,
                });
                return { processed: true, event: webhookData.event };
            }
            await applyPayoutFailure(payout, PAYOUT_TRANSACTION_STATUS.FAILED, {
                failureReason: webhookData.failureReason || webhookData.event,
            });
            break;

        case CASHFREE_WEBHOOK_EVENTS.TRANSFER_REVERSED:
            if (payout.status === PAYOUT_TRANSACTION_STATUS.REVERSED && payout.webhookProcessed) {
                return { processed: true, event: webhookData.event };
            }
            await applyPayoutFailure(payout, PAYOUT_TRANSACTION_STATUS.REVERSED, {
                failureReason: webhookData.failureReason || webhookData.event,
            });
            break;

        default:
            logger.warn('[PayoutService] Unknown Cashfree payout event', {
                event: webhookData.event,
            });
            return { processed: false, event: webhookData.event };
    }

    return { processed: true, event: webhookData.event };
};

export const retryPayout = async (payoutId) => {
    const payout = await payoutRepository.findById(payoutId);
    if (!payout) {
        throw new NotFoundError('Payout');
    }

    if (![PAYOUT_TRANSACTION_STATUS.FAILED, PAYOUT_TRANSACTION_STATUS.REVERSED].includes(payout.status)) {
        throw new BadRequestError('Can only retry failed or reversed payouts');
    }

    if (payout.retryCount >= payout.maxRetries) {
        throw new BadRequestError('Maximum retry attempts exceeded');
    }

    const { shop, barber } = await getShopAndBarber(payout.shopId);
    const beneficiaryId = await ensureBeneficiary(
        shop,
        barber,
        payout.beneficiaryId || shop.payoutConfig?.beneficiaryId || generateBeneficiaryId(shop.ownerId),
    );
    // Extract base transfer ID (remove any existing retry suffix)
    const baseTransferId = payout.transferId.split('_R')[0];
    const newTransferId = `${baseTransferId}_R${payout.retryCount + 1}`;
    
    // Ensure retry transfer ID doesn't exceed 40 characters
    if (newTransferId.length > 40) {
        throw new BadRequestError('Transfer ID would exceed maximum length on retry');
    }

    await payoutRepository.updateById(payout._id, {
        transferId: newTransferId,
        beneficiaryId,
        status: PAYOUT_TRANSACTION_STATUS.INITIATED,
        retryCount: payout.retryCount + 1,
        lastRetryAt: new Date(),
        failureReason: null,
        errorCode: null,
        gatewayTransferId: null,
        utr: null,
        webhookProcessed: false,
    });

    try {
        const transferResponse = await cashfreePayoutAdapter.initiateTransfer({
            transferId: newTransferId,
            amountInRupees: payout.amountInRupees,
            beneficiaryId,
            transferMode: payout.transferMode,
            remarks: payout.remarks || `EverCut payout retry for ${payout.bookingIds.length} booking(s)`,
        });

        await payoutRepository.updateById(payout._id, {
            status: PAYOUT_TRANSACTION_STATUS.PENDING,
            gatewayTransferId: transferResponse.gatewayTransferId,
        });

        await bookingRepository.updateManyByIds(payout.bookingIds, {
            payoutStatus: PAYOUT_STATUS.PENDING,
        });

        return serializePayout(await payoutRepository.findById(payout._id));
    } catch (error) {
        await payoutRepository.updateById(payout._id, {
            status: PAYOUT_TRANSACTION_STATUS.FAILED,
            failureReason: error.message,
            errorCode: error.providerCode || error.code || null,
        });

        if (!ensureRetryable(error)) {
            throw error;
        }

        throw error instanceof PayoutError
            ? error
            : new PayoutError(error.message || 'Failed to retry payout', error.code || null);
    }
};

export const pollPendingPayouts = async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckPayouts = await payoutRepository.findStuckPayouts(tenMinutesAgo);

    logger.info('[PayoutService] Polling stuck payouts', {
        count: stuckPayouts.length,
    });

    for (const payout of stuckPayouts) {
        try {
            const statusResponse = await cashfreePayoutAdapter.getTransferStatus(payout.transferId);

            if (statusResponse.status === PAYOUT_TRANSACTION_STATUS.SUCCESS) {
                await applyPayoutSuccess(payout, {
                    utr: statusResponse.utr,
                    updatedAt: statusResponse.updatedAt,
                });
            } else if (statusResponse.status === PAYOUT_TRANSACTION_STATUS.FAILED) {
                await applyPayoutFailure(payout, PAYOUT_TRANSACTION_STATUS.FAILED, {
                    failureReason: statusResponse.failureReason || 'TRANSFER_FAILED',
                });
            } else if (statusResponse.status === PAYOUT_TRANSACTION_STATUS.REVERSED) {
                await applyPayoutFailure(payout, PAYOUT_TRANSACTION_STATUS.REVERSED, {
                    failureReason: statusResponse.failureReason || 'TRANSFER_REVERSED',
                });
            }
        } catch (error) {
            logger.error('[PayoutService] Payout poll failed', {
                payoutId: payout._id,
                transferId: payout.transferId,
                error: error.message,
            });
        }
    }
};

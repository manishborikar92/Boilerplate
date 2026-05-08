import crypto from 'crypto';

import config from '../config/index.js';
import customerRepository from '../repositories/customer.repository.js';
import bookingRepository from '../repositories/booking.repository.js';
import employeeRepository from '../repositories/employee.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import phonePeAdapter from '../adapters/phonepe/phonepe.adapter.js';
import notificationEvents from './notification-events.service.js';
import logger from '../utils/logger.js';
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    PaymentError,
} from '../utils/api-error.js';
import {
    BOOKING_STATUS,
    BUNDLE_RULES,
    PAYMENT_GATEWAYS,
    PAYMENT_STATUS,
    PAYMENT_TRANSACTION_STATUS,
    PHONEPE_WEBHOOK_EVENTS,
    REFUND_FEES,
    ROLES,
    SERVICE_TYPE,
} from '../utils/constants.js';
import {
    getEffectiveServicePrice,
    normalizeServicePricing,
} from '../utils/service-pricing.utils.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { toDateOnlyString } from '../utils/slot-lock.utils.js';
import {
    serializePayment,
    serializePaymentInitiation,
    serializePaymentStatus,
} from '../serializers/payment.serializer.js';

const toObjectIdString = (value) => String(value?._id || value || '');

const getBookingSlotLockTimes = (booking) => {
    if (Array.isArray(booking?.slotLockTimes) && booking.slotLockTimes.length > 0) {
        return booking.slotLockTimes;
    }

    return [booking?.time].filter(Boolean);
};

const generateMerchantOrderId = (bookingId) => {
    const random = crypto.randomBytes(4).toString('hex');
    return `EC-${bookingId}-${Date.now()}-${random}`;
};

const REFUND_TYPE = Object.freeze({
    CANCELLATION: 'cancellation',
    MANUAL: 'manual',
});

const REFUND_MANUAL_MESSAGE = 'Refund could not be initiated. Please request a manual refund.';

const getRefundSeed = (...values) => {
    for (const value of values) {
        const match = String(value || '').match(/[a-f0-9]{24}/i);
        if (match) return match[0].toLowerCase();
    }

    return crypto
        .createHash('sha256')
        .update(values.map((value) => String(value || '')).join(':'))
        .digest('hex')
        .slice(0, 24);
};

const generateMerchantRefundId = ({ merchantOrderId, bookingId }) => {
    const seed = getRefundSeed(bookingId, merchantOrderId);
    const random = crypto.randomBytes(6).toString('hex');
    return `RF-${seed}-${random}`;
};

const getRefundFeeInPaisa = (payment) => (
    payment.settlement?.isBundle ? REFUND_FEES.BUNDLE : REFUND_FEES.SINGLE_SERVICE
) * 100;

const toPositivePaisa = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0
        ? Math.round(numericValue)
        : 0;
};

const getRefundGrossAmountInPaisa = (payment, booking, platformFeeInPaisa) => {
    if (payment.settlement?.serviceAmount !== undefined && payment.settlement.serviceAmount !== null) {
        return toPositivePaisa(payment.settlement.serviceAmount);
    }

    const bookingTotalInPaisa = Number.isFinite(Number(booking.totalAmount))
        ? Math.round(Number(booking.totalAmount) * 100)
        : 0;

    if (bookingTotalInPaisa > 0) {
        return bookingTotalInPaisa;
    }

    return Math.max(0, toPositivePaisa(payment.amount) - platformFeeInPaisa);
};

const createRefundRecord = ({
    merchantRefundId,
    refundResponse = null,
    amount,
    refundFee,
    platformFee,
    status,
    type,
    reason,
    failureReason = null,
    manualResolutionRequired,
}) => {
    const record = {
        merchantRefundId,
        gatewayRefundId: refundResponse?.refundId || null,
        amount,
        refundFee,
        platformFee,
        status,
        type,
        reason,
        initiatedAt: new Date(),
        completedAt: null,
        failureReason,
    };

    if (manualResolutionRequired !== undefined) {
        record.manualResolutionRequired = manualResolutionRequired;
    }

    return record;
};

const sumServiceAmounts = (services = []) => services.reduce(
    (sum, service) => sum + (getEffectiveServicePrice(service) ?? 0),
    0,
);

const MUTABLE_PAYMENT_STATUSES = new Set([
    PAYMENT_TRANSACTION_STATUS.INITIATED,
    PAYMENT_TRANSACTION_STATUS.PENDING,
]);

const SUCCESSFUL_PAYMENT_LIFECYCLE_STATUSES = new Set([
    PAYMENT_TRANSACTION_STATUS.COMPLETED,
    PAYMENT_TRANSACTION_STATUS.REFUND_PENDING,
    PAYMENT_TRANSACTION_STATUS.REFUNDED,
    PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
]);

const loadBookingWithCustomerAccess = async (userId, bookingId) => {
    const [customer, booking] = await Promise.all([
        customerRepository.findByUserId(userId),
        bookingRepository.findById(bookingId),
    ]);

    if (!customer) {
        throw new NotFoundError('Customer profile');
    }

    if (!booking) {
        throw new NotFoundError('Booking');
    }

    if (toObjectIdString(booking.customerId) !== toObjectIdString(customer._id)) {
        throw new ForbiddenError('You can only access payments for your own bookings');
    }

    return { booking, customer };
};

const normalizePaymentActor = (actorOrUserId) => {
    if (actorOrUserId && typeof actorOrUserId === 'object') {
        return {
            userId: actorOrUserId.userId || actorOrUserId._id,
            roleType: actorOrUserId.roleType || actorOrUserId.role,
        };
    }

    return {
        userId: actorOrUserId,
        roleType: ROLES.CUSTOMER,
    };
};

const applyPaymentQueryFilters = (filter, query = {}) => {
    if (query.status) filter.status = query.status;
    if (query.bookingId) filter.bookingId = query.bookingId;
    return filter;
};

const buildPaymentListFilter = async (actorOrUserId, query = {}) => {
    const actor = normalizePaymentActor(actorOrUserId);
    const filter = {};

    if (actor.roleType === ROLES.CUSTOMER) {
        const customer = await customerRepository.findByUserId(actor.userId);
        if (!customer) throw new NotFoundError('Customer profile');
        filter.customerId = customer._id;
        return applyPaymentQueryFilters(filter, query);
    }

    if (actor.roleType === ROLES.BARBER) {
        const shop = await shopRepository.findByOwnerId(actor.userId);
        if (!shop) throw new NotFoundError('Shop profile');
        filter.shopId = shop._id;
        return applyPaymentQueryFilters(filter, query);
    }

    if (actor.roleType === ROLES.ADMIN) {
        return applyPaymentQueryFilters(filter, query);
    }

    throw new ForbiddenError('You are not allowed to access payments');
};

const assertPaymentAccess = async (actorOrUserId, payment) => {
    const actor = normalizePaymentActor(actorOrUserId);

    if (actor.roleType === ROLES.ADMIN) return;

    if (actor.roleType === ROLES.BARBER) {
        const shop = await shopRepository.findByOwnerId(actor.userId);
        if (!shop || toObjectIdString(payment.shopId) !== toObjectIdString(shop._id)) {
            throw new ForbiddenError('You can only access payments for your own shop');
        }
        return;
    }

    if (actor.roleType === ROLES.CUSTOMER) {
        const customer = await customerRepository.findByUserId(actor.userId);
        if (!customer || toObjectIdString(payment.customerId) !== toObjectIdString(customer._id)) {
            throw new ForbiddenError('You can only access your own payments');
        }
        return;
    }

    throw new ForbiddenError('You are not allowed to access payments');
};

const buildPaymentListItem = (payment) => serializePayment(payment);

const loadBookedServices = async (booking) => {
    if (!Array.isArray(booking.serviceIds) || booking.serviceIds.length === 0) {
        return [];
    }

    const services = await serviceRepository.findByIds(
        booking.serviceIds,
        'serviceType finalPrice totalPrice actualPrice offerPrice',
    );

    return services.map(normalizeServicePricing);
};

const calculateSettlement = async (booking) => {
    const services = await loadBookedServices(booking);
    const isBundle = booking.serviceIds.length > 1
        || services.some((service) => service.serviceType === SERVICE_TYPE.BUNDLED);
    const serviceAmountInRupees = Number(booking.totalAmount || sumServiceAmounts(services) || 0);

    if (isBundle && serviceAmountInRupees < BUNDLE_RULES.MIN_SERVICE_AMOUNT) {
        throw new BadRequestError(`Bundle service amount must be at least ₹${BUNDLE_RULES.MIN_SERVICE_AMOUNT}`);
    }

    const platformFeeInRupees = isBundle
        ? config.payment.platformFeeBundle
        : config.payment.platformFeeSingle;

    const serviceAmount = Math.round(serviceAmountInRupees * 100);
    const platformFee = Math.round(platformFeeInRupees * 100);

    return {
        serviceAmount,
        platformFee,
        barberPayout: serviceAmount,
        isBundle,
        totalAmountInPaisa: serviceAmount + platformFee,
        totalAmountInRupees: (serviceAmount + platformFee) / 100,
    };
};

const verifyOrderFromGateway = async (webhookData) => {
    if (!webhookData?.merchantOrderId) {
        return webhookData;
    }

    try {
        const status = await phonePeAdapter.getOrderStatus(webhookData.merchantOrderId);
        return {
            ...webhookData,
            state: status.state || webhookData.state,
            amount: status.amount || webhookData.amount,
            paymentDetails: status.paymentDetails || webhookData.paymentDetails || [],
            errorCode: status.errorCode || webhookData.errorCode || null,
            detailedErrorCode: status.detailedErrorCode || webhookData.detailedErrorCode || null,
            errorContext: status.errorContext || webhookData.errorContext || null,
        };
    } catch (error) {
        logger.warn('[PaymentService] Order verification failed, using webhook payload', {
            merchantOrderId: webhookData.merchantOrderId,
            error: error.message,
        });
        return webhookData;
    }
};

const logIgnoredPaymentTransition = (message, payment, nextState) => {
    logger.warn(message, {
        paymentId: payment._id,
        bookingId: payment.bookingId,
        merchantOrderId: payment.merchantOrderId,
        currentStatus: payment.status,
        nextState,
    });
};

const hasPaymentAmountMismatch = (payment, webhookData) => {
    const storedAmount = Number(payment.amount);
    const gatewayAmount = Number(webhookData.amount);

    return Number.isFinite(storedAmount)
        && Number.isFinite(gatewayAmount)
        && storedAmount > 0
        && gatewayAmount > 0
        && Math.round(storedAmount) !== Math.round(gatewayAmount);
};

const rejectPaymentAmountMismatch = async (payment, webhookData) => {
    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.FAILED,
        gatewayState: webhookData.state,
        errorCode: 'AMOUNT_MISMATCH',
        detailedErrorCode: 'PHONEPE_AMOUNT_MISMATCH',
        errorSource: 'PHONEPE',
        errorStage: 'VERIFICATION',
        errorDescription: `PhonePe amount mismatch: expected ${payment.amount}, received ${webhookData.amount}`,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await cancelUnpaidBookingAndReleaseSlot(
        payment.bookingId,
        'Payment verification failed. Please create a new booking.',
    );
    await notificationEvents.notifyPaymentFailed({
        bookingId: payment.bookingId,
        paymentId: payment._id,
        reason: 'Payment verification failed',
    });

    logger.error('[PaymentService] Payment amount mismatch', {
        bookingId: payment.bookingId,
        merchantOrderId: payment.merchantOrderId,
        expectedAmount: payment.amount,
        receivedAmount: webhookData.amount,
    });
};

const releaseBookingSlot = async (booking) => {
    if (!booking?.employeeId || !booking?.date) return;

    const startMinute = Number(booking.startMinute);
    const endMinute = Number(booking.endMinute);
    if (Number.isFinite(startMinute) && Number.isFinite(endMinute) && startMinute < endMinute) {
        await employeeRepository.releaseTimeRange(
            booking.employeeId,
            {
                bookingId: booking._id,
                date: toDateOnlyString(booking.date),
                startMinute,
                endMinute,
                slotLockTimes: getBookingSlotLockTimes(booking),
            },
        );
        return;
    }

    await employeeRepository.releaseSlots(
        booking.employeeId,
        toDateOnlyString(booking.date),
        getBookingSlotLockTimes(booking),
    );
};

const cancelUnpaidBookingAndReleaseSlot = async (bookingId, cancellationNote) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return null;

    if (
        booking.status === BOOKING_STATUS.CANCELLED
        || booking.status === BOOKING_STATUS.COMPLETED
        || booking.paymentStatus === PAYMENT_STATUS.SUCCESS
    ) {
        return null;
    }

    await releaseBookingSlot(booking);

    await bookingRepository.updateById(bookingId, {
        status: BOOKING_STATUS.CANCELLED,
        paymentStatus: PAYMENT_STATUS.FAILED,
        cancelledAt: new Date(),
        cancellationNote,
    });
    return null;
};

const assertRefundPermission = async (actor, booking) => {
    const actorRole = actor?.roleType || actor?.role;

    if (!actorRole) {
        return;
    }

    if (actorRole === ROLES.ADMIN) {
        return;
    }

    if (actorRole !== ROLES.BARBER) {
        throw new ForbiddenError('You are not allowed to initiate refunds');
    }

    const actorShop = await shopRepository.findByOwnerId(actor.userId || actor._id);
    if (!actorShop || toObjectIdString(actorShop._id) !== toObjectIdString(booking.shopId)) {
        throw new ForbiddenError('Barbers can only refund bookings for their own shop');
    }
};

const dateToEpochMs = (value) => {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

const buildNativePaymentInitiationResponse = (payload) => serializePaymentInitiation(payload);

const mapBookingPaymentStatus = (paymentStatus) => {
    switch (paymentStatus) {
        case PAYMENT_TRANSACTION_STATUS.COMPLETED:
            return PAYMENT_STATUS.SUCCESS;
        case PAYMENT_TRANSACTION_STATUS.FAILED:
        case PAYMENT_TRANSACTION_STATUS.EXPIRED:
            return PAYMENT_STATUS.FAILED;
        case PAYMENT_TRANSACTION_STATUS.REFUND_PENDING:
            return PAYMENT_STATUS.REFUND_PENDING;
        case PAYMENT_TRANSACTION_STATUS.REFUNDED:
            return PAYMENT_STATUS.REFUNDED;
        case PAYMENT_TRANSACTION_STATUS.REFUND_FAILED:
            return PAYMENT_STATUS.REFUND_FAILED;
        case PAYMENT_TRANSACTION_STATUS.INITIATED:
            return PAYMENT_STATUS.INITIATED;
        case PAYMENT_TRANSACTION_STATUS.PENDING:
        default:
            return PAYMENT_STATUS.PENDING;
    }
};

const buildPaymentStatusResponse = async (payment, gatewayStatus = null, sdkContext = {}) => {
    const booking = await bookingRepository.findById(payment.bookingId);
    const firstPayment = gatewayStatus?.paymentDetails?.[0] || null;

    return serializePaymentStatus({
        payment,
        booking,
        gatewayStatus,
        sdkContext,
        bookingPaymentStatus: mapBookingPaymentStatus(payment.status),
    });
};

const syncPaymentWithGateway = async (payment, sdkContext = {}) => {
    let gatewayStatus = null;

    if (MUTABLE_PAYMENT_STATUSES.has(payment.status)) {
        gatewayStatus = await phonePeAdapter.getOrderStatus(payment.merchantOrderId);

        if (gatewayStatus.state === 'COMPLETED') {
            await handlePaymentSuccess({
                merchantOrderId: payment.merchantOrderId,
                state: gatewayStatus.state,
                amount: gatewayStatus.amount,
                paymentDetails: gatewayStatus.paymentDetails,
                errorCode: gatewayStatus.errorCode,
                detailedErrorCode: gatewayStatus.detailedErrorCode,
                errorContext: gatewayStatus.errorContext,
            });
        } else if (gatewayStatus.state === 'FAILED') {
            await handlePaymentFailure({
                merchantOrderId: payment.merchantOrderId,
                state: gatewayStatus.state,
                amount: gatewayStatus.amount,
                paymentDetails: gatewayStatus.paymentDetails,
                errorCode: gatewayStatus.errorCode,
                detailedErrorCode: gatewayStatus.detailedErrorCode,
                errorContext: gatewayStatus.errorContext,
            });
        } else {
            await paymentRepository.updateById(payment._id, {
                gatewayState: gatewayStatus.state || payment.gatewayState,
                statusPolledAt: new Date(),
            });
        }
    }

    const latestPayment = await paymentRepository.findById(payment._id);
    return buildPaymentStatusResponse(latestPayment, gatewayStatus, sdkContext);
};

export const initiatePayment = async (userId, bookingId) => {
    const { booking, customer } = await loadBookingWithCustomerAccess(userId, bookingId);

    if (booking.status === BOOKING_STATUS.CANCELLED) {
        throw new BadRequestError('Cannot pay for a cancelled booking');
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
        throw new BadRequestError('Cannot pay for a completed booking');
    }

    if (booking.paymentStatus === PAYMENT_STATUS.SUCCESS) {
        throw new ConflictError('Booking is already paid');
    }

    const existingPending = await paymentRepository.findPendingByBookingId(bookingId);
    if (existingPending?.expiresAt && new Date(existingPending.expiresAt) > new Date()) {
        return buildNativePaymentInitiationResponse({
            payment: existingPending,
            bookingId,
            reusable: true,
        });
    }

    if (existingPending) {
        await paymentRepository.updateById(existingPending._id, {
            status: PAYMENT_TRANSACTION_STATUS.EXPIRED,
        });
    }

    const settlement = await calculateSettlement(booking);
    if (settlement.totalAmountInPaisa <= 0) {
        throw new BadRequestError('Booking amount must be greater than zero');
    }

    const merchantOrderId = generateMerchantOrderId(bookingId);
    const paymentTransaction = await paymentRepository.create({
        bookingId,
        customerId: customer._id,
        shopId: booking.shopId,
        merchantOrderId,
        amount: settlement.totalAmountInPaisa,
        amountInRupees: settlement.totalAmountInRupees,
        status: PAYMENT_TRANSACTION_STATUS.INITIATED,
        settlement: {
            serviceAmount: settlement.serviceAmount,
            platformFee: settlement.platformFee,
            barberPayout: settlement.barberPayout,
            isBundle: settlement.isBundle,
            settled: false,
            settledAt: null,
        },
    });

    try {
        const gatewayResponse = await phonePeAdapter.createOrder({
            merchantOrderId,
            amount: settlement.totalAmountInPaisa,
            metadata: {
                bookingId: toObjectIdString(bookingId),
                customerId: toObjectIdString(customer._id),
                shopId: toObjectIdString(booking.shopId),
            },
            paymentModeConfig: config.payment.paymentModes?.length > 0
                ? {
                    version: 'V2',
                    enabledPaymentModes: config.payment.paymentModes,
                }
                : null,
        });

        await paymentRepository.updateById(paymentTransaction._id, {
            gatewayOrderId: gatewayResponse.orderId,
            sdkOrderToken: gatewayResponse.token,
            sdkOrderTokenIssued: true,
            sdkOrderTokenIssuedAt: new Date(),
            status: PAYMENT_TRANSACTION_STATUS.PENDING,
            gatewayState: gatewayResponse.state,
            expiresAt: gatewayResponse.expiresAt
                ? new Date(gatewayResponse.expiresAt)
                : new Date(Date.now() + config.payment.sessionExpirySeconds * 1000),
        });

        await bookingRepository.updateById(bookingId, {
            paymentTransactionId: paymentTransaction._id,
            merchantOrderId,
            paymentStatus: PAYMENT_STATUS.INITIATED,
            paymentGateway: PAYMENT_GATEWAYS.PHONEPE,
        });

        logger.info('[PaymentService] Payment initiated', {
            bookingId,
            merchantOrderId,
            amountInRupees: settlement.totalAmountInRupees,
            gateway: PAYMENT_GATEWAYS.PHONEPE,
            paymentFlow: 'PHONEPE_SDK',
        });

        const paymentResponseBase = paymentTransaction.toObject
            ? paymentTransaction.toObject()
            : paymentTransaction;

        return buildNativePaymentInitiationResponse({
            payment: {
                ...paymentResponseBase,
                gatewayOrderId: gatewayResponse.orderId,
                sdkOrderToken: gatewayResponse.token,
                gatewayState: gatewayResponse.state,
                expiresAt: gatewayResponse.expiresAt,
            },
            bookingId,
            gatewayResponse,
        });
    } catch (error) {
        await paymentRepository.updateById(paymentTransaction._id, {
            status: PAYMENT_TRANSACTION_STATUS.FAILED,
            errorDescription: error.message,
        });
        await cancelUnpaidBookingAndReleaseSlot(
            bookingId,
            'Payment could not be initiated. Please create a new booking.',
        );

        throw error instanceof PaymentError
            ? error
            : new PaymentError(error.message || 'Failed to initiate payment');
    }
};

export const handleWebhook = async (headers, body) => {
    if (!phonePeAdapter.verifyWebhook(headers, body)) {
        logger.warn('[PaymentService] Invalid webhook authentication');
        throw new BadRequestError('Invalid webhook authentication');
    }

    let webhookData = phonePeAdapter.parseWebhookPayload(body);

    logger.info('[PaymentService] Webhook received', {
        event: webhookData.event,
        merchantOrderId: webhookData.merchantOrderId,
        state: webhookData.state,
    });

    if (
        webhookData.event === PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED
        || webhookData.event === PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED
    ) {
        webhookData = await verifyOrderFromGateway(webhookData);
    }

    switch (webhookData.event) {
        case PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED:
            return handlePaymentSuccess(webhookData);
        case PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED:
            return handlePaymentFailure(webhookData);
        case PHONEPE_WEBHOOK_EVENTS.REFUND_COMPLETED:
            return handleRefundSuccess(webhookData);
        case PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED:
            return handleRefundFailure(webhookData);
        default:
            logger.warn('[PaymentService] Unknown PhonePe webhook event', { event: webhookData.event });
            return { processed: false, event: webhookData.event };
    }
};

export const getPayments = async (actorOrUserId, query = {}) => {
    const filter = await buildPaymentListFilter(actorOrUserId, query);
    const total = await paymentRepository.countAll(filter);
    const { skip, limit, pagination } = buildPagination(query, total);
    const payments = await paymentRepository.findAll(filter, { skip, limit });

    return {
        items: payments.map(buildPaymentListItem),
        pagination,
    };
};

export const getPaymentStatus = async (actorOrUserId, paymentId) => {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
        throw new NotFoundError('Payment');
    }

    await assertPaymentAccess(actorOrUserId, payment);

    try {
        return await syncPaymentWithGateway(payment);
    } catch (error) {
        logger.warn('[PaymentService] Payment status poll failed', {
            paymentId,
            merchantOrderId: payment.merchantOrderId,
            error: error.message,
        });
    }

    const latestPayment = await paymentRepository.findById(paymentId);
    return buildPaymentStatusResponse(latestPayment);
};

export const verifyPayment = async (userId, paymentId, sdkContext = {}) => {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
        throw new NotFoundError('Payment');
    }

    const customer = await customerRepository.findByUserId(userId);
    if (!customer || toObjectIdString(payment.customerId) !== toObjectIdString(customer._id)) {
        throw new ForbiddenError('You can only verify your own payments');
    }

    logger.info('[PaymentService] Verifying native payment result', {
        paymentId,
        bookingId: payment.bookingId,
        merchantOrderId: payment.merchantOrderId,
        sdkStatus: sdkContext.sdkStatus || null,
    });

    try {
        return await syncPaymentWithGateway(payment, sdkContext);
    } catch (error) {
        logger.warn('[PaymentService] Native payment verification poll failed', {
            paymentId,
            merchantOrderId: payment.merchantOrderId,
            error: error.message,
        });

        const latestPayment = await paymentRepository.findById(paymentId);
        return buildPaymentStatusResponse(latestPayment, null, sdkContext);
    }
};

async function handlePaymentSuccess(webhookData) {
    const payment = await paymentRepository.findByMerchantOrderId(webhookData.merchantOrderId);
    if (!payment) {
        logger.warn('[PaymentService] Payment not found for success webhook', {
            merchantOrderId: webhookData.merchantOrderId,
        });
        return { processed: false, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.COMPLETED) {
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
    }

    if (!MUTABLE_PAYMENT_STATUSES.has(payment.status)) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring payment success for terminal state',
            payment,
            PAYMENT_TRANSACTION_STATUS.COMPLETED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
    }

    // CRITICAL: Only mark as completed if PhonePe confirms the payment is COMPLETED
    if (webhookData.state !== 'COMPLETED') {
        logger.warn('[PaymentService] Webhook claims success but gatewayState is not COMPLETED', {
            merchantOrderId: webhookData.merchantOrderId,
            gatewayState: webhookData.state,
            webhookEvent: webhookData.event,
        });
        
        // Update gatewayState but keep payment pending
        await paymentRepository.updateById(payment._id, {
            gatewayState: webhookData.state,
            webhookReceivedAt: new Date(),
        });
        
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
    }

    if (hasPaymentAmountMismatch(payment, webhookData)) {
        await rejectPaymentAmountMismatch(payment, webhookData);
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
    }

    const firstPayment = webhookData.paymentDetails?.[0] || null;

    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
        gatewayState: webhookData.state,
        paymentMode: firstPayment?.paymentMode || webhookData.paymentMode || null,
        gatewayTransactionId: firstPayment?.transactionId || webhookData.transactionId || null,
        paymentInstrument: firstPayment?.instrument || null,
        rail: firstPayment?.rail || null,
        errorCode: null,
        detailedErrorCode: null,
        errorSource: null,
        errorStage: null,
        errorDescription: null,
        sdkOrderToken: null,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await bookingRepository.updateById(payment.bookingId, {
        paymentStatus: PAYMENT_STATUS.SUCCESS,
        status: BOOKING_STATUS.AWAITING_CONFIRMATION,
        paidAt: new Date(),
        paymentMode: firstPayment?.paymentMode || webhookData.paymentMode || null,
    });
    await notificationEvents.notifyBookingAwaitingConfirmation({
        bookingId: payment.bookingId,
        paymentId: payment._id,
    });

    logger.info('[PaymentService] Payment completed', {
        bookingId: payment.bookingId,
        merchantOrderId: payment.merchantOrderId,
        paymentMode: firstPayment?.paymentMode || webhookData.paymentMode || null,
    });

    return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_COMPLETED };
}

async function handlePaymentFailure(webhookData) {
    const payment = await paymentRepository.findByMerchantOrderId(webhookData.merchantOrderId);
    if (!payment) {
        return { processed: false, event: PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED };
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.FAILED) {
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED };
    }

    if (
        payment.status === PAYMENT_TRANSACTION_STATUS.EXPIRED
        || SUCCESSFUL_PAYMENT_LIFECYCLE_STATUSES.has(payment.status)
    ) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring payment failure for terminal state',
            payment,
            PAYMENT_TRANSACTION_STATUS.FAILED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED };
    }

    if (!MUTABLE_PAYMENT_STATUSES.has(payment.status)) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring unexpected payment failure transition',
            payment,
            PAYMENT_TRANSACTION_STATUS.FAILED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED };
    }

    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.FAILED,
        gatewayState: webhookData.state,
        errorCode: webhookData.errorCode || webhookData.errorContext?.errorCode || null,
        detailedErrorCode: webhookData.detailedErrorCode || webhookData.errorContext?.detailedErrorCode || null,
        errorSource: webhookData.errorContext?.source || null,
        errorStage: webhookData.errorContext?.stage || null,
        errorDescription: webhookData.errorContext?.description || null,
        sdkOrderToken: null,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await cancelUnpaidBookingAndReleaseSlot(
        payment.bookingId,
        'Payment failed before confirmation. Please create a new booking.',
    );
    await notificationEvents.notifyPaymentFailed({
        bookingId: payment.bookingId,
        paymentId: payment._id,
        reason: webhookData.errorCode || webhookData.errorContext?.description || 'Payment failed',
    });

    logger.warn('[PaymentService] Payment failed', {
        bookingId: payment.bookingId,
        merchantOrderId: payment.merchantOrderId,
        errorCode: webhookData.errorCode || webhookData.errorContext?.errorCode || null,
    });

    return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.ORDER_FAILED };
}

async function handleRefundSuccess(webhookData) {
    const payment = await paymentRepository.findByMerchantOrderId(webhookData.originalMerchantOrderId);
    if (!payment) {
        return { processed: false, event: PHONEPE_WEBHOOK_EVENTS.REFUND_COMPLETED };
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.REFUNDED) {
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_COMPLETED };
    }

    if (
        ![
            PAYMENT_TRANSACTION_STATUS.COMPLETED,
            PAYMENT_TRANSACTION_STATUS.REFUND_PENDING,
            PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
        ].includes(payment.status)
    ) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring refund success for incompatible payment state',
            payment,
            PAYMENT_TRANSACTION_STATUS.REFUNDED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_COMPLETED };
    }

    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.REFUNDED,
        refund: {
            ...(payment.refund || {}),
            merchantRefundId: webhookData.merchantRefundId || payment.refund?.merchantRefundId || null,
            gatewayRefundId: webhookData.refundId || payment.refund?.gatewayRefundId || null,
            status: 'completed',
            completedAt: new Date(),
            failureReason: null,
            manualResolutionRequired: false,
        },
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await bookingRepository.updateById(payment.bookingId, {
        paymentStatus: PAYMENT_STATUS.REFUNDED,
    });
    await notificationEvents.notifyRefundStatus({
        bookingId: payment.bookingId,
        paymentId: payment._id,
        status: PAYMENT_STATUS.REFUNDED,
        amountInRupees: Number(webhookData.amount || payment.refund?.amount || 0) / 100 || null,
    });

    return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_COMPLETED };
}

async function handleRefundFailure(webhookData) {
    const payment = await paymentRepository.findByMerchantOrderId(webhookData.originalMerchantOrderId);
    if (!payment) {
        return { processed: false, event: PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED };
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.REFUND_FAILED) {
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED };
    }

    if (payment.status === PAYMENT_TRANSACTION_STATUS.REFUNDED) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring refund failure after refund completion',
            payment,
            PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED };
    }

    if (
        ![
            PAYMENT_TRANSACTION_STATUS.COMPLETED,
            PAYMENT_TRANSACTION_STATUS.REFUND_PENDING,
        ].includes(payment.status)
    ) {
        logIgnoredPaymentTransition(
            '[PaymentService] Ignoring refund failure for incompatible payment state',
            payment,
            PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
        );
        return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED };
    }

    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
        refund: {
            ...(payment.refund || {}),
            merchantRefundId: webhookData.merchantRefundId || payment.refund?.merchantRefundId || null,
            gatewayRefundId: webhookData.refundId || payment.refund?.gatewayRefundId || null,
            status: 'failed',
            failureReason: webhookData.detailedErrorCode || webhookData.errorCode || 'Refund failed at payment gateway',
            manualResolutionRequired: true,
        },
        errorCode: webhookData.errorCode || null,
        detailedErrorCode: webhookData.detailedErrorCode || null,
        webhookReceivedAt: new Date(),
        webhookProcessed: true,
    });

    await bookingRepository.updateById(payment.bookingId, {
        paymentStatus: PAYMENT_STATUS.REFUND_FAILED,
    });
    await notificationEvents.notifyRefundStatus({
        bookingId: payment.bookingId,
        paymentId: payment._id,
        status: PAYMENT_STATUS.REFUND_FAILED,
    });

    return { processed: true, event: PHONEPE_WEBHOOK_EVENTS.REFUND_FAILED };
}

export const initiateRefund = async (bookingId, reason, actor = null, isBarberCancellation = false) => {
    const payment = await paymentRepository.findCompletedByBookingId(bookingId);
    if (!payment) {
        throw new NotFoundError('Completed payment for this booking');
    }

    if (![PAYMENT_TRANSACTION_STATUS.COMPLETED, PAYMENT_TRANSACTION_STATUS.REFUND_FAILED].includes(payment.status)) {
        throw new BadRequestError('Can only refund completed payments');
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
        throw new NotFoundError('Booking');
    }

    await assertRefundPermission(actor, booking);

    if (
        booking.payoutStatus
        && !['not_initiated', 'failed', 'reversed'].includes(booking.payoutStatus)
    ) {
        throw new BadRequestError('Refund window has closed. Please request a manual refund.');
    }

    const refundType = REFUND_TYPE.CANCELLATION;
    const platformFeeInPaisa = toPositivePaisa(payment.settlement?.platformFee || 0);
    const grossAmountInPaisa = getRefundGrossAmountInPaisa(payment, booking, platformFeeInPaisa);

    // Calculate refund amount based on cancellation type
    let refundFeeInPaisa = 0;
    let refundAmountInPaisa = 0;

    if (isBarberCancellation) {
        // Barber cancellation: Full refund (no deductions)
        refundAmountInPaisa = toPositivePaisa(payment.amount);
        refundFeeInPaisa = 0;
    } else {
        // Customer cancellation: Apply fee deductions
        refundFeeInPaisa = getRefundFeeInPaisa(payment);
        refundAmountInPaisa = grossAmountInPaisa - refundFeeInPaisa;
    }

    if (refundAmountInPaisa <= 0) {
        throw new BadRequestError('Refund amount after fee deduction is zero or negative');
    }

    const merchantRefundId = generateMerchantRefundId({
        merchantOrderId: payment.merchantOrderId,
        bookingId,
    });
    let refundResponse;

    try {
        refundResponse = await phonePeAdapter.initiateRefund({
            merchantRefundId,
            originalMerchantOrderId: payment.merchantOrderId,
            amount: refundAmountInPaisa,
        });
    } catch (error) {
        const failedRefund = createRefundRecord({
            merchantRefundId,
            amount: refundAmountInPaisa,
            refundFee: refundFeeInPaisa,
            platformFee: isBarberCancellation ? 0 : platformFeeInPaisa,
            status: 'failed',
            type: refundType,
            reason,
            failureReason: error.message,
            manualResolutionRequired: true,
        });

        await paymentRepository.updateById(payment._id, {
            status: PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
            refundFee: refundFeeInPaisa,
            refund: failedRefund,
            errorDescription: error.message,
        });

        await bookingRepository.updateById(bookingId, {
            paymentStatus: PAYMENT_STATUS.REFUND_FAILED,
        });
        await notificationEvents.notifyRefundStatus({
            bookingId,
            paymentId: payment._id,
            status: PAYMENT_STATUS.REFUND_FAILED,
        });

        logger.error('[PaymentService] Refund initiation failed', {
            bookingId,
            merchantRefundId,
            refundType,
            isBarberCancellation,
            error: error.message,
        });

        throw new PaymentError(REFUND_MANUAL_MESSAGE, error.code || null, error.message);
    }

    const refundRecord = createRefundRecord({
        merchantRefundId,
        refundResponse,
        amount: refundAmountInPaisa,
        refundFee: refundFeeInPaisa,
        platformFee: isBarberCancellation ? 0 : platformFeeInPaisa,
        status: 'pending',
        type: refundType,
        reason,
    });

    await paymentRepository.updateById(payment._id, {
        status: PAYMENT_TRANSACTION_STATUS.REFUND_PENDING,
        refundFee: refundFeeInPaisa,
        refund: refundRecord,
    });

    await bookingRepository.updateById(bookingId, {
        paymentStatus: PAYMENT_STATUS.REFUND_PENDING,
    });
    await notificationEvents.notifyRefundStatus({
        bookingId,
        paymentId: payment._id,
        status: PAYMENT_STATUS.REFUND_PENDING,
        amountInRupees: refundAmountInPaisa / 100,
    });

    logger.info('[PaymentService] Refund initiated', {
        bookingId,
        merchantRefundId,
        refundType,
        isBarberCancellation,
        refundAmount: refundAmountInPaisa / 100,
        deductions: {
            refundFee: refundFeeInPaisa / 100,
            platformFee: isBarberCancellation ? 0 : platformFeeInPaisa / 100,
        },
    });

    return {
        merchantRefundId,
        refundId: refundResponse.refundId,
        state: refundResponse.state,
        refundAmount: refundAmountInPaisa / 100,
        refundType,
        deductions: {
            refundFee: refundFeeInPaisa / 100,
            platformFee: isBarberCancellation ? 0 : platformFeeInPaisa / 100,
        },
    };
};

export const pollPendingPayments = async () => {
    const now = Date.now();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
    const expiresBefore = new Date(now);
    const fallbackCreatedBefore = new Date(now - config.payment.sessionExpirySeconds * 1000);

    const pendingPayments = await paymentRepository.findStalePayments(
        thirtyMinutesAgo,
        twentyFourHoursAgo,
        config.payment.maxPollAttempts,
    );

    logger.info('[PaymentService] Polling pending payments', {
        count: pendingPayments.length,
    });

    for (const payment of pendingPayments) {
        try {
            const status = await phonePeAdapter.getOrderStatus(payment.merchantOrderId);

            await paymentRepository.updateById(payment._id, {
                pollAttempts: (payment.pollAttempts || 0) + 1,
                lastPollAt: new Date(),
                statusPolledAt: new Date(),
            });

            if (status.state === 'COMPLETED') {
                await handlePaymentSuccess({
                    merchantOrderId: payment.merchantOrderId,
                    state: status.state,
                    amount: status.amount,
                    paymentDetails: status.paymentDetails,
                    errorCode: status.errorCode,
                    detailedErrorCode: status.detailedErrorCode,
                    errorContext: status.errorContext,
                });
            } else if (status.state === 'FAILED') {
                await handlePaymentFailure({
                    merchantOrderId: payment.merchantOrderId,
                    state: status.state,
                    amount: status.amount,
                    paymentDetails: status.paymentDetails,
                    errorCode: status.errorCode,
                    detailedErrorCode: status.detailedErrorCode,
                    errorContext: status.errorContext,
                });
            }
        } catch (error) {
            logger.error('[PaymentService] Pending payment poll failed', {
                paymentId: payment._id,
                merchantOrderId: payment.merchantOrderId,
                error: error.message,
            });
        }
    }

    const expirablePayments = await paymentRepository.findExpirablePendingPayments(
        expiresBefore,
        fallbackCreatedBefore,
    );
    for (const payment of expirablePayments) {
        await paymentRepository.updateById(payment._id, {
            status: PAYMENT_TRANSACTION_STATUS.EXPIRED,
        });
        await cancelUnpaidBookingAndReleaseSlot(
            payment.bookingId,
            'Payment session expired before confirmation. Please create a new booking.',
        );
        await notificationEvents.notifyPaymentFailed({
            bookingId: payment.bookingId,
            paymentId: payment._id,
            reason: 'Payment session expired',
        });
    }

    if (expirablePayments.length > 0) {
        logger.info('[PaymentService] Expired stale payments', {
            count: expirablePayments.length,
        });
    }
};

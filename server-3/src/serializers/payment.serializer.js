import config from '../config/index.js';
import { PAYMENT_GATEWAYS } from '../utils/constants.js';
import { sanitizeForResponse, toIdString, toPlainObject } from './core.serializer.js';
import { serializeBooking } from './booking.serializer.js';
import { serializeCustomerSummary } from './customer.serializer.js';
import { serializeShopSummary } from './shop.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

const dateToEpochMs = (value) => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

const serializeRefund = (refund) => {
    const plain = sanitizeForResponse(refund);
    if (!plain) return null;

    return compact({
        merchantRefundId: plain.merchantRefundId ?? null,
        gatewayRefundId: plain.gatewayRefundId ?? null,
        amount: plain.amount ?? null,
        refundFee: plain.refundFee ?? null,
        platformFee: plain.platformFee ?? null,
        status: plain.status ?? null,
        type: plain.type ?? null,
        initiatedAt: plain.initiatedAt ?? null,
        completedAt: plain.completedAt ?? null,
        reason: plain.reason ?? null,
        failureReason: plain.failureReason ?? null,
        manualResolutionRequired: plain.manualResolutionRequired,
    });
};

export const serializeSettlement = (settlement) => {
    const plain = sanitizeForResponse(settlement);
    if (!plain) return null;

    return compact({
        serviceAmount: plain.serviceAmount ?? null,
        platformFee: plain.platformFee ?? null,
        barberPayout: plain.barberPayout ?? null,
        isBundle: plain.isBundle ?? false,
        settled: plain.settled ?? false,
        settledAt: plain.settledAt ?? null,
    });
};

export const serializePayment = (payment) => {
    const plain = sanitizeForResponse(toPlainObject(payment));
    if (!plain) return null;

    return compact({
        id: plain.id,
        bookingId: plain.bookingId && typeof plain.bookingId === 'object'
            ? undefined
            : (plain.bookingId?.id || toIdString(plain.bookingId)),
        booking: plain.bookingId && typeof plain.bookingId === 'object'
            ? serializeBooking(plain.bookingId)
            : undefined,
        customerId: plain.customerId && typeof plain.customerId === 'object'
            ? undefined
            : (plain.customerId?.id || toIdString(plain.customerId)),
        customer: plain.customerId && typeof plain.customerId === 'object'
            ? serializeCustomerSummary(plain.customerId)
            : undefined,
        shopId: plain.shopId && typeof plain.shopId === 'object'
            ? undefined
            : (plain.shopId?.id || toIdString(plain.shopId)),
        shop: plain.shopId && typeof plain.shopId === 'object'
            ? serializeShopSummary(plain.shopId)
            : undefined,
        merchantOrderId: plain.merchantOrderId ?? null,
        orderId: plain.gatewayOrderId ?? null,
        status: plain.status ?? null,
        gatewayState: plain.gatewayState ?? null,
        amountInPaisa: plain.amount ?? null,
        amountInRupees: plain.amountInRupees ?? null,
        currency: plain.currency || 'INR',
        paymentMode: plain.paymentMode ?? null,
        transactionId: plain.gatewayTransactionId ?? null,
        refund: serializeRefund(plain.refund),
        settlement: serializeSettlement(plain.settlement),
        expiresAt: plain.expiresAt ?? null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

export const serializePaymentInitiation = ({
    payment,
    bookingId,
    gatewayResponse = null,
    reusable = false,
}) => {
    const raw = toPlainObject(payment);
    const sdkOrderToken = raw?.sdkOrderToken || payment?.sdkOrderToken || null;
    const plain = sanitizeForResponse(toPlainObject(payment));
    return compact({
        id: plain.id,
        bookingId: toIdString(bookingId),
        merchantOrderId: plain.merchantOrderId,
        orderId: gatewayResponse?.orderId || plain.gatewayOrderId || null,
        token: gatewayResponse?.token || sdkOrderToken,
        merchantId: config.phonepe.merchantId,
        amountInPaisa: plain.amount,
        amountInRupees: plain.amountInRupees,
        currency: plain.currency || 'INR',
        state: gatewayResponse?.state || plain.gatewayState || 'PENDING',
        expiresAt: dateToEpochMs(gatewayResponse?.expiresAt || plain.expiresAt),
        gateway: PAYMENT_GATEWAYS.PHONEPE,
        paymentFlow: 'PHONEPE_SDK',
        reusable,
    });
};

export const serializePaymentStatus = ({ payment, booking = null, gatewayStatus = null, sdkContext = {}, bookingPaymentStatus }) => {
    const plain = sanitizeForResponse(toPlainObject(payment));
    const bookingPlain = sanitizeForResponse(toPlainObject(booking));
    const firstPayment = gatewayStatus?.paymentDetails?.[0] || null;

    return compact({
        id: plain.id,
        bookingId: toIdString(plain.bookingId),
        merchantOrderId: plain.merchantOrderId,
        orderId: gatewayStatus?.orderId || plain.gatewayOrderId || null,
        status: plain.status,
        gatewayState: gatewayStatus?.state || plain.gatewayState || null,
        amountInPaisa: plain.amount,
        amountInRupees: plain.amountInRupees,
        currency: plain.currency || 'INR',
        paymentMode: firstPayment?.paymentMode || plain.paymentMode || null,
        transactionId: firstPayment?.transactionId || plain.gatewayTransactionId || null,
        bookingStatus: bookingPlain?.status || null,
        paymentStatus: bookingPlain?.paymentStatus || bookingPaymentStatus || null,
        sdkStatus: sdkContext.sdkStatus || null,
        sdkResponseCode: sdkContext.sdkResponseCode || null,
        sdkMessage: sdkContext.sdkMessage || null,
        error: plain.errorCode || plain.errorDescription
            ? {
                code: plain.errorCode || null,
                detailedCode: plain.detailedErrorCode || null,
                source: plain.errorSource || null,
                stage: plain.errorStage || null,
                description: plain.errorDescription || null,
            }
            : null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

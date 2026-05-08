import { sanitizeForResponse, toIdString, toPlainObject } from './core.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

const serializeIds = (values = []) => (
    Array.isArray(values) ? values.map((value) => toIdString(value)).filter(Boolean) : []
);

export const serializePayout = (payout) => {
    const plain = sanitizeForResponse(toPlainObject(payout));
    if (!plain) return null;

    return compact({
        id: plain.id,
        bookingIds: serializeIds(plain.bookingIds),
        barberId: toIdString(plain.barberId),
        shopId: toIdString(plain.shopId),
        paymentTransactionIds: serializeIds(plain.paymentTransactionIds),
        transferId: plain.transferId ?? null,
        gatewayTransferId: plain.gatewayTransferId ?? null,
        beneficiaryId: plain.beneficiaryId ?? null,
        amount: plain.amount ?? null,
        amountInRupees: plain.amountInRupees ?? null,
        transferMode: plain.transferMode ?? null,
        status: plain.status ?? null,
        utr: plain.utr ?? null,
        processedAt: plain.processedAt ?? null,
        failureReason: plain.failureReason ?? null,
        errorCode: plain.errorCode ?? null,
        retryCount: plain.retryCount ?? 0,
        maxRetries: plain.maxRetries ?? 3,
        lastRetryAt: plain.lastRetryAt ?? null,
        remarks: plain.remarks ?? null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

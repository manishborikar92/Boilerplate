import { sanitizeForResponse, toIdString, toPlainObject } from './core.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

export const serializeNotification = (notification) => {
    const plain = sanitizeForResponse(toPlainObject(notification));
    if (!plain) return null;

    return {
        id: plain.id,
        recipientUserId: toIdString(plain.recipientUserId),
        actorUserId: plain.actorUserId ? toIdString(plain.actorUserId) : null,
        type: plain.type,
        eventType: plain.eventType,
        title: plain.title,
        body: plain.body,
        data: plain.data || {},
        entityType: plain.entityType || null,
        entityId: plain.entityId || null,
        status: plain.status,
        delivery: plain.delivery || { successCount: 0, failureCount: 0 },
        readAt: plain.readAt || null,
        deliveredAt: plain.deliveredAt || null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};

export const serializeFcmTokenRegistration = (token) => {
    const plain = sanitizeForResponse(toPlainObject(token));
    if (!plain) return null;

    return compact({
        id: plain.id,
        userId: toIdString(plain.userId),
        platform: plain.platform ?? null,
        deviceId: plain.deviceId ?? null,
        appVersion: plain.appVersion ?? null,
        locale: plain.locale ?? null,
        lastSeenAt: plain.lastSeenAt ?? null,
        revokedAt: plain.revokedAt ?? null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

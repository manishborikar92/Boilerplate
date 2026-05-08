import fcmTokenRepository from '../repositories/fcm-token.repository.js';
import notificationRepository from '../repositories/notification.repository.js';
import fcmService from './fcm.service.js';
import logger from '../utils/logger.js';
import { NotFoundError } from '../utils/api-error.js';
import { buildPagination } from '../utils/pagination.utils.js';
import {
    NOTIFICATION_STATUS,
    NOTIFICATION_TYPE,
} from '../utils/constants.js';
import {
    serializeFcmTokenRegistration,
    serializeNotification,
} from '../serializers/notification.serializer.js';

const toObjectIdString = (value) => String(value?._id || value || '');

const buildNotificationFilter = (query = {}) => {
    const filter = {};

    if (query.read === true) filter.readAt = { $ne: null };
    if (query.read === false) filter.readAt = null;
    if (query.type) filter.type = query.type;
    if (query.eventType) filter.eventType = query.eventType;

    return filter;
};

export const registerFcmToken = async (userId, payload) => {
    const token = await fcmTokenRepository.upsertForUserAndToken(userId, {
        token: payload.token,
        platform: payload.platform,
        deviceId: payload.deviceId,
        appVersion: payload.appVersion,
        locale: payload.locale,
    });

    return serializeFcmTokenRegistration(token);
};

export const unregisterFcmToken = async (userId, token) => {
    const revoked = await fcmTokenRepository.revokeTokenForUser(userId, token);
    return {
        revoked: Boolean(revoked),
    };
};

export const listNotifications = async (userId, query = {}) => {
    const filter = buildNotificationFilter(query);
    const total = await notificationRepository.countByRecipient(userId, filter);
    const { skip, limit, pagination } = buildPagination(query, total);
    const notifications = await notificationRepository.listByRecipient(userId, filter, { skip, limit });

    return {
        items: notifications.map(serializeNotification),
        pagination,
    };
};

export const getNotificationSummary = async (userId) => ({
    unreadCount: await notificationRepository.countUnread(userId),
});

export const patchNotification = async (userId, notificationId) => {
    const notification = await notificationRepository.markRead(userId, notificationId);
    if (!notification) throw new NotFoundError('Notification');
    return serializeNotification(notification);
};

export const patchNotifications = async (userId) => {
    const result = await notificationRepository.markAllRead(userId);
    return {
        modifiedCount: result.modifiedCount || 0,
    };
};

const updateDelivery = async (notificationId, updates) => {
    try {
        await notificationRepository.updateDeliveryStatus(notificationId, updates);
        return null;
    } catch (error) {
        logger.error('[NotificationService] Failed to update notification delivery status', {
            notificationId,
            error: error.message,
        });
        return null;
    }
};

export const notifyUser = async ({
    recipientUserId,
    actorUserId = null,
    type = NOTIFICATION_TYPE.HYBRID,
    eventType,
    title = null,
    body = null,
    data = {},
    entityType = null,
    entityId = null,
    dedupeKey = null,
    expiresAt = null,
}) => {
    const { created, notification } = await notificationRepository.createIfNotExists({
        recipientUserId,
        actorUserId,
        type,
        eventType,
        title,
        body,
        data,
        entityType,
        entityId: entityId ? toObjectIdString(entityId) : null,
        dedupeKey,
        expiresAt,
    });

    if (!created) {
        return {
            notification: serializeNotification(notification),
            duplicate: true,
            delivery: {
                skipped: true,
                reason: 'duplicate',
            },
        };
    }

    const tokens = await fcmTokenRepository.findActiveTokensByUserId(recipientUserId);
    if (tokens.length === 0) {
        await updateDelivery(notification._id, {
            status: NOTIFICATION_STATUS.SKIPPED,
            failureReason: 'No active FCM tokens',
            delivery: {
                successCount: 0,
                failureCount: 0,
            },
        });

        return {
            notification: serializeNotification(notification),
            duplicate: false,
            delivery: {
                successCount: 0,
                failureCount: 0,
                skipped: true,
                reason: 'no_active_tokens',
            },
        };
    }

    try {
        const delivery = await fcmService.sendMulticast({
            tokens: tokens.map((tokenDoc) => tokenDoc.token),
            payload: {
                id: toObjectIdString(notification._id),
                type,
                eventType,
                title,
                body,
                entityType,
                entityId: entityId ? toObjectIdString(entityId) : null,
                data: fcmService.normalizeFcmData(data),
            },
        });

        if (delivery.invalidTokens.length > 0) {
            await fcmTokenRepository.markInvalidTokens(
                delivery.invalidTokens,
                'FCM reported token invalid or unregistered',
            );
        }

        const status = delivery.failureCount === 0
            ? NOTIFICATION_STATUS.SENT
            : (delivery.successCount > 0 ? NOTIFICATION_STATUS.PARTIAL : NOTIFICATION_STATUS.FAILED);
        await updateDelivery(notification._id, {
            status,
            deliveredAt: delivery.successCount > 0 ? new Date() : null,
            failureReason: delivery.failureCount > 0 ? 'One or more FCM deliveries failed' : null,
            delivery: {
                successCount: delivery.successCount,
                failureCount: delivery.failureCount,
            },
        });

        return {
            notification: serializeNotification(notification),
            duplicate: false,
            delivery,
        };
    } catch (error) {
        logger.error('[NotificationService] FCM delivery failed', {
            notificationId: notification._id,
            recipientUserId,
            eventType,
            error: error.message,
        });

        await updateDelivery(notification._id, {
            status: NOTIFICATION_STATUS.FAILED,
            deliveredAt: null,
            failureReason: error.message,
            delivery: {
                successCount: 0,
                failureCount: tokens.length,
            },
        });

        return {
            notification: serializeNotification(notification),
            duplicate: false,
            delivery: {
                successCount: 0,
                failureCount: tokens.length,
                error: error.message,
            },
        };
    }
};

const notificationService = {
    registerFcmToken,
    unregisterFcmToken,
    listNotifications,
    getNotificationSummary,
    patchNotification,
    patchNotifications,
    notifyUser,
};

export default notificationService;

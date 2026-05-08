import assert from 'node:assert/strict';
import test from 'node:test';

const ensureRequiredEnv = () => {
    const defaults = {
        MONGODB_URI: 'mongodb://localhost:27017/evercut-test',
        FIREBASE_PROJECT_ID: 'evercut-test',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
        CLOUDINARY_CLOUD_NAME: 'evercut',
        CLOUDINARY_API_KEY: 'cloudinary-key',
        CLOUDINARY_API_SECRET: 'cloudinary-secret',
        MSG91_AUTH_KEY: 'msg91-auth',
        MSG91_OTP_TEMPLATE_ID: 'msg91-template',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        PHONEPE_CLIENT_ID: 'phonepe-client',
        PHONEPE_CLIENT_SECRET: 'phonepe-secret',
        PHONEPE_CLIENT_VERSION: '1',
        PHONEPE_MERCHANT_ID: 'merchant-id',
        PHONEPE_WEBHOOK_USERNAME: 'webhook-user',
        PHONEPE_WEBHOOK_PASSWORD: 'webhook-pass',
        CASHFREE_PAYOUT_CLIENT_ID: 'cashfree-client',
        CASHFREE_PAYOUT_CLIENT_SECRET: 'cashfree-secret',
    };

    for (const [key, value] of Object.entries(defaults)) {
        process.env[key] ??= value;
    }
};

ensureRequiredEnv();

const notificationService = (await import('../notification.service.js')).default;
const fcmService = (await import('../fcm.service.js')).default;
const notificationRepository = (await import('../../repositories/notification.repository.js')).default;
const fcmTokenRepository = (await import('../../repositories/fcm-token.repository.js')).default;

test('registerFcmToken upserts a token for the authenticated user and device', async (t) => {
    let upsertArgs = null;
    t.mock.method(fcmTokenRepository, 'upsertForUserAndToken', async (userId, payload) => {
        upsertArgs = { userId, payload };
        return {
            _id: 'token-doc-1',
            userId,
            ...payload,
            revokedAt: null,
        };
    });

    const result = await notificationService.registerFcmToken('user-1', {
        token: 'fcm-token-a',
        platform: 'android',
        deviceId: 'pixel-8',
        appVersion: '2.4.1',
        locale: 'en-IN',
    });

    assert.deepEqual(upsertArgs, {
        userId: 'user-1',
        payload: {
            token: 'fcm-token-a',
            platform: 'android',
            deviceId: 'pixel-8',
            appVersion: '2.4.1',
            locale: 'en-IN',
        },
    });
    assert.equal(result.id, 'token-doc-1');
    assert.equal(result.id, 'token-doc-1');
    assert.equal('tokenId' in result, false);
    assert.equal('token' in result, false);
    assert.equal('_id' in result, false);
    assert.equal(result.revokedAt, null);
});

test('getNotificationSummary returns normalized unread metrics', async (t) => {
    t.mock.method(notificationRepository, 'countUnread', async (userId) => {
        assert.equal(userId, 'user-1');
        return 7;
    });

    const result = await notificationService.getNotificationSummary('user-1');

    assert.deepEqual(result, {
        unreadCount: 7,
    });
});

test('patchNotification marks one notification read for the authenticated recipient', async (t) => {
    const readAt = new Date('2026-05-07T08:00:00.000Z');
    t.mock.method(notificationRepository, 'markRead', async (userId, notificationId) => {
        assert.equal(userId, 'user-1');
        assert.equal(notificationId, 'notification-1');
        return {
            _id: notificationId,
            recipientUserId: userId,
            type: 'hybrid',
            eventType: 'booking.confirmed',
            title: 'Booking confirmed',
            body: 'Your booking is confirmed',
            status: 'sent',
            readAt,
        };
    });

    const result = await notificationService.patchNotification('user-1', 'notification-1');

    assert.equal(result.id, 'notification-1');
    assert.equal(result.recipientUserId, 'user-1');
    assert.equal(result.readAt, readAt);
});

test('patchNotifications marks all unread notifications for the authenticated recipient', async (t) => {
    t.mock.method(notificationRepository, 'markAllRead', async (userId) => {
        assert.equal(userId, 'user-1');
        return { modifiedCount: 3 };
    });

    const result = await notificationService.patchNotifications('user-1');

    assert.deepEqual(result, {
        modifiedCount: 3,
    });
});

test('notification service does not expose deprecated read-action method names', () => {
    assert.equal('getUnreadCount' in notificationService, false);
    assert.equal('markNotificationRead' in notificationService, false);
    assert.equal('markAllNotificationsRead' in notificationService, false);
});

test('notifyUser persists once, sends a hybrid payload to every active device, and marks delivery', async (t) => {
    let createdPayload = null;
    t.mock.method(notificationRepository, 'createIfNotExists', async (payload) => {
        createdPayload = payload;
        return {
            created: true,
            notification: {
                _id: 'notification-1',
                ...payload,
                status: 'queued',
            },
        };
    });

    t.mock.method(fcmTokenRepository, 'findActiveTokensByUserId', async () => ([
        { _id: 'token-doc-1', token: 'fcm-token-a' },
        { _id: 'token-doc-2', token: 'fcm-token-b' },
    ]));

    let sentArgs = null;
    t.mock.method(fcmService, 'sendMulticast', async (args) => {
        sentArgs = args;
        return {
            successCount: 2,
            failureCount: 0,
            invalidTokens: [],
            failures: [],
        };
    });

    let deliveryUpdate = null;
    t.mock.method(notificationRepository, 'updateDeliveryStatus', async (id, updates) => {
        deliveryUpdate = { id, updates };
        return { _id: id, ...updates };
    });

    const result = await notificationService.notifyUser({
        recipientUserId: 'user-1',
        actorUserId: 'barber-user-1',
        type: 'hybrid',
        eventType: 'booking.confirmed',
        title: 'Booking confirmed',
        body: 'Your appointment is confirmed.',
        data: {
            bookingId: 'booking-1',
            requiresFetch: true,
        },
        entityType: 'booking',
        entityId: 'booking-1',
        dedupeKey: 'booking.confirmed:booking-1',
    });

    assert.equal(createdPayload.recipientUserId, 'user-1');
    assert.equal(createdPayload.eventType, 'booking.confirmed');
    assert.equal(createdPayload.dedupeKey, 'booking.confirmed:booking-1');
    assert.deepEqual(sentArgs.tokens, ['fcm-token-a', 'fcm-token-b']);
    assert.equal(sentArgs.payload.type, 'hybrid');
    assert.equal(sentArgs.payload.id, 'notification-1');
    assert.equal(sentArgs.payload.data.bookingId, 'booking-1');
    assert.equal(sentArgs.payload.data.requiresFetch, 'true');
    assert.deepEqual(deliveryUpdate, {
        id: 'notification-1',
        updates: {
            status: 'sent',
            deliveredAt: deliveryUpdate.updates.deliveredAt,
            failureReason: null,
            delivery: {
                successCount: 2,
                failureCount: 0,
            },
        },
    });
    assert.equal(result.duplicate, false);
    assert.equal(result.delivery.successCount, 2);
});

test('notifyUser does not resend an already persisted dedupe key', async (t) => {
    t.mock.method(notificationRepository, 'createIfNotExists', async (payload) => ({
        created: false,
        notification: {
            _id: 'notification-1',
            ...payload,
            status: 'sent',
        },
    }));

    const tokenLookup = t.mock.method(fcmTokenRepository, 'findActiveTokensByUserId', async () => []);
    const sendMock = t.mock.method(fcmService, 'sendMulticast', async () => {
        throw new Error('duplicate notification should not be sent again');
    });

    const result = await notificationService.notifyUser({
        recipientUserId: 'user-1',
        type: 'push',
        eventType: 'booking.confirmed',
        title: 'Booking confirmed',
        body: 'Your appointment is confirmed.',
        dedupeKey: 'booking.confirmed:booking-1',
    });

    assert.equal(result.duplicate, true);
    assert.equal(tokenLookup.mock.callCount(), 0);
    assert.equal(sendMock.mock.callCount(), 0);
});

test('notifyUser revokes invalid FCM tokens and records partial delivery', async (t) => {
    t.mock.method(notificationRepository, 'createIfNotExists', async (payload) => ({
        created: true,
        notification: {
            _id: 'notification-1',
            ...payload,
            status: 'queued',
        },
    }));

    t.mock.method(fcmTokenRepository, 'findActiveTokensByUserId', async () => ([
        { _id: 'token-doc-1', token: 'valid-token' },
        { _id: 'token-doc-2', token: 'stale-token' },
    ]));

    t.mock.method(fcmService, 'sendMulticast', async () => ({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ['stale-token'],
        failures: [
            {
                token: 'stale-token',
                code: 'messaging/registration-token-not-registered',
                message: 'Token is not registered',
            },
        ],
    }));

    let invalidTokenUpdate = null;
    t.mock.method(fcmTokenRepository, 'markInvalidTokens', async (tokens, reason) => {
        invalidTokenUpdate = { tokens, reason };
        return { modifiedCount: 1 };
    });

    let deliveryUpdate = null;
    t.mock.method(notificationRepository, 'updateDeliveryStatus', async (id, updates) => {
        deliveryUpdate = { id, updates };
        return { _id: id, ...updates };
    });

    const result = await notificationService.notifyUser({
        recipientUserId: 'user-1',
        type: 'hybrid',
        eventType: 'booking.confirmed',
        title: 'Booking confirmed',
        body: 'Your appointment is confirmed.',
        dedupeKey: 'booking.confirmed:booking-1',
    });

    assert.deepEqual(invalidTokenUpdate, {
        tokens: ['stale-token'],
        reason: 'FCM reported token invalid or unregistered',
    });
    assert.equal(deliveryUpdate.updates.status, 'partial');
    assert.deepEqual(deliveryUpdate.updates.delivery, {
        successCount: 1,
        failureCount: 1,
    });
    assert.equal(result.delivery.successCount, 1);
    assert.equal(result.delivery.failureCount, 1);
});

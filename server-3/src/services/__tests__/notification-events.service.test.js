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

const notificationEvents = (await import('../notification-events.service.js')).default;
const notificationService = (await import('../notification.service.js')).default;
const bookingRepository = (await import('../../repositories/booking.repository.js')).default;
const customerRepository = (await import('../../repositories/customer.repository.js')).default;
const shopRepository = (await import('../../repositories/shop.repository.js')).default;

test('notifyBookingAwaitingConfirmation sends a deduped hybrid event to the shop owner', async (t) => {
    const bookingId = '507f1f77bcf86cd799439011';
    const shopId = '507f1f77bcf86cd799439012';
    const customerId = '507f1f77bcf86cd799439013';
    const customerUserId = '507f1f77bcf86cd799439014';
    const barberUserId = '507f1f77bcf86cd799439015';
    const paymentId = '507f1f77bcf86cd799439016';

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: bookingId,
        customerId,
        shopId,
        date: new Date('2026-05-08T00:00:00.000Z'),
        time: '10:30',
        status: 'awaiting_confirmation',
        totalAmount: 450,
    }));
    t.mock.method(shopRepository, 'findById', async () => ({
        _id: shopId,
        ownerId: barberUserId,
        shopName: 'EverCut Studio',
    }));
    t.mock.method(customerRepository, 'findById', async () => ({
        _id: customerId,
        userId: customerUserId,
        firstName: 'Asha',
        lastName: 'Rao',
    }));

    let notificationPayload = null;
    t.mock.method(notificationService, 'notifyUser', async (payload) => {
        notificationPayload = payload;
        return { notification: { _id: 'notification-1' }, delivery: { successCount: 1 } };
    });

    const result = await notificationEvents.notifyBookingAwaitingConfirmation({
        bookingId,
        paymentId,
    });

    assert.equal(result.skipped, false);
    assert.equal(notificationPayload.recipientUserId, barberUserId);
    assert.equal(notificationPayload.actorUserId, customerUserId);
    assert.equal(notificationPayload.type, 'hybrid');
    assert.equal(notificationPayload.eventType, 'booking.awaiting_confirmation');
    assert.equal(notificationPayload.entityType, 'booking');
    assert.equal(notificationPayload.entityId, bookingId);
    assert.equal(notificationPayload.dedupeKey, `booking.awaiting_confirmation:${bookingId}:${paymentId}`);
    assert.deepEqual(notificationPayload.data, {
        bookingId,
        shopId,
        customerId,
        customerUserId,
        paymentId,
        status: 'awaiting_confirmation',
        date: '2026-05-08',
        time: '10:30',
        requiresFetch: true,
    });
});

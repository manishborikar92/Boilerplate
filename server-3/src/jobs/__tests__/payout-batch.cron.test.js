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

const bookingRepository = (await import('../../repositories/booking.repository.js')).default;
const paymentRepository = (await import('../../repositories/payment.repository.js')).default;
const payoutBatchJob = await import('../payout-batch.cron.js');

test('runPayoutBatchNow groups completed bookings by barber and creates one payout per barber', async (t) => {
    t.mock.method(bookingRepository, 'findCompletedWithPendingPayout', async () => ([
        { _id: 'booking-1', shopId: { _id: 'shop-1', ownerId: 'barber-1' } },
        { _id: 'booking-2', shopId: { _id: 'shop-1', ownerId: 'barber-1' } },
        { _id: 'booking-3', shopId: { _id: 'shop-2', ownerId: 'barber-2' } },
    ]));

    t.mock.method(paymentRepository, 'findCompletedByBookingIds', async () => ([
        { bookingId: 'booking-1', settlement: { serviceAmount: 9900 } },
        { bookingId: 'booking-2', settlement: { serviceAmount: 15000 } },
        { bookingId: 'booking-3', settlement: { serviceAmount: 42500 } },
    ]));

    const triggerCalls = [];
    const triggerBarberPayout = async (barberId, bookingIds, totalPayoutInPaisa) => {
        triggerCalls.push({ barberId, bookingIds, totalPayoutInPaisa });
        return { barberId, bookingIds, totalPayoutInPaisa };
    };

    const result = await payoutBatchJob.runPayoutBatchNow({ triggerBarberPayout });

    assert.deepEqual(triggerCalls, [
        {
            barberId: 'barber-1',
            bookingIds: ['booking-1', 'booking-2'],
            totalPayoutInPaisa: 24900,
        },
        {
            barberId: 'barber-2',
            bookingIds: ['booking-3'],
            totalPayoutInPaisa: 42500,
        },
    ]);
    assert.deepEqual(result, {
        totalBookings: 3,
        uniqueBarbers: 2,
        success: 2,
        failed: 0,
    });
});

test('runPayoutBatchNow prefers barberPayout when settlement values diverge from serviceAmount', async (t) => {
    t.mock.method(bookingRepository, 'findCompletedWithPendingPayout', async () => ([
        { _id: 'booking-1', shopId: { _id: 'shop-1', ownerId: 'barber-1' } },
    ]));

    t.mock.method(paymentRepository, 'findCompletedByBookingIds', async () => ([
        {
            bookingId: 'booking-1',
            settlement: {
                serviceAmount: 12000,
                barberPayout: 9900,
            },
        },
    ]));

    const triggerCalls = [];
    const triggerBarberPayout = async (barberId, bookingIds, totalPayoutInPaisa) => {
        triggerCalls.push({ barberId, bookingIds, totalPayoutInPaisa });
        return { barberId, bookingIds, totalPayoutInPaisa };
    };

    await payoutBatchJob.runPayoutBatchNow({ triggerBarberPayout });

    assert.deepEqual(triggerCalls, [
        {
            barberId: 'barber-1',
            bookingIds: ['booking-1'],
            totalPayoutInPaisa: 9900,
        },
    ]);
});

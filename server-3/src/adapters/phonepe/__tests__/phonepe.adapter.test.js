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

const phonePeAdapter = (await import('../phonepe.adapter.js')).default;
const tokenManager = (await import('../phonepe-token.manager.js')).default;

test('createOrder calls PhonePe SDK order API and returns native SDK token data', async (t) => {
    t.mock.method(tokenManager, 'getToken', async () => 'access-token');

    let capturedRequest = null;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        capturedRequest = {
            url,
            method: options.method,
            headers: options.headers,
            body: JSON.parse(options.body),
        };

        return new Response(JSON.stringify({
            orderId: 'OMO-native-1',
            token: 'sdk-order-token',
            state: 'PENDING',
            expireAt: 1777037869000,
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    });

    const result = await phonePeAdapter.createOrder({
        merchantOrderId: 'EC-booking-1-native',
        amount: 12300,
        metadata: {
            bookingId: 'booking-1',
            customerId: 'customer-1',
            shopId: 'shop-1',
        },
    });

    assert.match(capturedRequest.url, /\/checkout\/v2\/sdk\/order$/);
    assert.equal(capturedRequest.method, 'POST');
    assert.equal(capturedRequest.headers.Authorization, 'O-Bearer access-token');
    assert.equal(capturedRequest.body.merchantOrderId, 'EC-booking-1-native');
    assert.equal(capturedRequest.body.amount, 12300);
    assert.equal(capturedRequest.body.expireAfter, 1200);
    assert.deepEqual(capturedRequest.body.paymentFlow, {
        type: 'PG_CHECKOUT',
    });
    assert.equal(capturedRequest.body.paymentFlow.merchantUrls, undefined);
    assert.equal(capturedRequest.body.redirectUrl, undefined);
    assert.deepEqual(capturedRequest.body.metaInfo, {
        udf1: 'booking-1',
        udf2: 'customer-1',
        udf3: 'shop-1',
    });
    assert.deepEqual(result, {
        orderId: 'OMO-native-1',
        token: 'sdk-order-token',
        state: 'PENDING',
        expiresAt: 1777037869000,
    });
});

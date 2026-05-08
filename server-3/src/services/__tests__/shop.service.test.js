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

const customerRepository = (await import('../../repositories/customer.repository.js')).default;
const photoRepository = (await import('../../repositories/photo.repository.js')).default;
const shopRepository = (await import('../../repositories/shop.repository.js')).default;
const notificationEvents = (await import('../notification-events.service.js')).default;
const shopService = await import('../shop.service.js');

test('getFavoriteShops returns a paginated customer favorite shop list', async (t) => {
    t.mock.method(customerRepository, 'findFavoriteShopsByUserId', async () => ({
        favoriteShops: [
            { _id: 'shop-1', shopName: 'One' },
            { _id: 'shop-2', shopName: 'Two' },
        ],
    }));

    const result = await shopService.getFavoriteShops('user-1', { page: 1, limit: 1 });

    assert.equal(result.items[0].id, 'shop-1');
    assert.equal(result.items[0].id, 'shop-1');
    assert.equal('shopId' in result.items[0], false);
    assert.equal(result.items[0].shopName, 'One');
    assert.equal('_id' in result.items[0], false);
    assert.deepEqual(result.pagination, {
        currentPage: 1,
        totalPages: 2,
        totalDocuments: 2,
        hasNextPage: true,
        hasPrevPage: false,
    });
});

test('removeFavoriteShop removes an existing favorite shop', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({
        _id: 'customer-1',
        favoriteShops: ['shop-1'],
    }));

    let removed = null;
    t.mock.method(customerRepository, 'removeFavoriteShop', async (userId, shopId) => {
        removed = { userId, shopId };
        return { _id: 'customer-1' };
    });

    const result = await shopService.removeFavoriteShop('user-1', 'shop-1');

    assert.deepEqual(removed, { userId: 'user-1', shopId: 'shop-1' });
    assert.deepEqual(result, {
        favorite: false,
        shopId: 'shop-1',
    });
});

test('removeFavoriteShop is idempotent when the shop is no longer visible', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({
        _id: 'customer-1',
        favoriteShops: ['shop-1'],
    }));
    t.mock.method(shopRepository, 'findById', async () => {
        throw new Error('remove should not require the shop document to exist');
    });

    let removed = null;
    t.mock.method(customerRepository, 'removeFavoriteShop', async (userId, shopId) => {
        removed = { userId, shopId };
        return { _id: 'customer-1' };
    });

    const result = await shopService.removeFavoriteShop('user-1', 'shop-1');

    assert.deepEqual(removed, { userId: 'user-1', shopId: 'shop-1' });
    assert.deepEqual(result, {
        favorite: false,
        shopId: 'shop-1',
    });
});

test('updateBusinessInfo persists desired open state and emits a shop-status notification', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
        breakTimes: [],
    }));
    t.mock.method(photoRepository, 'findByShopId', async () => []);

    let updateArgs = null;
    t.mock.method(shopRepository, 'updateByOwnerId', async (ownerId, updateData) => {
        updateArgs = { ownerId, updateData };
        return {
            _id: 'shop-1',
            ...updateData,
        };
    });

    let accountUpdate = null;
    t.mock.method(notificationEvents, 'notifyAccountUpdated', async (payload) => {
        accountUpdate = payload;
    });

    let statusUpdate = null;
    t.mock.method(notificationEvents, 'notifyShopStatusUpdated', async (payload) => {
        statusUpdate = payload;
    });

    const result = await shopService.updateBusinessInfo('owner-1', { isOpen: false }, {});

    assert.deepEqual(updateArgs, {
        ownerId: 'owner-1',
        updateData: { isOpen: false },
    });
    assert.deepEqual(accountUpdate, {
        userId: 'owner-1',
        updateType: 'shop_profile',
    });
    assert.deepEqual(statusUpdate, {
        ownerId: 'owner-1',
        shopId: 'shop-1',
        isOpen: false,
    });
    assert.equal(result.shop.isOpen, false);
    assert.deepEqual(result.updatedFields, ['isOpen']);
});

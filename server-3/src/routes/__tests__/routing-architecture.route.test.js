import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', '..');
const serverDir = path.resolve(srcDir, '..');

const readSource = (relativePath) => readFile(path.join(srcDir, relativePath), 'utf8');

const exists = async (relativePath) => {
    try {
        await access(path.join(srcDir, relativePath), fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
};

test('route index mounts feature-oriented resources instead of legacy role prefixes', async () => {
    const source = await readSource('routes/index.js');

    for (const routePrefix of [
        '/auth',
        '/onboarding',
        '/customers',
        '/shops',
        '/employees',
        '/services',
        '/bookings',
        '/photos',
        '/ratings',
        '/earnings',
        '/payments',
        '/payouts',
        '/notifications',
    ]) {
        assert.match(source, new RegExp(`router\\.use\\('${routePrefix.replace('/', '\\/')}`));
    }

    assert.doesNotMatch(source, /router\.use\('\/customer'/);
    assert.doesNotMatch(source, /router\.use\('\/barber'/);
    assert.doesNotMatch(source, /router\.use\('\/favorites'/);
});

test('legacy role-prefixed route and controller files are removed after the migration', async () => {
    const removedPaths = [
        'routes/customer.routes.js',
        'routes/barber.routes.js',
        'controllers/customer/customer-profile.controller.js',
        'controllers/customer/customer-shop.controller.js',
        'controllers/customer/customer-rating.controller.js',
        'controllers/customer/customer-booking.controller.js',
        'controllers/barber/barber-profile.controller.js',
        'controllers/barber/barber-shop.controller.js',
        'controllers/barber/barber-employee.controller.js',
        'controllers/barber/barber-service.controller.js',
        'controllers/barber/barber-booking.controller.js',
        'controllers/barber/barber-photo.controller.js',
        'controllers/barber/barber-earnings.controller.js',
        'controllers/barber/barber-rating.controller.js',
    ];

    for (const relativePath of removedPaths) {
        assert.equal(
            await exists(relativePath),
            false,
            `expected ${relativePath} to be removed`,
        );
    }
});

test('postman collection generator no longer emits legacy /customer or /barber URLs', async () => {
    const source = await readFile(
        path.join(serverDir, 'scripts', 'regenerate-postman-collections.mjs'),
        'utf8',
    );

    assert.doesNotMatch(source, /\/customer\//);
    assert.doesNotMatch(source, /\/barber\//);
});

test('feature routes and controllers use simple direct files instead of module index wrappers', async () => {
    const expectedPaths = [
        'routes/auth.routes.js',
        'routes/bookings.routes.js',
        'routes/customers.routes.js',
        'routes/earnings.routes.js',
        'routes/employees.routes.js',
        'routes/onboarding.routes.js',
        'routes/payment.routes.js',
        'routes/payout.routes.js',
        'routes/photos.routes.js',
        'routes/ratings.routes.js',
        'routes/notifications.routes.js',
        'routes/services.routes.js',
        'routes/shops.routes.js',
        'controllers/auth.controller.js',
        'controllers/booking.controller.js',
        'controllers/customer.controller.js',
        'controllers/earnings.controller.js',
        'controllers/employee.controller.js',
        'controllers/onboarding.controller.js',
        'controllers/payment.controller.js',
        'controllers/payout.controller.js',
        'controllers/photo.controller.js',
        'controllers/rating.controller.js',
        'controllers/notification.controller.js',
        'controllers/service.controller.js',
        'controllers/shop.controller.js',
    ];

    const removedIndexWrappers = [
        'routes/auth/index.js',
        'routes/bookings/index.js',
        'routes/customers/index.js',
        'routes/earnings/index.js',
        'routes/employees/index.js',
        'routes/favorites/index.js',
        'routes/onboarding/index.js',
        'routes/payments/index.js',
        'routes/payouts/index.js',
        'routes/photos/index.js',
        'routes/ratings/index.js',
        'routes/services/index.js',
        'routes/shops/index.js',
        'controllers/auth/index.js',
        'controllers/bookings/index.js',
        'controllers/customers/index.js',
        'controllers/earnings/index.js',
        'controllers/employees/index.js',
        'controllers/favorites/index.js',
        'controllers/onboarding/index.js',
        'controllers/payments/index.js',
        'controllers/payouts/index.js',
        'controllers/photos/index.js',
        'controllers/ratings/index.js',
        'controllers/services/index.js',
        'controllers/shops/index.js',
        'routes/favorites.routes.js',
        'controllers/favorite.controller.js',
        'services/favorites.service.js',
    ];

    for (const relativePath of expectedPaths) {
        assert.equal(
            await exists(relativePath),
            true,
            `expected ${relativePath} to exist`,
        );
    }

    for (const relativePath of removedIndexWrappers) {
        assert.equal(
            await exists(relativePath),
            false,
            `expected ${relativePath} to be removed`,
        );
    }
});

test('payment and payout controllers use the direct flat controller files', async () => {
    const paymentRoutes = await readSource('routes/payment.routes.js');
    const payoutRoutes = await readSource('routes/payout.routes.js');

    for (const removedPath of [
        'controllers/payment/payment.controller.js',
        'controllers/payment/webhook.controller.js',
        'controllers/payout/payout.controller.js',
        'controllers/payout/payout-webhook.controller.js',
    ]) {
        assert.equal(
            await exists(removedPath),
            false,
            `expected ${removedPath} to be removed`,
        );
    }

    assert.match(paymentRoutes, /\.\.\/controllers\/payment\.controller\.js/);
    assert.doesNotMatch(paymentRoutes, /\.\.\/controllers\/payment\//);

    assert.match(payoutRoutes, /\.\.\/controllers\/payout\.controller\.js/);
    assert.doesNotMatch(payoutRoutes, /\.\.\/controllers\/payout\//);
});

test('booking discovery and payment routes use final resource-oriented URLs', async () => {
    const bookingRoutes = await readSource('routes/bookings.routes.js');
    const shopRoutes = await readSource('routes/shops.routes.js');
    const paymentRoutes = await readSource('routes/payment.routes.js');
    const postmanSource = await readFile(
        path.join(serverDir, 'scripts', 'regenerate-postman-collections.mjs'),
        'utf8',
    );

    assert.match(shopRoutes, /router\.get\('\/:id\/employees'/);
    assert.match(shopRoutes, /router\.get\('\/:id\/availability'/);
    assert.match(shopRoutes, /router\.get\('\/:id\/ratings'/);
    assert.match(shopRoutes, /router\.get\('\/:id\/ratings\/analytics'/);
    assert.doesNotMatch(bookingRoutes, /\/shops\/:id\/availability/);
    assert.doesNotMatch(bookingRoutes, /\/shops\/:id\/employees/);

    assert.match(paymentRoutes, /router\.post\(\s*'\/'/);
    assert.match(paymentRoutes, /router\.post\(\s*'\/:id\/verify'/);
    assert.match(paymentRoutes, /router\.get\(\s*'\/:id'/);
    assert.doesNotMatch(paymentRoutes, /\/initiate/);
    assert.doesNotMatch(paymentRoutes, /\/booking\/:bookingId/);
    assert.doesNotMatch(paymentRoutes, /\/redirect/);

    assert.doesNotMatch(bookingRoutes, /\/:id\/payment/);
    assert.match(bookingRoutes, /\/:id\/refunds/);
    assert.match(bookingRoutes, /router\.patch\('\/:id'/);
    assert.doesNotMatch(bookingRoutes, /\/:id\/confirm/);
    assert.doesNotMatch(bookingRoutes, /\/:id\/cancel/);
    assert.doesNotMatch(bookingRoutes, /\/:id\/reschedule/);
    assert.doesNotMatch(bookingRoutes, /\/:id\/reorder/);
    assert.doesNotMatch(bookingRoutes, /\/status/);
    assert.doesNotMatch(bookingRoutes, /analytics\/summary/);
    assert.doesNotMatch(bookingRoutes, /analytics\/milestones/);
    assert.doesNotMatch(bookingRoutes, /analytics\/today/);
    assert.doesNotMatch(bookingRoutes, /analytics\/queue/);
    assert.match(bookingRoutes, /router\.get\('\/analytics'/);
    assert.match(bookingRoutes, /router\.patch\('\/:id\/favorite'/);
    assert.doesNotMatch(bookingRoutes, /router\.put\('\/:id\/favorite'/);
    assert.doesNotMatch(bookingRoutes, /router\.delete\('\/:id\/favorite'/);
    assert.doesNotMatch(bookingRoutes, /\/pending-confirmations/);
    assert.doesNotMatch(bookingRoutes, /router\.delete\('\/:id'/);
    assert.doesNotMatch(postmanSource, /analytics\/summary/);
    assert.doesNotMatch(postmanSource, /analytics\/milestones/);
    assert.doesNotMatch(postmanSource, /analytics\/today/);
    assert.doesNotMatch(postmanSource, /analytics\/queue/);

    assert.doesNotMatch(postmanSource, /\/bookings\/shops/);
    assert.doesNotMatch(postmanSource, /\/payments\/initiate/);
    assert.doesNotMatch(postmanSource, /\/payments\/booking/);
    assert.doesNotMatch(postmanSource, /\/bookings\/\{\{booking_id\}\}\/confirmation/);
    assert.doesNotMatch(postmanSource, /\/bookings\/\{\{booking_id\}\}\/reschedule/);
    assert.doesNotMatch(postmanSource, /\/bookings\/\{\{booking_id\}\}\/reorder/);
    assert.doesNotMatch(postmanSource, /\/bookings\/\{\{booking_id_delete\}\}\/cancel/);
});

test('favorite behavior is grouped by booking and shop flow, not a favorites module', async () => {
    const indexSource = await readSource('routes/index.js');
    const bookingRoutes = await readSource('routes/bookings.routes.js');
    const shopRoutes = await readSource('routes/shops.routes.js');
    const postmanSource = await readFile(
        path.join(serverDir, 'scripts', 'regenerate-postman-collections.mjs'),
        'utf8',
    );

    assert.doesNotMatch(indexSource, /favoritesRoutes/);
    assert.doesNotMatch(indexSource, /\/favorites/);
    assert.equal(await exists('routes/favorites.routes.js'), false);
    assert.equal(await exists('controllers/favorite.controller.js'), false);
    assert.equal(await exists('services/favorites.service.js'), false);

    assert.match(bookingRoutes, /router\.patch\('\/:id\/favorite'/);
    assert.doesNotMatch(bookingRoutes, /router\.put\('\/:id\/favorite'/);
    assert.doesNotMatch(bookingRoutes, /router\.delete\('\/:id\/favorite'/);

    assert.match(shopRoutes, /router\.get\('\/favorites'/);
    assert.match(shopRoutes, /router\.patch\('\/:id\/favorite'/);
    assert.doesNotMatch(shopRoutes, /router\.put\('\/:id\/favorite'/);
    assert.doesNotMatch(shopRoutes, /router\.delete\('\/:id\/favorite'/);
    assert.ok(
        shopRoutes.indexOf("router.get('/favorites'") < shopRoutes.indexOf("router.get('/:id'"),
        'GET /shops/favorites must be registered before GET /shops/:id',
    );

    assert.doesNotMatch(postmanSource, /\/favorites\//);
    assert.match(postmanSource, /\/bookings\{\{booking_id\}\}\/favorite|\/bookings\/\{\{booking_id\}\}\/favorite/);
    assert.match(postmanSource, /\/bookings\?favorite=true/);
    assert.match(postmanSource, /\/shops\/favorites/);
    assert.match(postmanSource, /\/shops\/\{\{shop_id\}\}\/favorite/);
});

test('shops and employees expose the normalized me, payout, availability, and analytics resources', async () => {
    const accountRoutes = await readSource('routes/account.routes.js');
    const shopRoutes = await readSource('routes/shops.routes.js');
    const employeeRoutes = await readSource('routes/employees.routes.js');
    const postmanSource = await readFile(
        path.join(serverDir, 'scripts', 'regenerate-postman-collections.mjs'),
        'utf8',
    );

    assert.match(shopRoutes, /router\.get\('\/me'/);
    assert.match(shopRoutes, /router\.patch\('\/me'/);
    assert.match(shopRoutes, /\/me\/payout-details/);
    assert.match(shopRoutes, /\/me\/security/);
    assert.match(shopRoutes, /\/me\/media\/picture/);
    assert.match(shopRoutes, /\/me\/media\/cover/);
    assert.doesNotMatch(shopRoutes, /\/upi/);
    assert.doesNotMatch(shopRoutes, /\/bank-details/);
    assert.doesNotMatch(shopRoutes, /\/me\/status/);
    assert.doesNotMatch(shopRoutes, /\/me\/pin/);
    assert.doesNotMatch(shopRoutes, /\/me\/picture/);
    assert.doesNotMatch(shopRoutes, /\/me\/cover/);
    assert.doesNotMatch(shopRoutes, /sign-out-everywhere/);

    assert.match(accountRoutes, /router\.delete\(\s*'\/sessions'/);
    assert.match(accountRoutes, /router\.delete\(\s*'\/'/);

    assert.match(employeeRoutes, /\/:id\/availability/);
    assert.match(employeeRoutes, /\/analytics/);
    assert.match(employeeRoutes, /\/:id\/blocked-dates/);
    assert.ok(
        employeeRoutes.indexOf("router.get('/analytics'") < employeeRoutes.indexOf("router.get(\n    '/:id/availability'"),
        'GET /employees/analytics must be registered before GET /employees/:id/availability',
    );
    assert.doesNotMatch(employeeRoutes, /available-slots/);
    assert.doesNotMatch(employeeRoutes, /\/:id\/calendar/);
    assert.doesNotMatch(employeeRoutes, /\/:id\/status/);

    assert.match(postmanSource, /\/shops\/me/);
    assert.doesNotMatch(postmanSource, /\/employees\/\{\{employee_id\}\}\/available-slots/);
    assert.doesNotMatch(postmanSource, /\/employees\/\{\{employee_id\}\}\/calendar/);
    assert.match(postmanSource, /\/shops\/me\/payout-details/);
    assert.match(postmanSource, /\/employees\/\{\{employee_id\}\}\/availability/);
});

test('payments expose a collection list before the payment-id route', async () => {
    const paymentRoutes = await readSource('routes/payment.routes.js');

    assert.match(paymentRoutes, /router\.get\(\s*'\/'\s*,[\s\S]*paymentController\.getPayments/);
    assert.match(paymentRoutes, /router\.get\(\s*'\/:id'\s*,[\s\S]*paymentController\.getPaymentStatus/);
    assert.ok(
        paymentRoutes.indexOf("router.get(\n    '/',") < paymentRoutes.indexOf("router.get(\n    '/:id'"),
        'GET /payments must be registered before GET /payments/:id',
    );
});

test('changed resource routes require the expected authentication and role guards', async () => {
    const bookingRoutes = await readSource('routes/bookings.routes.js');
    const shopRoutes = await readSource('routes/shops.routes.js');
    const ratingRoutes = await readSource('routes/ratings.routes.js');
    const employeeRoutes = await readSource('routes/employees.routes.js');
    const notificationRoutes = await readSource('routes/notifications.routes.js');
    const paymentRoutes = await readSource('routes/payment.routes.js');
    const payoutRoutes = await readSource('routes/payout.routes.js');

    assert.match(bookingRoutes, /router\.use\(authenticate\)/);
    assert.match(bookingRoutes, /router\.post\('\/', authorize\(ROLES\.CUSTOMER\)/);
    assert.match(bookingRoutes, /router\.get\('\/', authorize\(ROLES\.CUSTOMER, ROLES\.BARBER\)/);
    assert.match(bookingRoutes, /router\.get\('\/analytics', authorize\(ROLES\.BARBER\)/);
    assert.match(bookingRoutes, /router\.patch\('\/:id\/favorite', authorize\(ROLES\.CUSTOMER\)/);
    assert.match(bookingRoutes, /router\.post\('\/:id\/refunds', authorize\(ROLES\.ADMIN, ROLES\.BARBER\)/);

    assert.match(shopRoutes, /router\.get\('\/favorites', authenticate, authorize\(ROLES\.CUSTOMER\)/);
    assert.match(shopRoutes, /router\.patch\('\/me', authenticate, authorize\(ROLES\.BARBER\)/);
    assert.match(shopRoutes, /router\.patch\('\/me\/security', authenticate, authorize\(ROLES\.BARBER\)/);
    assert.match(shopRoutes, /router\.patch\('\/me\/media\/picture', authenticate, authorize\(ROLES\.BARBER\)/);
    assert.match(shopRoutes, /router\.patch\('\/me\/media\/cover', authenticate, authorize\(ROLES\.BARBER\)/);
    assert.match(shopRoutes, /router\.get\('\/:id\/availability', authenticate, authorize\(ROLES\.CUSTOMER, ROLES\.BARBER\)/);
    assert.match(shopRoutes, /router\.patch\('\/:id\/favorite', authenticate, authorize\(ROLES\.CUSTOMER\)/);

    assert.match(ratingRoutes, /router\.use\(authenticate\)/);
    assert.match(ratingRoutes, /router\.get\('\/analytics', authorize\(ROLES\.BARBER\)/);
    assert.match(ratingRoutes, /router\.get\('\/', authorize\(ROLES\.BARBER\)/);
    assert.match(ratingRoutes, /router\.post\('\/', authorize\(ROLES\.CUSTOMER\)/);
    assert.match(ratingRoutes, /router\.put\('\/:id\/reply', authorize\(ROLES\.BARBER\)/);
    assert.match(ratingRoutes, /router\.delete\('\/:id\/reply', authorize\(ROLES\.BARBER\)/);
    assert.match(ratingRoutes, /router\.delete\('\/:id', authorize\(ROLES\.BARBER\)/);

    assert.match(employeeRoutes, /router\.use\(authenticate\)/);
    assert.match(employeeRoutes, /router\.get\('\/analytics', authorize\(ROLES\.BARBER\)/);
    assert.match(employeeRoutes, /router\.get\(\s*'\/:id\/availability',\s*authorize\(ROLES\.CUSTOMER, ROLES\.BARBER\)/);
    assert.match(employeeRoutes, /router\.use\(authorize\(ROLES\.BARBER\)\)/);

    assert.match(notificationRoutes, /router\.use\(authenticate\)/);
    assert.doesNotMatch(notificationRoutes, /authorize\(ROLES\./);

    assert.match(paymentRoutes, /router\.post\('\/webhook', paymentController\.handleWebhook\)/);
    assert.match(paymentRoutes, /authorize\(ROLES\.CUSTOMER, ROLES\.BARBER, ROLES\.ADMIN\)/);
    assert.match(paymentRoutes, /authorize\(ROLES\.CUSTOMER\)/);
    assert.match(payoutRoutes, /router\.post\('\/webhook', payoutController\.handlePayoutWebhook\)/);
    assert.match(payoutRoutes, /authorize\(ROLES\.ADMIN\)/);
});

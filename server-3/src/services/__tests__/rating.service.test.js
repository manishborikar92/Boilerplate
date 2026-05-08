import assert from 'node:assert/strict';
import test from 'node:test';

import bookingRepository from '../../repositories/booking.repository.js';
import customerRepository from '../../repositories/customer.repository.js';
import ratingRepository from '../../repositories/rating.repository.js';
import shopRepository from '../../repositories/shop.repository.js';
import * as ratingService from '../rating.service.js';

test('addRating translates duplicate-key writes and normalizes blank reviews', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));
    t.mock.method(shopRepository, 'findById', async () => ({ _id: 'shop-1' }));
    t.mock.method(bookingRepository, 'hasCompletedBookingForCustomer', async () => true);
    t.mock.method(ratingRepository, 'findByCustomerAndShop', async () => null);

    let createPayload = null;
    t.mock.method(ratingRepository, 'create', async (payload) => {
        createPayload = payload;
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
    });

    await assert.rejects(
        () => ratingService.addRating('user-1', 'shop-1', 5, '   '),
        {
            name: 'ConflictError',
            message: 'You have already rated this shop',
        },
    );

    assert.deepEqual(createPayload, {
        customerId: 'customer-1',
        shopId: 'shop-1',
        rating: 5,
        review: undefined,
    });
});

test('addRating rejects customers who have no completed booking for the target shop', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));
    t.mock.method(shopRepository, 'findById', async () => ({ _id: 'shop-1' }));
    t.mock.method(bookingRepository, 'hasCompletedBookingForCustomer', async () => false);

    await assert.rejects(
        () => ratingService.addRating('user-1', 'shop-1', 5, 'Great visit'),
        {
            name: 'ForbiddenError',
            message: 'You can only rate shops where you have a completed booking',
        },
    );
});

test('getRatingsByShop returns 404 when the shop does not exist', async (t) => {
    t.mock.method(shopRepository, 'findById', async () => null);

    await assert.rejects(
        () => ratingService.getRatingsByShop('missing-shop', { page: 1, limit: 10 }),
        {
            name: 'NotFoundError',
            message: 'Shop not found',
        },
    );
});

test('getRatingSummaryForBarber resolves the owned shop before aggregating ratings', async (t) => {
    const shopId = '64b7f4c2a9d3f1b2c8e4d001';

    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: shopId }));
    t.mock.method(shopRepository, 'findById', async () => ({ _id: shopId }));
    t.mock.method(ratingRepository, 'getShopSummary', async (shopId) => ({
        shopId,
        averageRating: 4.8,
        totalReviews: 12,
        stars: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 10 },
    }));

    const result = await ratingService.getRatingSummaryForBarber('owner-1');

    assert.deepEqual(result, {
        shopId,
        averageRating: 4.8,
        totalReviews: 12,
        stars: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 10 },
    });
});

test('upsertReplyToRating creates a first reply and notifies the customer', async (t) => {
    const repliedAt = new Date('2026-03-20T08:30:00.000Z');

    t.mock.method(ratingRepository, 'findById', async () => ({
        _id: 'rating-1',
        shopId: 'shop-1',
    }));
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));

    let addArgs = null;
    t.mock.method(ratingRepository, 'addReply', async (ratingId, replyText, repliedBy) => {
        addArgs = { ratingId, replyText, repliedBy };
        return {
            _id: 'rating-1',
            rating: 5,
            review: 'Great service',
            customerId: {
                firstName: 'Ava',
                lastName: 'Customer',
                photoUrl: 'https://example.com/customer.jpg',
            },
            reply: {
                text: replyText,
                repliedAt,
            },
        };
    });

    const notificationEvents = await import('../notification-events.service.js');
    let notifyArgs = null;
    t.mock.method(notificationEvents.default, 'notifyRatingReply', async (payload) => {
        notifyArgs = payload;
    });

    const result = await ratingService.upsertReplyToRating('rating-1', '  Thanks for visiting  ', 'owner-1');

    assert.deepEqual(addArgs, {
        ratingId: 'rating-1',
        replyText: 'Thanks for visiting',
        repliedBy: 'owner-1',
    });
    assert.deepEqual(notifyArgs, {
        ratingId: 'rating-1',
        actorUserId: 'owner-1',
    });
    assert.equal(result.reply.text, 'Thanks for visiting');
});

test('upsertReplyToRating updates an existing reply without sending a duplicate notification', async (t) => {
    const repliedAt = new Date('2026-03-20T08:30:00.000Z');
    const createdAt = new Date('2026-03-19T08:30:00.000Z');
    const updatedAt = new Date('2026-03-20T08:30:00.000Z');

    t.mock.method(ratingRepository, 'findById', async () => ({
        _id: 'rating-1',
        shopId: 'shop-1',
        reply: { text: 'Old reply' },
    }));
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));

    let updateArgs = null;
    t.mock.method(ratingRepository, 'updateReply', async (ratingId, replyText, repliedBy) => {
        updateArgs = { ratingId, replyText, repliedBy };
        return {
            _id: 'rating-1',
            rating: 5,
            review: 'Great service',
            customerId: {
                firstName: 'Ava',
                lastName: 'Customer',
                photoUrl: 'https://example.com/customer.jpg',
                userId: { email: 'should-not-leak@example.com' },
            },
            reply: {
                text: replyText,
                repliedAt,
            },
            createdAt,
            updatedAt,
        };
    });

    const notificationEvents = await import('../notification-events.service.js');
    let notified = false;
    t.mock.method(notificationEvents.default, 'notifyRatingReply', async () => {
        notified = true;
    });

    const result = await ratingService.upsertReplyToRating('rating-1', '  Updated reply  ', 'owner-1');

    assert.deepEqual(updateArgs, {
        ratingId: 'rating-1',
        replyText: 'Updated reply',
        repliedBy: 'owner-1',
    });
    assert.deepEqual(result.user, {
        firstName: 'Ava',
        lastName: 'Customer',
        photoUrl: 'https://example.com/customer.jpg',
    });
    assert.equal('email' in result.user, false);
    assert.deepEqual(result.reply, {
        text: 'Updated reply',
        repliedAt,
    });
    assert.equal(notified, false);
});

test('removeRating uses ForbiddenError when the rating belongs to a different shop', async (t) => {
    t.mock.method(ratingRepository, 'findById', async () => ({
        _id: 'rating-1',
        shopId: 'shop-2',
    }));
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));

    await assert.rejects(
        () => ratingService.removeRating('rating-1', 'owner-1'),
        {
            name: 'ForbiddenError',
            message: 'You can only remove ratings on your own shop',
        },
    );
});

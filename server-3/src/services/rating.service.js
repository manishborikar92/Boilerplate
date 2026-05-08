import ratingRepository from '../repositories/rating.repository.js';
import bookingRepository from '../repositories/booking.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import {
    NotFoundError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
} from '../utils/api-error.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { serializeRating } from '../utils/rating-response.utils.js';
import notificationEvents from './notification-events.service.js';
import { sanitizeForResponse } from '../serializers/core.serializer.js';

/**
 * Rating service.
 */

const normalizeOptionalReview = (review) => {
    if (review === undefined || review === null) return undefined;

    const normalized = String(review).trim();
    return normalized || undefined;
};

const normalizeReplyText = (replyText) => {
    const normalized = String(replyText ?? '').trim();

    if (!normalized) {
        throw new BadRequestError('Reply text is required');
    }

    if (normalized.length > 500) {
        throw new BadRequestError('Reply text cannot exceed 500 characters');
    }

    return normalized;
};

const getOwnedShop = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');
    return sanitizeForResponse(shop);
};

const assertShopExists = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');
    return sanitizeForResponse(shop);
};

const assertRatingBelongsToShop = (rating, shop, message) => {
    if (String(rating.shopId) !== String(shop.id)) {
        throw new ForbiddenError(message);
    }
};

export const addRating = async (userId, shopId, rating, review) => {
    if (!shopId || !rating) throw new BadRequestError('shopId and rating are required');

    const normalizedReview = normalizeOptionalReview(review);

    const [customer, shop] = await Promise.all([
        customerRepository.findByUserId(userId),
        shopRepository.findById(shopId),
    ]);

    if (!customer) throw new NotFoundError('Customer profile');
    const customerId = customer._id;
    if (!shop) throw new NotFoundError('Shop');

    const hasCompletedBooking = await bookingRepository.hasCompletedBookingForCustomer(customerId, shopId);
    if (!hasCompletedBooking) {
        throw new ForbiddenError('You can only rate shops where you have a completed booking');
    }

    const existing = await ratingRepository.findByCustomerAndShop(customerId, shopId);
    if (existing) throw new ConflictError('You have already rated this shop');

    try {
        const createdRating = await ratingRepository.create({
            customerId,
            shopId,
            rating,
            review: normalizedReview,
        });
        await notificationEvents.notifyRatingReceived({ ratingId: createdRating._id });

        return serializeRating(createdRating);
    } catch (error) {
        if (error?.code === 11000) {
            throw new ConflictError('You have already rated this shop');
        }

        throw error;
    }
};

export const getRatingsByShop = async (shopId, query = {}) => {
    await assertShopExists(shopId);

    const total = await ratingRepository.countByShop(shopId);
    const { skip, limit, pagination } = buildPagination(query, total);

    const ratings = await ratingRepository.findByShop(shopId, { skip, limit });
    const items = ratings.map(serializeRating);

    return { items, pagination };
};

export const getRatingSummary = async (shopId) => {
    await assertShopExists(shopId);
    return ratingRepository.getShopSummary(shopId);
};

export const getRatingSummaryForBarber = async (ownerId) => {
    const shop = await getOwnedShop(ownerId);
    return getRatingSummary(shop.id);
};

export const removeRating = async (ratingId, ownerId) => {
    const rating = await ratingRepository.findById(ratingId);
    if (!rating) throw new NotFoundError('Rating');

    const shop = await getOwnedShop(ownerId);
    assertRatingBelongsToShop(rating, shop, 'You can only remove ratings on your own shop');

    await ratingRepository.deleteById(ratingId);
    return { message: 'Rating deleted successfully' };
};

export const upsertReplyToRating = async (ratingId, replyText, ownerId) => {
    const normalizedReplyText = normalizeReplyText(replyText);

    const rating = await ratingRepository.findById(ratingId);
    if (!rating) throw new NotFoundError('Rating');

    const shop = await getOwnedShop(ownerId);
    assertRatingBelongsToShop(rating, shop, 'You can only reply to ratings on your own shop');

    const hasReply = Boolean(rating.reply?.text);
    const updatedRating = hasReply
        ? await ratingRepository.updateReply(ratingId, normalizedReplyText, ownerId)
        : await ratingRepository.addReply(ratingId, normalizedReplyText, ownerId);

    if (!hasReply) {
        await notificationEvents.notifyRatingReply({ ratingId, actorUserId: ownerId });
    }

    return serializeRating(updatedRating);
};

export const deleteReplyFromRating = async (ratingId, ownerId) => {
    const rating = await ratingRepository.findById(ratingId);
    if (!rating) throw new NotFoundError('Rating');

    const shop = await getOwnedShop(ownerId);
    assertRatingBelongsToShop(rating, shop, 'You can only delete replies on your own shop');

    if (!rating.reply || !rating.reply.text) {
        throw new BadRequestError('No reply exists for this rating');
    }

    await ratingRepository.deleteReply(ratingId);
    return { message: 'Reply deleted successfully' };
};

export const getRatingsByShopForBarber = async (ownerId, query = {}) => {
    const shop = await getOwnedShop(ownerId);
    return getRatingsByShop(shop.id, query);
};

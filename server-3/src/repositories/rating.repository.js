import mongoose from 'mongoose';
import Rating from '../models/rating.model.js';

const CUSTOMER_POPULATE = {
    path: 'customerId',
    select: 'firstName lastName photoUrl',
};

class RatingRepository {
    async create(data) {
        return Rating.create(data);
    }

    async findByCustomerAndShop(customerId, shopId) {
        return Rating.findOne({ customerId, shopId });
    }

    async countByShop(shopId) {
        return Rating.countDocuments({ shopId });
    }

    async findByShop(shopId, options = {}) {
        const query = Rating.find({ shopId })
            .populate(CUSTOMER_POPULATE)
            .sort({ createdAt: -1 });
            
        if (options.skip !== undefined) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        return query.lean();
    }

    async findById(id) {
        return Rating.findById(id);
    }

    async deleteById(id) {
        return Rating.findByIdAndDelete(id);
    }

    async getShopSummary(shopId) {
        const normalizedShopId = typeof shopId === 'string'
            ? new mongoose.Types.ObjectId(shopId)
            : shopId;

        const [summary] = await Rating.aggregate([
            { $match: { shopId: normalizedShopId } },
            {
                $group: {
                    _id: '$shopId',
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
                    twoStars: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                    threeStars: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                    fourStars: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                    fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                },
            },
        ]);

        if (!summary) {
            return {
                averageRating: 0,
                totalReviews: 0,
                stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            };
        }

        return {
            averageRating: Number(summary.averageRating.toFixed(1)),
            totalReviews: summary.totalReviews,
            stars: {
                1: summary.oneStar,
                2: summary.twoStars,
                3: summary.threeStars,
                4: summary.fourStars,
                5: summary.fiveStars,
            },
        };
    }

    async addReply(ratingId, replyText, repliedBy) {
        return Rating.findByIdAndUpdate(
            ratingId,
            {
                reply: {
                    text: replyText,
                    repliedAt: new Date(),
                    repliedBy,
                },
            },
            { returnDocument: 'after', runValidators: true },
        ).populate(CUSTOMER_POPULATE);
    }

    async updateReply(ratingId, replyText, repliedBy) {
        return Rating.findByIdAndUpdate(
            ratingId,
            {
                'reply.text': replyText,
                'reply.repliedAt': new Date(),
                'reply.repliedBy': repliedBy,
            },
            { returnDocument: 'after', runValidators: true },
        ).populate(CUSTOMER_POPULATE);
    }

    async deleteReply(ratingId) {
        return Rating.findByIdAndUpdate(
            ratingId,
            { $unset: { reply: '' } },
            { returnDocument: 'after' },
        ).populate(CUSTOMER_POPULATE);
    }
}

export default new RatingRepository();

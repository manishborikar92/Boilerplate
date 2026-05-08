import Notification from '../models/notification.model.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class NotificationRepository {
    async create(data) {
        return Notification.create(data);
    }

    async createIfNotExists(data) {
        try {
            const notification = await Notification.create(data);
            return { created: true, notification };
        } catch (error) {
            if (error?.code === 11000 && data.dedupeKey) {
                const notification = await Notification.findOne({ dedupeKey: data.dedupeKey });
                return { created: false, notification };
            }

            throw error;
        }
    }

    async listByRecipient(userId, filter = {}, options = {}) {
        const query = Notification.find(trustQueryOperators({
            recipientUserId: userId,
            ...filter,
        })).sort({ createdAt: -1 });

        if (options.skip !== undefined) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        return query.lean();
    }

    async countByRecipient(userId, filter = {}) {
        return Notification.countDocuments(trustQueryOperators({
            recipientUserId: userId,
            ...filter,
        }));
    }

    async countUnread(userId) {
        return Notification.countDocuments(trustQueryOperators({
            recipientUserId: userId,
            readAt: null,
        }));
    }

    async markRead(userId, notificationId) {
        return Notification.findOneAndUpdate(
            trustQueryOperators({
                _id: notificationId,
                recipientUserId: userId,
            }),
            {
                $set: {
                    readAt: new Date(),
                },
            },
            { returnDocument: 'after' },
        );
    }

    async markAllRead(userId) {
        return Notification.updateMany(
            trustQueryOperators({
                recipientUserId: userId,
                readAt: null,
            }),
            {
                $set: {
                    readAt: new Date(),
                },
            },
        );
    }

    async updateDeliveryStatus(id, updates) {
        return Notification.findByIdAndUpdate(
            id,
            { $set: updates },
            { returnDocument: 'after' },
        );
    }
}

export default new NotificationRepository();

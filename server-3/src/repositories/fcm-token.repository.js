import FcmToken from '../models/fcm-token.model.js';
import { FCM_PLATFORM } from '../utils/constants.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class FcmTokenRepository {
    async upsertForUserAndToken(userId, payload) {
        const now = new Date();
        return FcmToken.findOneAndUpdate(
            { token: payload.token },
            {
                $set: {
                    userId,
                    token: payload.token,
                    platform: payload.platform || FCM_PLATFORM.UNKNOWN,
                    deviceId: payload.deviceId || null,
                    appVersion: payload.appVersion || null,
                    locale: payload.locale || null,
                    lastSeenAt: now,
                    revokedAt: null,
                    failureReason: null,
                },
                $setOnInsert: {
                    failureCount: 0,
                    lastFailureAt: null,
                },
            },
            {
                upsert: true,
                returnDocument: 'after',
                runValidators: true,
            },
        );
    }

    async findActiveTokensByUserId(userId) {
        return FcmToken.find(trustQueryOperators({
            userId,
            revokedAt: null,
        })).sort({ lastSeenAt: -1 });
    }

    async revokeTokenForUser(userId, token) {
        return FcmToken.findOneAndUpdate(
            trustQueryOperators({
                userId,
                token,
                revokedAt: null,
            }),
            {
                $set: {
                    revokedAt: new Date(),
                },
            },
            { returnDocument: 'after' },
        );
    }

    async markInvalidTokens(tokens = [], reason = 'Invalid FCM token') {
        if (!tokens.length) {
            return { modifiedCount: 0 };
        }

        return FcmToken.updateMany(
            trustQueryOperators({ token: { $in: tokens } }),
            {
                $set: {
                    revokedAt: new Date(),
                    lastFailureAt: new Date(),
                    failureReason: reason,
                },
                $inc: {
                    failureCount: 1,
                },
            },
        );
    }
}

export default new FcmTokenRepository();

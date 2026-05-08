import logger from '../utils/logger.js';
import { NOTIFICATION_TYPE } from '../utils/constants.js';

const INVALID_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
]);

const toFcmDataValue = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};

export const normalizeFcmData = (data = {}) => Object.fromEntries(
    Object.entries(data)
        .map(([key, value]) => [key, toFcmDataValue(value)])
        .filter(([, value]) => value !== null),
);

const buildMulticastMessage = ({ tokens, payload }) => {
    const includeNotification = payload.type !== NOTIFICATION_TYPE.SILENT
        && Boolean(payload.title || payload.body);
    const data = normalizeFcmData({
        id: payload.id,
        type: payload.type,
        eventType: payload.eventType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        ...payload.data,
    });

    const message = {
        tokens,
        data,
        android: {
            priority: 'high',
        },
        apns: {
            headers: {
                'apns-priority': includeNotification ? '10' : '5',
            },
            payload: {
                aps: {
                    contentAvailable: true,
                },
            },
        },
        webpush: {
            headers: {
                Urgency: 'high',
            },
        },
    };

    if (includeNotification) {
        message.notification = {
            title: payload.title || 'EverCut',
            body: payload.body || '',
        };
        message.android.notification = {
            channelId: 'evercut_default',
            sound: 'default',
        };
        message.apns.payload.aps.sound = 'default';
        message.webpush.notification = {
            title: payload.title || 'EverCut',
            body: payload.body || '',
        };
    }

    return message;
};

export const sendMulticast = async ({ tokens = [], payload = {} }) => {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (uniqueTokens.length === 0) {
        return {
            successCount: 0,
            failureCount: 0,
            invalidTokens: [],
            failures: [],
        };
    }

    const { default: firebaseAdmin } = await import('../config/firebase.config.js');
    const message = buildMulticastMessage({ tokens: uniqueTokens, payload });
    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    const failures = [];
    const invalidTokens = [];

    response.responses.forEach((result, index) => {
        if (result.success) return;

        const token = uniqueTokens[index];
        const code = result.error?.code || 'messaging/unknown-error';
        const messageText = result.error?.message || 'FCM delivery failed';
        failures.push({ token, code, message: messageText });

        if (INVALID_TOKEN_CODES.has(code)) {
            invalidTokens.push(token);
        }
    });

    if (failures.length > 0) {
        logger.warn('[FcmService] Multicast delivery completed with failures', {
            successCount: response.successCount,
            failureCount: response.failureCount,
            invalidTokenCount: invalidTokens.length,
        });
    }

    return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        failures,
    };
};

const fcmService = {
    normalizeFcmData,
    sendMulticast,
};

export default fcmService;

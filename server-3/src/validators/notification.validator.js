import Joi from 'joi';

import { objectId, paginationSchema } from './common.validator.js';
import {
    ALL_FCM_PLATFORMS,
    ALL_NOTIFICATION_EVENTS,
    ALL_NOTIFICATION_TYPES,
} from '../utils/constants.js';

export const registerFcmTokenSchema = Joi.object({
    token: Joi.string().trim().min(1).max(4096).required(),
    platform: Joi.string().valid(...ALL_FCM_PLATFORMS).required(),
    deviceId: Joi.string().trim().max(128),
    appVersion: Joi.string().trim().max(64),
    locale: Joi.string().trim().max(32),
});

export const unregisterFcmTokenSchema = Joi.object({
    token: Joi.string().trim().min(1).max(4096).required(),
});

export const notificationListQuerySchema = paginationSchema.keys({
    read: Joi.boolean(),
    type: Joi.string().valid(...ALL_NOTIFICATION_TYPES),
    eventType: Joi.string().valid(...ALL_NOTIFICATION_EVENTS),
});

export const notificationIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const notificationPatchSchema = Joi.object({
    read: Joi.boolean().valid(true).required(),
});

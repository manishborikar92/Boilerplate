import Joi from 'joi';
import mongoose from 'mongoose';
import { toTwentyFourHourTime } from '../utils/time.utils.js';

/**
 * Common reusable validation rules.
 */

// Custom ObjectId validator
export const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
}, 'ObjectId validation');

// Pagination
export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
});

// Date string (YYYY-MM-DD)
export const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

// Time string accepted from either availability APIs (HH:MM) or legacy clients (hh:mm AM/PM).
export const timeString = Joi.string()
    .trim()
    .custom((value, helpers) => {
        const normalized = toTwentyFourHourTime(value);
        if (!normalized) return helpers.error('any.custom');
        return normalized;
    }, 'time normalization')
    .messages({
        'any.custom': 'time must use HH:MM or hh:mm AM/PM format',
    });

// Location GeoJSON
export const locationSchema = Joi.object({
    type: Joi.string().valid('Point').required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
});

// Generic :id route params
export const objectIdParamSchema = Joi.object({
    id: objectId.required(),
});

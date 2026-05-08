import Joi from 'joi';
import { objectId, dateString, timeString, paginationSchema } from './common.validator.js';

const bookingStatuses = ['pending', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'no-show'];
const paymentStatuses = ['pending', 'initiated', 'success', 'failed', 'refund_pending', 'refunded', 'refund_failed'];

const commaSeparatedEnum = (allowedValues, fieldName) => Joi.alternatives()
    .try(
        Joi.string().trim().min(1),
        Joi.array().items(Joi.string().trim().min(1)).min(1),
    )
    .custom((value, helpers) => {
        const rawValues = Array.isArray(value) ? value : String(value).split(',');
        const normalized = rawValues.map((entry) => String(entry).trim()).filter(Boolean);
        const invalid = normalized.find((entry) => !allowedValues.includes(entry));
        if (invalid) {
            return helpers.error('any.only', { value: invalid });
        }
        return normalized.length === 1 ? normalized[0] : normalized;
    }, `${fieldName} normalization`);

const createDirectBookingSchema = Joi.object({
    shopId: objectId.required(),
    employeeId: objectId.required(),
    serviceIds: Joi.array().items(objectId).min(1).required(),
    date: dateString.required(),
    time: timeString.required(),
    idempotencyKey: Joi.string().trim().max(128),
});

const createFromSourceBookingSchema = Joi.object({
    sourceBookingId: objectId.required(),
    date: dateString.required(),
    time: timeString.required(),
    idempotencyKey: Joi.string().trim().max(128),
});

export const createBookingSchema = Joi.alternatives()
    .try(createDirectBookingSchema, createFromSourceBookingSchema)
    .match('one');

const bookingSchedulePatchSchema = Joi.object({
    employeeId: objectId.required(),
    date: dateString.required(),
    time: timeString.required(),
});

const bookingStatusPatchSchema = Joi.object({
    status: Joi.string().valid('confirmed', 'completed', 'cancelled', 'no-show').required(),
});

export const bookingPatchSchema = Joi.alternatives()
    .try(bookingSchedulePatchSchema, bookingStatusPatchSchema)
    .match('one');

export const bookingListQuerySchema = paginationSchema.keys({
    // Customer-only filters
    favorite: Joi.boolean(),
    
    // Shared filters (both customer and barber)
    status: commaSeparatedEnum(bookingStatuses, 'status'),
    paymentStatus: commaSeparatedEnum(paymentStatuses, 'paymentStatus'),
    dateFrom: dateString,
    dateTo: dateString,
    
    // Barber-only filters
    employeeId: objectId,
});

export const bookingIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const bookingAnalyticsQuerySchema = Joi.object({
    month: Joi.number().integer().min(1).max(12),
    year: Joi.number().integer().min(2000).max(9999),
}).and('month', 'year');

export const favoritePatchSchema = Joi.object({
    favorite: Joi.boolean().required(),
});

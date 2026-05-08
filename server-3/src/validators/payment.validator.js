import Joi from 'joi';

import { ALL_PAYMENT_TRANSACTION_STATUSES } from '../utils/constants.js';
import { objectId, paginationSchema } from './common.validator.js';

export const initiatePaymentSchema = Joi.object({
    bookingId: objectId.required().messages({
        'any.required': 'Booking ID is required',
    }),
});

export const paymentIdParamSchema = Joi.object({
    id: objectId.required().messages({
        'any.required': 'Payment ID is required',
    }),
});

export const bookingIdParamSchema = Joi.object({
    bookingId: objectId.required().messages({
        'any.required': 'Booking ID is required',
    }),
});

export const paymentListQuerySchema = paginationSchema.keys({
    status: Joi.string().valid(...ALL_PAYMENT_TRANSACTION_STATUSES),
    bookingId: objectId,
});

export const refundSchema = Joi.object({
    reason: Joi.string().trim().min(3).max(500).required().messages({
        'string.min': 'Refund reason must be at least 3 characters',
        'any.required': 'Refund reason is required',
    }),
});

export const verifyPaymentSchema = Joi.object({
    sdkStatus: Joi.string()
        .trim()
        .valid('SUCCESS', 'FAILURE', 'INTERRUPTED', 'UNKNOWN')
        .optional(),
    sdkResponseCode: Joi.string().trim().max(100).allow('', null).optional(),
    sdkMessage: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(false);

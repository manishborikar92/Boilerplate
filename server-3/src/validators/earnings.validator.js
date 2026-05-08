import Joi from 'joi';
import { ALL_PAYMENT_TRANSACTION_STATUSES } from '../utils/constants.js';
import { objectId, paginationSchema } from './common.validator.js';

/**
 * Validator for transaction list query parameters
 */
export const transactionListQuerySchema = paginationSchema.keys({
    status: Joi.string().valid(...ALL_PAYMENT_TRANSACTION_STATUSES).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
});

/**
 * Validator for transaction detail params
 */
export const transactionDetailParamsSchema = Joi.object({
    id: objectId.required(),
});

/**
 * Validator for statement download query parameters
 */
export const statementQuerySchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
});

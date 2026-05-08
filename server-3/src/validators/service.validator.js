import Joi from 'joi';
import { ALL_SERVICE_TYPES, ALL_SERVICE_FOR } from '../utils/constants.js';
import { paginationSchema } from './common.validator.js';

const serviceNameSchema = Joi.string().trim().min(1).max(100);
const priceSchema = Joi.number().min(0).precision(2);
const bundledServicesSchema = Joi.array()
    .items(serviceNameSchema.required())
    .min(1)
    .unique();

export const addServiceSchema = Joi.object({
    serviceName: serviceNameSchema.required(),
    serviceType: Joi.string().valid(...ALL_SERVICE_TYPES).required(),
    serviceFor: Joi.string().valid(...ALL_SERVICE_FOR).default('unisex'),
    actualPrice: priceSchema.required(),
    offerPrice: priceSchema.max(Joi.ref('actualPrice')).default(0),
    duration: Joi.number().integer().min(1).when('serviceType', {
        is: 'single',
        then: Joi.optional(),
        otherwise: Joi.forbidden(),
    }),
    bundledServices: bundledServicesSchema.when('serviceType', {
        is: 'bundled',
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    totalDuration: Joi.number().integer().min(1).when('serviceType', {
        is: 'bundled',
        then: Joi.optional(),
        otherwise: Joi.forbidden(),
    }),
});

export const updateServiceSchema = Joi.object({
    serviceName: serviceNameSchema,
    serviceFor: Joi.string().valid(...ALL_SERVICE_FOR),
    actualPrice: priceSchema,
    offerPrice: priceSchema,
    duration: Joi.number().integer().min(1),
    bundledServices: bundledServicesSchema,
    totalDuration: Joi.number().integer().min(1),
})
    .custom((value, helpers) => {
        if (
            value.actualPrice !== undefined
            && value.offerPrice !== undefined
            && value.offerPrice > value.actualPrice
        ) {
            return helpers.error('any.custom', {
                message: 'offerPrice cannot exceed actualPrice',
            });
        }

        return value;
    })
    .messages({ 'any.custom': '{{#message}}' })
    .min(1);

export const serviceListQuerySchema = paginationSchema.keys({
    serviceType: Joi.string().valid(...ALL_SERVICE_TYPES),
    serviceFor: Joi.string().valid(...ALL_SERVICE_FOR),
});

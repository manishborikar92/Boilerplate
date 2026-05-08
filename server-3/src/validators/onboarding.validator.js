import Joi from 'joi';
import {
    ALL_GENDERS,
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    SECURITY_PIN_LENGTH,
} from '../utils/constants.js';
import { normalizeShopSchedule } from '../utils/shop-schedule.utils.js';
import { locationSchema } from './common.validator.js';

const daysSchema = Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK)),
    Joi.string(),
);

const amenitiesSchema = Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...ALL_SHOP_AMENITIES)),
    Joi.string(),
);

const breakTimesSchema = Joi.alternatives().try(
    Joi.array().items(
        Joi.object({
            start: Joi.string().trim(),
            end: Joi.string().trim(),
            startsAt: Joi.forbidden(),
            endsAt: Joi.forbidden(),
        }),
    ),
    Joi.string().trim(),
);

const targetCustomersSchema = Joi.string().valid(...ALL_SERVICE_FOR, 'men', 'women');

export const customerOnboardingSchema = Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    gender: Joi.string().valid(...ALL_GENDERS).required(),
    dateOfBirth: Joi.date().required(),
    address: Joi.string().trim().required(),
    location: Joi.alternatives().try(locationSchema, Joi.string()).required(),
});

export const barberOnboardingSchema = Joi.object({
    email: Joi.string().email(),
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    ownerFirstName: Joi.forbidden(),
    ownerLastName: Joi.forbidden(),
    ownerGender: Joi.forbidden(),
    ownerDateOfBirth: Joi.forbidden(),
    shopName: Joi.string().trim().min(1).max(100).required(),
    shopOwner: Joi.forbidden(),
    ownerName: Joi.forbidden(),
    shopCategory: Joi.forbidden(),
    businessCategory: Joi.forbidden(),
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    targetCustomers: targetCustomersSchema.required(),
    upiId: Joi.string(),
    upiAddress: Joi.forbidden(),
    accountHolderName: Joi.string().trim().min(1).max(100).required(),
    bankName: Joi.string().trim().min(1).max(120).required(),
    bankAccount: Joi.string().trim().pattern(/^\d{6,34}$/).optional(),
    ifsc: Joi.string().trim().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).optional(),
    bio: Joi.string().max(500).allow('').default(''),
    address: Joi.string().trim(),
    shopLocation: Joi.forbidden(),
    location: Joi.alternatives().try(locationSchema, Joi.string()).required(),
    numberOfEmployees: Joi.number().integer().min(1).default(1),
    yearsOfExperience: Joi.number().integer().min(0).default(0),
    amenities: amenitiesSchema,
    facilities: Joi.forbidden(),
    workingDays: daysSchema,
    availableDays: Joi.forbidden(),
    openTime: Joi.string().trim(),
    closeTime: Joi.string().trim(),
    opensAt: Joi.forbidden(),
    closesAt: Joi.forbidden(),
    workingHours: Joi.alternatives().try(
        Joi.object({
            openTime: Joi.string().trim(),
            closeTime: Joi.string().trim(),
            opensAt: Joi.forbidden(),
            closesAt: Joi.forbidden(),
        }),
        Joi.string().trim(),
    ),
    breakTimes: breakTimesSchema,
    breakTimings: Joi.forbidden(),
    pin: Joi.string().pattern(new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`)).required(),
    confirmPin: Joi.string().required().valid(Joi.ref('pin')).messages({
        'any.only': 'confirmPin must match pin',
    }),
})
    .custom((value, helpers) => {
        value.amenities = value.amenities ?? [];
        value.breakTimes = value.breakTimes ?? [];

        if (value.workingHours) {
            if (typeof value.workingHours === 'string') {
                try {
                    value.workingHours = JSON.parse(value.workingHours);
                } catch {
                    return helpers.error('any.custom', {
                        message: 'workingHours must be a valid JSON object',
                    });
                }
            }
            value.openTime = value.openTime
                || value.workingHours.openTime;
            value.closeTime = value.closeTime
                || value.workingHours.closeTime;
        }

        if (!value.category) {
            return helpers.error('any.custom', {
                message: 'category is required',
            });
        }
        if (!value.firstName || !value.lastName) {
            return helpers.error('any.custom', {
                message: 'firstName and lastName are required',
            });
        }
        if (!value.gender || !value.dateOfBirth) {
            return helpers.error('any.custom', {
                message: 'gender and dateOfBirth are required',
            });
        }
        if (!value.email) {
            return helpers.error('any.custom', {
                message: 'email is required',
            });
        }
        if (!value.upiId) {
            return helpers.error('any.custom', {
                message: 'upiId is required',
            });
        }
        if (!value.address) {
            return helpers.error('any.custom', {
                message: 'address is required',
            });
        }
        if (!value.workingDays) {
            return helpers.error('any.custom', {
                message: 'workingDays is required',
            });
        }
        if (!value.openTime || !value.closeTime) {
            return helpers.error('any.custom', {
                message: 'openTime and closeTime are required',
            });
        }

        const normalizedSchedule = normalizeShopSchedule({
            openTime: value.openTime,
            closeTime: value.closeTime,
            breakTimes: value.breakTimes ?? [],
        });
        if (normalizedSchedule.error) {
            return helpers.error('any.custom', {
                message: normalizedSchedule.error,
            });
        }

        value.openTime = normalizedSchedule.value.openTime;
        value.closeTime = normalizedSchedule.value.closeTime;
        value.breakTimes = normalizedSchedule.value.breakTimes;

        return value;
    })
    .messages({
        'any.custom': '{{#message}}',
    });

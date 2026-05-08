import Joi from 'joi';
import {
    ALL_GENDERS,
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    SECURITY_PIN_LENGTH,
} from '../utils/constants.js';
import {
    normalizeBreakTimes as normalizeScheduleBreakTimes,
    normalizeScheduleTime,
    normalizeShopSchedule,
} from '../utils/shop-schedule.utils.js';
import { objectId } from './common.validator.js';

const coordinatesPattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const normalizeCoordinates = (value, helpers) => {
    let { longitude, latitude } = value;

    if ((longitude === undefined || latitude === undefined) && value.coordinates) {
        const match = value.coordinates.match(coordinatesPattern);
        if (!match) {
            return helpers.error('any.custom', {
                message: 'coordinates must be in "longitude,latitude" format',
            });
        }

        longitude = Number(match[1]);
        latitude = Number(match[2]);
    }

    if (longitude === undefined || latitude === undefined) {
        return helpers.error('any.custom', {
            message: 'longitude and latitude are required',
        });
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return helpers.error('any.custom', {
            message: 'longitude/latitude values are out of range',
        });
    }

    value.longitude = longitude;
    value.latitude = latitude;
    return value;
};

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
const ifscSchema = Joi.string().trim().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i);
const bankAccountSchema = Joi.string().trim().min(6).max(34);

export const updateBusinessSchema = Joi.object({
    shopName: Joi.string().trim().min(1).max(100),
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    ownerName: Joi.forbidden(),
    shopOwner: Joi.forbidden(),
    ownerFirstName: Joi.forbidden(),
    ownerLastName: Joi.forbidden(),
    ownerGender: Joi.forbidden(),
    ownerDateOfBirth: Joi.forbidden(),
    numberOfEmployees: Joi.number().integer().min(1),
    yearsOfExperience: Joi.number().integer().min(0),
    bio: Joi.string().max(500).allow(''),
    address: Joi.string().trim(),
    shopLocation: Joi.forbidden(),
    targetCustomers: targetCustomersSchema,
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    shopCategory: Joi.forbidden(),
    businessCategory: Joi.forbidden(),
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
    isOpen: Joi.boolean(),
    location: Joi.alternatives().try(
        Joi.object({
            type: Joi.string().valid('Point').required(),
            coordinates: Joi.array().items(Joi.number()).length(2).required(),
        }),
        Joi.string(),
    ),
})
    .custom((value, helpers) => {
        value.ownerFirstName = value.firstName;
        value.ownerLastName = value.lastName;
        value.ownerGender = value.gender;
        value.ownerDateOfBirth = value.dateOfBirth;
        value.facilities = value.amenities;
        value.availableDays = value.workingDays;

        if (value.workingHours) {
            if (typeof value.workingHours === 'string') {
                try {
                    value.workingHours = JSON.parse(value.workingHours);
                } catch {
                    // Keep original value; service will return a clear validation error.
                }
            }
            value.openTime = value.openTime
                || value.workingHours.openTime;
            value.closeTime = value.closeTime
                || value.workingHours.closeTime;
        }

        if (value.openTime !== undefined) {
            const normalizedOpenTime = normalizeScheduleTime(value.openTime);
            if (!normalizedOpenTime) {
                return helpers.error('any.custom', {
                    message: 'openTime must use HH:MM or hh:mm AM/PM format',
                });
            }
            value.openTime = normalizedOpenTime;
        }

        if (value.closeTime !== undefined) {
            const normalizedCloseTime = normalizeScheduleTime(value.closeTime);
            if (!normalizedCloseTime) {
                return helpers.error('any.custom', {
                    message: 'closeTime must use HH:MM or hh:mm AM/PM format',
                });
            }
            value.closeTime = normalizedCloseTime;
        }

        if (value.breakTimes !== undefined) {
            const normalizedBreakTimes = normalizeScheduleBreakTimes(value.breakTimes);
            if (normalizedBreakTimes.error) {
                return helpers.error('any.custom', {
                    message: normalizedBreakTimes.error,
                });
            }
            value.breakTimes = normalizedBreakTimes.value;
        }

        if (value.openTime !== undefined && value.closeTime !== undefined) {
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
            if (value.breakTimes !== undefined) {
                value.breakTimes = normalizedSchedule.value.breakTimes;
            }
        }

        return value;
    })
    .messages({
        'any.custom': '{{#message}}',
    })
    .min(1);

export const updatePinSchema = Joi.object({
    currentPin: Joi.string().required(),
    newPin: Joi.string().pattern(new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`)).required(),
    confirmNewPin: Joi.string().required().valid(Joi.ref('newPin')).messages({
        'any.only': 'confirmNewPin must match newPin',
    }),
    confirmPin: Joi.any().strip(),
}).rename('confirmPin', 'confirmNewPin', { ignoreUndefined: true, override: false });

export const shopIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const favoritePatchSchema = Joi.object({
    favorite: Joi.boolean().required(),
});

export const shopListQuerySchema = Joi.object({
    longitude: Joi.number().min(-180).max(180),
    latitude: Joi.number().min(-90).max(90),
    coordinates: Joi.string().pattern(coordinatesPattern),
    query: Joi.string().trim().min(1).max(100),
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
})
    .custom((value, helpers) => {
        if (value.coordinates || value.longitude !== undefined || value.latitude !== undefined) {
            return normalizeCoordinates(value, helpers);
        }
        return value;
    }, 'shop list query normalization')
    .messages({ 'any.custom': '{{#message}}' });

export const servicesByGenderQuerySchema = Joi.object({
    longitude: Joi.number().min(-180).max(180),
    latitude: Joi.number().min(-90).max(90),
    coordinates: Joi.string().pattern(coordinatesPattern),
    gender: Joi.string().valid(...ALL_SERVICE_FOR).default('unisex'),
    search: Joi.string().trim().max(100).allow(''),
})
    .custom(normalizeCoordinates, 'coordinates normalization')
    .messages({ 'any.custom': '{{#message}}' });

export const searchServicesQuerySchema = Joi.object({
    query: Joi.string().trim().min(1).max(100).required(),
    gender: Joi.string().valid(...ALL_SERVICE_FOR),
});

export const shopAvailabilityQuerySchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
        'string.pattern.base': 'date must be in YYYY-MM-DD format',
    }),
    serviceId: Joi.alternatives().try(
        objectId,
        Joi.array().items(objectId).min(1),
    ).required(),
});

export const updatePayoutDetailsSchema = Joi.object({
    accountHolderName: Joi.string().trim().min(1).max(100).required(),
    bankName: Joi.string().trim().min(1).max(120).required(),
    bankAccount: Joi.string().trim().pattern(/^\d{6,34}$/).required().messages({
        'string.pattern.base': 'bankAccount must be 6-34 digits',
    }),
    ifsc: Joi.string().trim().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required().messages({
        'string.pattern.base': 'ifsc must be a valid IFSC code (e.g., SBIN0001234)',
    }),
    upiId: Joi.string().trim().required(),
    // Strip any fields that should not be user-controlled
    verificationStatus: Joi.any().strip(),
    beneficiaryId: Joi.any().strip(),
    verifiedAt: Joi.any().strip(),
});

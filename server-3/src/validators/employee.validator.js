import Joi from 'joi';
import { ALL_GENDERS } from '../utils/constants.js';
import { objectId } from './common.validator.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TWENTY_FOUR_HOUR_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMPLOYEE_PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

const parseJsonString = (value, fieldName) => {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`${fieldName} must be valid JSON`);
    }
};

const normalizeWorkingHours = (value, helpers) => {
    let raw = value;

    if (typeof value === 'string') {
        try {
            raw = parseJsonString(value, 'workingHours');
        } catch (err) {
            return helpers.error('any.custom', { message: err.message });
        }
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return helpers.error('any.custom', {
            message: 'workingHours must be an object',
        });
    }

    const start = String(raw.start ?? '').trim();
    const end = String(raw.end ?? '').trim();

    if (!start || !end) {
        return helpers.error('any.custom', {
            message: 'workingHours must include start and end',
        });
    }

    if (!TWENTY_FOUR_HOUR_TIME_PATTERN.test(start) || !TWENTY_FOUR_HOUR_TIME_PATTERN.test(end)) {
        return helpers.error('any.custom', {
            message: 'workingHours.start and workingHours.end must use HH:MM 24-hour format',
        });
    }

    if (start >= end) {
        return helpers.error('any.custom', {
            message: 'workingHours.start must be earlier than workingHours.end',
        });
    }

    return { start, end };
};

const normalizeBlockedDates = (value, helpers) => {
    let raw = value;

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            raw = parseJsonString(trimmed, 'blockedDates');
        } catch (err) {
            return helpers.error('any.custom', { message: err.message });
        }
    }

    const entries = Array.isArray(raw) ? raw : [raw];
    const normalized = [];
    const seen = new Set();

    for (const entry of entries) {
        let dateText;

        if (entry instanceof Date) {
            if (Number.isNaN(entry.getTime())) {
                return helpers.error('any.custom', {
                    message: 'blockedDates must contain valid dates',
                });
            }

            dateText = entry.toISOString().slice(0, 10);
        } else if (typeof entry === 'string') {
            dateText = entry.trim();
            if (!DATE_ONLY_PATTERN.test(dateText)) {
                return helpers.error('any.custom', {
                    message: 'blockedDates must use YYYY-MM-DD format',
                });
            }
        } else {
            return helpers.error('any.custom', {
                message: 'blockedDates must contain only date values',
            });
        }

        if (seen.has(dateText)) continue;
        seen.add(dateText);
        normalized.push(new Date(`${dateText}T00:00:00.000Z`));
    }

    return normalized;
};

const phoneNumberSchema = Joi.string()
    .trim()
    .pattern(EMPLOYEE_PHONE_PATTERN)
    .messages({
        'string.pattern.base': 'phoneNumber must be a valid international phone number',
    });

const workingHoursSchema = Joi.alternatives()
    .try(
        Joi.object({
            start: Joi.string(),
            end: Joi.string(),
        }),
        Joi.string().trim(),
    )
    .custom(normalizeWorkingHours)
    .messages({ 'any.custom': '{{#message}}' });

const blockedDatesSchema = Joi.alternatives()
    .try(
        Joi.array().items(
            Joi.alternatives().try(
                Joi.string().pattern(DATE_ONLY_PATTERN),
                Joi.date().iso(),
            ),
        ),
        Joi.string().trim(),
    )
    .custom(normalizeBlockedDates)
    .messages({ 'any.custom': '{{#message}}' });

export const addEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    phoneNumber: phoneNumberSchema.required(),
    gender: Joi.string().valid(...ALL_GENDERS).required(),
    dateOfBirth: Joi.date().max('now').required(),
    workingHours: workingHoursSchema,
    blockedDates: blockedDatesSchema.default([]),
});

export const updateEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    phoneNumber: phoneNumberSchema,
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date().max('now'),
    workingHours: workingHoursSchema,
    blockedDates: blockedDatesSchema,
    isActive: Joi.boolean(),
});

export const employeeIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const employeeAvailabilityQuerySchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
        'string.pattern.base': 'date must be in YYYY-MM-DD format',
    }),
    serviceId: Joi.alternatives().try(
        objectId,
        Joi.array().items(objectId).min(1),
    ).required(),
});

export const updateEmployeeAvailabilitySchema = Joi.object({
    dates: Joi.array()
        .items(Joi.string().pattern(DATE_ONLY_PATTERN).messages({
            'string.pattern.base': 'dates must contain YYYY-MM-DD values',
        }))
        .min(1)
        .unique()
        .required()
        .messages({
            'array.min': 'dates must include at least one date',
            'array.unique': 'dates must not contain duplicates',
        }),
    available: Joi.boolean().required(),
});

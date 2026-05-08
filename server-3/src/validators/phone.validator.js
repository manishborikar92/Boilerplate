import Joi from 'joi';

/** Indian mobile number: exactly 10 digits, starting with 6-9. */
const indianMobile = Joi.string()
    .trim()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
        'string.empty': 'Mobile number is required',
        'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number',
        'any.required': 'Mobile number is required',
    });

/** POST /account/phone/send-otp */
export const sendPhoneOtpSchema = Joi.object({
    newMobile: indianMobile,
});

/** POST /account/phone/verify-otp */
export const verifyPhoneOtpSchema = Joi.object({
    newMobile: indianMobile,
    otp: Joi.string()
        .trim()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.empty': 'OTP is required',
            'string.pattern.base': 'OTP must be exactly 6 digits',
            'any.required': 'OTP is required',
        }),
});

import Joi from 'joi';

/** PATCH /account/email */
export const updateEmailSchema = Joi.object({
    newEmail: Joi.string()
        .email()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Email must be a valid email address',
            'any.required': 'Email is required',
        }),
});

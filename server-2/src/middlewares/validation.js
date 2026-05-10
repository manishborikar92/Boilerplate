const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

const registerValidation = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    body('name').trim().notEmpty().withMessage('Name is required'),
];

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
];

const googleSignInValidation = [
    body('idToken').notEmpty().withMessage('Firebase ID token is required')
];

const refreshTokenValidation = [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
];

const emailValidation = [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail()
];

const passwordValidation = [
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
        .matches(/[0-9]/).withMessage('New password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('New password must contain at least one special character')
];

module.exports = {
    validate,
    registerValidation,
    loginValidation,
    googleSignInValidation,
    refreshTokenValidation,
    emailValidation,
    passwordValidation,
    changePasswordValidation
};

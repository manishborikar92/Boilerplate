const rateLimit = require('express-rate-limit');

// Disable rate limiting in test environment
const isTest = process.env.NODE_ENV === 'test';
const isDevelopment = process.env.NODE_ENV === 'development';

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 1000 : (isDevelopment ? 500 : 100), // Higher limit for dev and tests
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest // Skip rate limiting in tests
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 1000 : (isDevelopment ? 50 : 5), // Higher limit for dev and tests
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    skip: () => isTest // Skip rate limiting in tests
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTest ? 1000 : 3, // Higher limit for tests
    message: {
        success: false,
        message: 'Too many password reset attempts, please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest // Skip rate limiting in tests
});

// Email verification rate limiter
const emailVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTest ? 1000 : 5, // Higher limit for tests
    message: {
        success: false,
        message: 'Too many verification email requests, please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest // Skip rate limiting in tests
});

// File upload rate limiter
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 1000 : (isDevelopment ? 200 : 50), // Higher limit for dev and tests
    message: {
        success: false,
        message: 'Too many file uploads, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest // Skip rate limiting in tests
});

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    emailVerificationLimiter,
    uploadLimiter
};

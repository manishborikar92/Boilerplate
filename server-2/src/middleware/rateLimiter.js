const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper to handle environment-based limits
const limit = (prod, dev) => (isTest ? 1000 : (isDevelopment ? dev : prod));

// General API: Increased to 300 (from 100)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: limit(500, 800),
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// Auth: Increased to 15 (from 5) to reduce false positives
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: limit(15, 50),
  message: { success: false, message: 'Too many attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failures
  skip: () => isTest
});

// Password Reset: Increased to 5 (from 3)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: limit(5, 10),
  message: { success: false, message: 'Too many reset attempts, try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// Email Verification: Increased to 10 (from 5)
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: limit(10, 20),
  message: { success: false, message: 'Too many verification requests, try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// File Upload: Increased to 100 (from 50)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: limit(100, 200),
  message: { success: false, message: 'Too many file uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  uploadLimiter
};
const express = require('express');
const router = express.Router();
const {
    register,
    login,
    googleSignIn,
    refreshAccessToken,
    getMe,
    logout,
    logoutAllDevices,
    getActiveSessions,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
    validate,
    registerValidation,
    loginValidation,
    googleSignInValidation,
    refreshTokenValidation,
    emailValidation,
    passwordValidation,
    changePasswordValidation
} = require('../middleware/validation');
const {
    authLimiter,
    passwordResetLimiter,
    emailVerificationLimiter
} = require('../middleware/rateLimiter');

// Public routes
router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/google', authLimiter, googleSignInValidation, validate, googleSignIn);
router.post('/refresh', refreshTokenValidation, validate, refreshAccessToken);

// Email Verification
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', emailVerificationLimiter, emailValidation, validate, resendVerificationEmail);

// Password Reset
router.post('/forgot-password', passwordResetLimiter, emailValidation, validate, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, passwordValidation, validate, resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAllDevices);
router.get('/sessions', protect, getActiveSessions);
router.post('/change-password', protect, changePasswordValidation, validate, changePassword);

module.exports = router;

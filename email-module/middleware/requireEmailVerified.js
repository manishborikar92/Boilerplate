/**
 * Email Verification Middleware
 *
 * Express middleware that blocks access to routes unless the authenticated
 * user's email has been verified. Expects `req.user.isEmailVerified` to
 * be set by a preceding auth middleware.
 *
 * Usage:
 *   const { requireEmailVerified } = require('email-module/middleware/requireEmailVerified');
 *   app.get('/protected', authMiddleware, requireEmailVerified, handler);
 *
 * @module middleware/requireEmailVerified
 */

/**
 * Create the middleware, optionally providing a custom error class.
 *
 * @param {Object}   [options]
 * @param {Function} [options.ErrorClass]  - Custom error constructor (default: generic Error)
 * @param {string}   [options.message]     - Custom error message
 * @returns {Function} Express middleware (req, res, next)
 */
const createRequireEmailVerified = (options = {}) => {
    const {
        ErrorClass = Error,
        message = 'Email verification required. Please verify your email to access this feature.',
    } = options;

    return (req, res, next) => {
        if (!req.user) {
            return next(new ErrorClass('Authentication required'));
        }

        if (!req.user.isEmailVerified) {
            return next(new ErrorClass(message));
        }

        next();
    };
};

// Default instance for quick use
const requireEmailVerified = createRequireEmailVerified();

module.exports = { requireEmailVerified, createRequireEmailVerified };

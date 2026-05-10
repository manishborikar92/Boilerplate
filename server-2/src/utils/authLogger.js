/**
 * Authentication Event Logger
 * Centralized logging for all authentication-related events
 * Provides monitoring capabilities for security auditing
 */

const { logger } = require('../middleware/logger');

/**
 * Authentication event types
 */
const AUTH_EVENTS = {
    LOGIN_SUCCESS: 'auth.login.success',
    LOGIN_FAILURE: 'auth.login.failure',
    LOGOUT: 'auth.logout',
    LOGOUT_ALL: 'auth.logout_all',
    REGISTER_SUCCESS: 'auth.register.success',
    REGISTER_FAILURE: 'auth.register.failure',
    TOKEN_REFRESH: 'auth.token.refresh',
    TOKEN_REFRESH_FAILURE: 'auth.token.refresh_failure',
    PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
    PASSWORD_RESET_SUCCESS: 'auth.password.reset_success',
    PASSWORD_CHANGE: 'auth.password.change',
    EMAIL_VERIFICATION: 'auth.email.verification',
    ACCOUNT_LOCKED: 'auth.account.locked',
    SUSPICIOUS_ACTIVITY: 'auth.security.suspicious'
};

/**
 * Log authentication event
 * @param {string} event - Event type from AUTH_EVENTS
 * @param {Object} data - Event data
 */
const logAuthEvent = (event, data = {}) => {
    const logData = {
        event,
        timestamp: new Date().toISOString(),
        ...data
    };

    // Determine log level based on event type
    if (event.includes('failure') || event.includes('locked') || event.includes('suspicious')) {
        logger.warn('Auth security event', logData);
    } else {
        logger.info('Auth event', logData);
    }
};

/**
 * Log successful login
 * @param {string} userId - User ID
 * @param {string} email - User email  
 * @param {string} role - User role
 * @param {string} method - Login method (email, userId, google)
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 */
const logLoginSuccess = (userId, email, role, method, ipAddress, userAgent) => {
    logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, {
        userId,
        email,
        role,
        method,
        ipAddress,
        userAgent: userAgent?.substring(0, 100)
    });
};

/**
 * Log failed login attempt
 * @param {string} identifier - Email or userId used
 * @param {string} reason - Failure reason
 * @param {string} ipAddress - Client IP address
 */
const logLoginFailure = (identifier, reason, ipAddress) => {
    logAuthEvent(AUTH_EVENTS.LOGIN_FAILURE, {
        identifier,
        reason,
        ipAddress
    });
};

/**
 * Log account lockout
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {number} attempts - Number of failed attempts
 * @param {string} ipAddress - Last attempt IP
 */
const logAccountLocked = (userId, email, attempts, ipAddress) => {
    logAuthEvent(AUTH_EVENTS.ACCOUNT_LOCKED, {
        userId,
        email,
        attempts,
        ipAddress
    });
};

/**
 * Log suspicious authentication activity
 * @param {string} type - Type of suspicious activity
 * @param {Object} details - Activity details
 */
const logSuspiciousActivity = (type, details) => {
    logAuthEvent(AUTH_EVENTS.SUSPICIOUS_ACTIVITY, {
        type,
        ...details
    });
};

/**
 * Log token refresh
 * @param {string} userId - User ID
 * @param {boolean} rotated - Whether token was rotated
 */
const logTokenRefresh = (userId, rotated = true) => {
    logAuthEvent(AUTH_EVENTS.TOKEN_REFRESH, {
        userId,
        rotated
    });
};

/**
 * Log logout event
 * @param {string} userId - User ID
 * @param {boolean} allDevices - Whether all devices were logged out
 */
const logLogout = (userId, allDevices = false) => {
    logAuthEvent(allDevices ? AUTH_EVENTS.LOGOUT_ALL : AUTH_EVENTS.LOGOUT, {
        userId,
        allDevices
    });
};

module.exports = {
    AUTH_EVENTS,
    logAuthEvent,
    logLoginSuccess,
    logLoginFailure,
    logAccountLocked,
    logSuspiciousActivity,
    logTokenRefresh,
    logLogout
};

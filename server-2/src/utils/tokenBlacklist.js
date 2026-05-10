/**
 * Token Blacklist Utility
 * Manages invalidated tokens to prevent reuse after logout
 * 
 * Uses in-memory Map for development. For production scale,
 * consider Redis or database-based storage.
 */

const { logger } = require('../middleware/logger');

// In-memory blacklist store
// Key: token (or token hash), Value: expiration timestamp
const blacklistedTokens = new Map();

// Cleanup interval (every 15 minutes)
const CLEANUP_INTERVAL = 15 * 60 * 1000;

/**
 * Add a token to the blacklist
 * @param {string} token - The JWT token to blacklist
 * @param {number} expiresAt - Token expiration timestamp (ms)
 */
const blacklistToken = (token, expiresAt) => {
    if (!token) return;

    // Store only a hash of the token for security
    const crypto = require('crypto');
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    blacklistedTokens.set(tokenHash, expiresAt);

    logger.info('Token blacklisted', {
        tokenHash: tokenHash.substring(0, 16) + '...',
        expiresAt: new Date(expiresAt).toISOString()
    });
};

/**
 * Check if a token is blacklisted
 * @param {string} token - The JWT token to check
 * @returns {boolean} True if token is blacklisted
 */
const isTokenBlacklisted = (token) => {
    if (!token) return false;

    const crypto = require('crypto');
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    return blacklistedTokens.has(tokenHash);
};

/**
 * Remove expired tokens from the blacklist
 * Called periodically to prevent memory leaks
 */
const cleanupExpiredTokens = () => {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenHash, expiresAt] of blacklistedTokens.entries()) {
        if (expiresAt <= now) {
            blacklistedTokens.delete(tokenHash);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info('Cleaned up expired blacklisted tokens', { count: cleaned });
    }
};

/**
 * Get the count of blacklisted tokens (for monitoring)
 * @returns {number} Number of blacklisted tokens
 */
const getBlacklistCount = () => {
    return blacklistedTokens.size;
};

/**
 * Clear all blacklisted tokens (for testing)
 */
const clearBlacklist = () => {
    blacklistedTokens.clear();
};

// Start cleanup interval (only in non-test environment)
let cleanupIntervalId = null;
if (process.env.NODE_ENV !== 'test') {
    cleanupIntervalId = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL);
}

/**
 * Stop the cleanup interval (for graceful shutdown)
 */
const stopCleanup = () => {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
    }
};

module.exports = {
    blacklistToken,
    isTokenBlacklisted,
    cleanupExpiredTokens,
    getBlacklistCount,
    clearBlacklist,
    stopCleanup
};

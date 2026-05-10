const mongoose = require('mongoose');

/**
 * Session Schema
 * Tracks active user sessions for security and device management
 * 
 * Features:
 * - Limits concurrent sessions per user (max 3 by default)
 * - Tracks device/browser information
 * - Enables "logout from all devices" functionality
 * - Stores refresh token for validation
 */
const sessionSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Refresh token hash (for validation on refresh)
    refreshTokenHash: {
        type: String,
        required: true,
        index: true
    },

    // Device/Client information
    userAgent: {
        type: String,
        trim: true,
        maxlength: 500
    },

    ipAddress: {
        type: String,
        trim: true,
        index: true
    },

    // Device type inferred from userAgent
    deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },

    // Browser/client name
    clientName: {
        type: String,
        trim: true
    },

    // Session status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Timestamps
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    expiresAt: {
        type: Date,
        required: true
        // Note: index is created via TTL index below (expireAfterSeconds)
    },

    // Logout information
    loggedOutAt: {
        type: Date
    },

    logoutReason: {
        type: String,
        enum: ['user_logout', 'token_expired', 'forced_logout', 'session_limit', 'password_change', 'security_concern'],
        trim: true
    }
}, {
    timestamps: true
});

// Compound indexes
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup
sessionSchema.index({ refreshTokenHash: 1, isActive: 1 });

// ==================== STATIC METHODS ====================

/**
 * Create a new session
 * @param {Object} sessionData - Session creation data
 * @param {number} maxSessions - Maximum allowed sessions per user (default: 3)
 */
sessionSchema.statics.createSession = async function (sessionData, maxSessions = 3) {
    const { userId, refreshToken, userAgent, ipAddress, expiresAt } = sessionData;

    const crypto = require('crypto');
    const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

    // Parse user agent for device info
    const deviceInfo = parseUserAgent(userAgent);

    // Check existing active sessions
    const activeSessions = await this.find({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
    }).sort({ lastActivityAt: 1 });

    // If at limit, deactivate oldest session
    if (activeSessions.length >= maxSessions) {
        const oldestSession = activeSessions[0];
        oldestSession.isActive = false;
        oldestSession.loggedOutAt = new Date();
        oldestSession.logoutReason = 'session_limit';
        await oldestSession.save();
    }

    // Create new session
    return this.create({
        userId,
        refreshTokenHash,
        userAgent,
        ipAddress,
        deviceType: deviceInfo.deviceType,
        clientName: deviceInfo.clientName,
        expiresAt
    });
};

/**
 * Validate and update session on token refresh
 * @param {string} refreshToken - The refresh token to validate
 * @returns {Object|null} Session if valid, null otherwise
 */
sessionSchema.statics.validateAndRefreshSession = async function (refreshToken) {
    const crypto = require('crypto');
    const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

    const session = await this.findOne({
        refreshTokenHash,
        isActive: true,
        expiresAt: { $gt: new Date() }
    });

    if (session) {
        session.lastActivityAt = new Date();
        await session.save();
    }

    return session;
};

/**
 * Update session with new refresh token (for rotation)
 * @param {string} oldRefreshToken - The old refresh token
 * @param {string} newRefreshToken - The new refresh token
 * @param {Date} newExpiresAt - New expiration date
 */
sessionSchema.statics.rotateRefreshToken = async function (oldRefreshToken, newRefreshToken, newExpiresAt) {
    const crypto = require('crypto');
    const oldHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    const session = await this.findOne({
        refreshTokenHash: oldHash,
        isActive: true
    });

    if (session) {
        session.refreshTokenHash = newHash;
        session.expiresAt = newExpiresAt;
        session.lastActivityAt = new Date();
        await session.save();
        return session;
    }

    return null;
};

/**
 * Invalidate session on logout
 * @param {string} refreshToken - The refresh token to invalidate
 */
sessionSchema.statics.invalidateSession = async function (refreshToken) {
    const crypto = require('crypto');
    const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

    return this.findOneAndUpdate(
        { refreshTokenHash, isActive: true },
        {
            isActive: false,
            loggedOutAt: new Date(),
            logoutReason: 'user_logout'
        }
    );
};

/**
 * Invalidate all sessions for a user (logout from all devices)
 * @param {ObjectId} userId - User ID
 * @param {string} reason - Reason for logout
 */
sessionSchema.statics.invalidateAllUserSessions = async function (userId, reason = 'forced_logout') {
    return this.updateMany(
        { userId, isActive: true },
        {
            isActive: false,
            loggedOutAt: new Date(),
            logoutReason: reason
        }
    );
};

/**
 * Get active sessions for a user
 * @param {ObjectId} userId - User ID
 */
sessionSchema.statics.getActiveSessions = async function (userId) {
    return this.find({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
    }).sort({ lastActivityAt: -1 }).lean();
};

/**
 * Get session count for a user
 * @param {ObjectId} userId - User ID
 */
sessionSchema.statics.getActiveSessionCount = async function (userId) {
    return this.countDocuments({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
    });
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse user agent string to extract device info
 * @param {string} userAgent - User agent string
 */
function parseUserAgent(userAgent) {
    if (!userAgent) {
        return { deviceType: 'unknown', clientName: 'Unknown' };
    }

    const ua = userAgent.toLowerCase();

    // Detect device type
    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
        deviceType = 'mobile';
    } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
    }

    // Detect browser/client
    let clientName = 'Unknown Browser';
    if (ua.includes('chrome') && !ua.includes('edg')) {
        clientName = 'Chrome';
    } else if (ua.includes('firefox')) {
        clientName = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
        clientName = 'Safari';
    } else if (ua.includes('edg')) {
        clientName = 'Edge';
    } else if (ua.includes('opera') || ua.includes('opr')) {
        clientName = 'Opera';
    }

    return { deviceType, clientName };
}

module.exports = mongoose.model('Session', sessionSchema);

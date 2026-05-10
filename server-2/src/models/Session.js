const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    refreshTokenHash: {
        type: String,
        required: true,
        index: true
    },
    userAgent: String,
    ipAddress: String,
    deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },
    clientName: String,
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    loggedOutAt: Date,
    logoutReason: String
}, {
    timestamps: true
});

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.statics.createSession = async function (sessionData, maxSessions = 3) {
    const { userId, refreshToken, userAgent, ipAddress, expiresAt } = sessionData;
    const crypto = require('crypto');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Simple User Agent Parsing
    let deviceType = 'desktop';
    let clientName = 'Unknown';
    if (userAgent) {
        if (/mobile/i.test(userAgent)) deviceType = 'mobile';
        else if (/tablet/i.test(userAgent)) deviceType = 'tablet';

        if (userAgent.includes('Chrome')) clientName = 'Chrome';
        else if (userAgent.includes('Firefox')) clientName = 'Firefox';
        else if (userAgent.includes('Safari')) clientName = 'Safari';
        else if (userAgent.includes('Edge')) clientName = 'Edge';
    }

    const activeSessions = await this.find({ userId, isActive: true, expiresAt: { $gt: new Date() } }).sort({ lastActivityAt: 1 });
    if (activeSessions.length >= maxSessions) {
        const oldest = activeSessions[0];
        oldest.isActive = false;
        oldest.loggedOutAt = new Date();
        oldest.logoutReason = 'session_limit';
        await oldest.save();
    }

    return this.create({
        userId, refreshTokenHash, userAgent, ipAddress, deviceType, clientName, expiresAt
    });
};

sessionSchema.statics.validateAndRefreshSession = async function (refreshToken) {
    const crypto = require('crypto');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.findOne({ refreshTokenHash, isActive: true, expiresAt: { $gt: new Date() } });
    if (session) {
        session.lastActivityAt = new Date();
        await session.save();
    }
    return session;
};

sessionSchema.statics.rotateRefreshToken = async function (oldRefreshToken, newRefreshToken, newExpiresAt) {
    const crypto = require('crypto');
    const oldHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const session = await this.findOne({ refreshTokenHash: oldHash, isActive: true });
    if (session) {
        session.refreshTokenHash = newHash;
        session.expiresAt = newExpiresAt;
        session.lastActivityAt = new Date();
        await session.save();
        return session;
    }
    return null;
};

sessionSchema.statics.invalidateSession = async function (refreshToken) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    return this.findOneAndUpdate({ refreshTokenHash: hash, isActive: true }, { isActive: false, loggedOutAt: new Date(), logoutReason: 'user_logout' });
};

sessionSchema.statics.invalidateAllUserSessions = async function (userId, reason = 'forced_logout') {
    return this.updateMany({ userId, isActive: true }, { isActive: false, loggedOutAt: new Date(), logoutReason: reason });
};

sessionSchema.statics.getActiveSessions = async function (userId) {
    return this.find({ userId, isActive: true, expiresAt: { $gt: new Date() } }).lean();
};

module.exports = mongoose.model('Session', sessionSchema);

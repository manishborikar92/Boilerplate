const jwt = require('jsonwebtoken');
const { AuthenticationError, InternalError } = require('./errorHandler');

// Token expiration constants
const ACCESS_TOKEN_EXPIRE = process.env.JWT_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

// Generate Access Token
const generateAccessToken = (userId, role) => {
    if (!process.env.JWT_SECRET) {
        throw new InternalError('JWT_SECRET not configured');
    }

    try {
        return jwt.sign(
            { userId, role, type: 'access' },
            process.env.JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRE }
        );
    } catch (error) {
        throw new InternalError('Failed to generate access token');
    }
};

// Generate Refresh Token
const generateRefreshToken = (userId) => {
    if (!process.env.JWT_REFRESH_SECRET) {
        throw new InternalError('JWT_REFRESH_SECRET not configured');
    }

    try {
        return jwt.sign(
            { userId, type: 'refresh' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRE }
        );
    } catch (error) {
        throw new InternalError('Failed to generate refresh token');
    }
};

const getTokenExpiration = (token) => {
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            return decoded.exp * 1000;
        }
        return Date.now() + 15 * 60 * 1000;
    } catch (error) {
        return Date.now() + 15 * 60 * 1000;
    }
};

const getRefreshTokenExpirationDate = () => {
    const expire = REFRESH_TOKEN_EXPIRE;
    const match = expire.match(/^(\d+)([smhd])$/);

    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        return new Date(Date.now() + value * multipliers[unit]);
    }
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
};

const verifyAccessToken = (token) => {
    if (!process.env.JWT_SECRET) {
        throw new InternalError('JWT_SECRET not configured');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'access') {
            throw new AuthenticationError('Invalid token type');
        }
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthenticationError('Access token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid access token');
        }
        throw error;
    }
};

const verifyRefreshToken = (token) => {
    if (!process.env.JWT_REFRESH_SECRET) {
        throw new InternalError('JWT_REFRESH_SECRET not configured');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        if (decoded.type !== 'refresh') {
            throw new AuthenticationError('Invalid token type');
        }
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthenticationError('Refresh token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid refresh token');
        }
        throw error;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    getTokenExpiration,
    getRefreshTokenExpirationDate
};

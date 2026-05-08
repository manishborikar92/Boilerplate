import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import customerRepository from '../repositories/customer.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import userRepository from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/api-error.js';
import { serializeBarberProfile } from '../utils/barber-profile.utils.js';
import { ROLES, TOKEN_TYPE } from '../utils/constants.js';
import logger, { maskPhoneNumber } from '../utils/logger.js';
import { serializeCustomerProfile } from '../serializers/customer.serializer.js';
import { serializeUser } from '../serializers/user.serializer.js';

const normalizePhoneNumber = (phoneNumber) => {
    const value = String(phoneNumber ?? '').trim();
    if (!value) return value;

    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 10) return `+91${digitsOnly}`;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return `+${digitsOnly}`;
    if (value.startsWith('+')) return value;

    return value;
};

const assertAccountIsActive = (user) => {
    if (!user || user.isActive === false || user.deletedAt) {
        throw new UnauthorizedError('Account is inactive or deleted');
    }
};

const loadUserProfile = async (user) => {
    if (!user) return null;

    if (user.roleType === ROLES.CUSTOMER) {
        const customer = await customerRepository.findByUserId(user._id);
        return serializeCustomerProfile(customer);
    }

    if (user.roleType === ROLES.BARBER) {
        const shop = await shopRepository.findByOwnerId(user._id);
        if (!shop) return null;

        const photos = await photoRepository.findByShopId(shop._id, {});
        return serializeBarberProfile(shop, user, { photos });
    }

    return null;
};

/** Generate a short-lived onboarding token. */
export const generateOnboardingToken = (phoneNumber) => jwt.sign(
    {
        sub: phoneNumber,
        type: TOKEN_TYPE.ONBOARDING,
    },
    config.jwt.accessSecret,
    { expiresIn: '24h' },
);

/** Generate a pair of access + refresh tokens. */
export const generateTokenPair = (userId, roleType) => {
    const accessToken = jwt.sign(
        {
            sub: userId.toString(),
            role: roleType,
            type: TOKEN_TYPE.ACCESS,
            jti: crypto.randomUUID(),
        },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiry },
    );

    const refreshToken = jwt.sign(
        {
            sub: userId.toString(),
            type: TOKEN_TYPE.REFRESH,
            jti: crypto.randomUUID(),
        },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiry },
    );

    return { accessToken, refreshToken };
};

/** Verify a bearer token signed with the access secret. */
export const verifyBearerToken = (token) => {
    try {
        return jwt.verify(token, config.jwt.accessSecret);
    } catch {
        throw new UnauthorizedError('Invalid or expired token');
    }
};

/** Verify a refresh token and return decoded payload. */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.refreshSecret);
        if (decoded.type !== TOKEN_TYPE.REFRESH) {
            throw new UnauthorizedError('Invalid token type');
        }

        return decoded;
    } catch {
        throw new UnauthorizedError('Invalid or expired refresh token');
    }
};

/** Hash a refresh token for secure storage. */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Resolve user session after OTP verification.
 *
 * Returning users receive access/refresh tokens.
 * New users receive a short-lived onboarding token carrying only the verified phone number.
 */
export const resolveOtpSession = async (phoneNumber) => {
    const formattedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const existingUser = await userRepository.findByPhone(formattedPhoneNumber);

    if (existingUser) {
        assertAccountIsActive(existingUser);

        await userRepository.updateLastLogin(existingUser._id);

        const tokens = generateTokenPair(existingUser._id, existingUser.roleType);
        const refreshHash = hashToken(tokens.refreshToken);
        const authenticatedUser = await userRepository.updateById(existingUser._id, {
            refreshTokenHash: refreshHash,
        });

        const user = authenticatedUser || existingUser;
        const profile = await loadUserProfile(user);

        return {
            isNewUser: false,
            user: serializeUser(user),
            profile,
            tokens,
        };
    }

    const onboardingToken = generateOnboardingToken(formattedPhoneNumber);

    logger.info('OTP verified for new user - issued onboarding token', {
        phone: maskPhoneNumber(formattedPhoneNumber),
    });

    return { isNewUser: true, onboardingToken };
};

/** Refresh an access token using a valid refresh token. */
export const refreshAccessToken = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.sub;
    const user = await userRepository.findByIdWithRefreshHash(userId);

    assertAccountIsActive(user);

    const incomingHash = hashToken(refreshToken);
    if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
        logger.warn('Refresh token mismatch - possible token theft', { userId });
        await userRepository.updateById(userId, { refreshTokenHash: null });
        throw new UnauthorizedError('Session invalidated. Please sign in again.');
    }

    const tokens = generateTokenPair(user._id, user.roleType);
    const newRefreshHash = hashToken(tokens.refreshToken);
    await userRepository.updateById(userId, { refreshTokenHash: newRefreshHash });

    return tokens;
};

/** Invalidate refresh token (logout). */
export const revokeRefreshToken = async (userId) => {
    await userRepository.updateById(userId, { refreshTokenHash: null });
};

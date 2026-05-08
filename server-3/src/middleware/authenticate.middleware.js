import * as authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { AppError, ConflictError, UnauthorizedError } from '../utils/api-error.js';
import { TOKEN_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';

const extractBearerToken = (req, missingMessage) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError(missingMessage);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        throw new UnauthorizedError(missingMessage);
    }

    return token;
};

const loadActiveUser = async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt || user.isActive === false) {
        throw new UnauthorizedError('Account is inactive or deleted');
    }

    return user;
};

export const authenticate = async (req, _res, next) => {
    try {
        const token = extractBearerToken(req, 'No token provided');
        const decoded = authService.verifyBearerToken(token);

        if (decoded.type !== TOKEN_TYPE.ACCESS) {
            throw new UnauthorizedError('Standard account access token required');
        }

        const user = await loadActiveUser(decoded.sub);

        req.user = {
            _id: user._id,
            roleType: user.roleType,
            phoneNumber: user.phoneNumber,
            email: user.email || null,
            emailVerified: Boolean(user.emailVerified),
        };

        return next();
    } catch (err) {
        if (err instanceof AppError) {
            return next(err);
        }

        logger.warn('Token verification failed', { error: err.message });
        return next(new UnauthorizedError('Invalid or expired token'));
    }
};

export const authenticateOnboarding = async (req, _res, next) => {
    try {
        const token = extractBearerToken(req, 'No token provided');
        const decoded = authService.verifyBearerToken(token);

        if (decoded.type !== TOKEN_TYPE.ONBOARDING) {
            throw new UnauthorizedError('Onboarding token required');
        }

        const existingUser = await userRepository.findByPhone(decoded.sub);
        if (existingUser) {
            throw new ConflictError('Phone number already registered');
        }

        req.onboardingContext = {
            phoneNumber: decoded.sub,
        };

        return next();
    } catch (err) {
        if (err instanceof AppError) {
            return next(err);
        }

        logger.warn('Token verification failed', { error: err.message });
        return next(new UnauthorizedError('Invalid or expired token'));
    }
};

export default authenticate;

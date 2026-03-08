const { verifyAccessToken } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');
const User = require('../models/User');
const {
    asyncHandler,
    AuthenticationError,
    AuthorizationError
} = require('../utils/errorHandler');

// Protect routes - verify JWT token
const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AuthenticationError('Not authorized to access this route');
    }

    if (isTokenBlacklisted(token)) {
        throw new AuthenticationError('Token has been invalidated. Please login again.');
    }

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
        throw new AuthenticationError('User not found');
    }

    if (user.isDeleted) {
        throw new AuthorizationError('Account has been deleted');
    }

    if (user.isLocked) {
        throw new AuthorizationError('Account is locked due to multiple failed login attempts');
    }

    req.user = user;
    next();
});

// Authorize specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new AuthenticationError('Not authorized');
        }

        if (!roles.includes(req.user.role)) {
            throw new AuthorizationError(
                `Role '${req.user.role}' is not authorized to access this route`
            );
        }

        next();
    };
};

module.exports = { protect, authorize };

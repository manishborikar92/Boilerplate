/**
 * Custom Error Classes and Error Handling Utilities
 * Provides centralized error handling for the application
 */

/**
 * Base API Error Class
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error (400)
 */
class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400);
    }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403);
    }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
    }
}

/**
 * Too Many Requests Error (429)
 */
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429);
    }
}

/**
 * Internal Server Error (500)
 */
class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, false);
    }
}

/**
 * Database Error Handler
 */
const handleDatabaseError = (error) => {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return new ValidationError(`Validation failed: ${errors.join(', ')}`);
    }

    // Mongoose duplicate key error
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return new ConflictError(`${field} already exists`);
    }

    // Mongoose cast error (invalid ObjectId)
    if (error.name === 'CastError') {
        return new ValidationError(`Invalid ${error.path}: ${error.value}`);
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return new AuthenticationError('Invalid token');
    }

    if (error.name === 'TokenExpiredError') {
        return new AuthenticationError('Token expired');
    }

    // Default to internal error
    return new InternalError(error.message);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Send Error Response
 */
const sendErrorResponse = (err, req, res) => {
    const { statusCode = 500, message, status } = err;

    // Log error
    const { logger } = require('../middleware/logger');
    logger.error('Error occurred', {
        error: message,
        stack: err.stack,
        statusCode,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?._id
    });

    // Operational errors - send detailed message
    if (err.isOperational) {
        return res.status(statusCode).json({
            success: false,
            status,
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }

    // Programming or unknown errors - don't leak details
    return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && {
            originalMessage: message,
            stack: err.stack
        })
    });
};

/**
 * Global Error Handler Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    // Handle known database errors
    if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
        err = handleDatabaseError(err);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        err = handleDatabaseError(err);
    }

    // Convert to AppError if not already
    if (!(err instanceof AppError)) {
        err = new InternalError(err.message);
    }

    // Send error response
    sendErrorResponse(err, req, res);
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    InternalError,
    asyncHandler,
    globalErrorHandler,
    handleDatabaseError
};

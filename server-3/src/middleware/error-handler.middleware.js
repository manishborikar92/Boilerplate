import { AppError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Global Express error-handling middleware.
 *
 * Must be the LAST app.use() call so it catches everything.
 * Handles operational errors (expected) differently from programmer bugs.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
    // -----------------------------------------------------------------------
    // 1. Multer-specific errors
    // -----------------------------------------------------------------------
    if (err.name === 'MulterError') {
        const messages = {
            LIMIT_FILE_SIZE: 'File too large. Maximum size is 5 MB.',
            LIMIT_FILE_COUNT: 'Too many files uploaded.',
            LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
        };
        const message = messages[err.code] || 'File upload error';
        return res.status(400).json(ApiResponse.error(message));
    }

    // -----------------------------------------------------------------------
    // 2. Mongoose ValidationError
    // -----------------------------------------------------------------------
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res
            .status(400)
            .json(ApiResponse.error('Validation failed', { errors }));
    }

    // -----------------------------------------------------------------------
    // 3. Mongoose duplicate-key error (code 11000)
    // -----------------------------------------------------------------------
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {}).join(', ');
        return res
            .status(409)
            .json(ApiResponse.error(`Duplicate value for: ${field}`));
    }

    // -----------------------------------------------------------------------
    // 4. Mongoose CastError (e.g. invalid ObjectId)
    // -----------------------------------------------------------------------
    if (err.name === 'CastError') {
        return res
            .status(400)
            .json(ApiResponse.error(`Invalid ${err.path}: ${err.value}`));
    }

    // -----------------------------------------------------------------------
    // 5. Our custom AppError hierarchy (operational errors)
    // -----------------------------------------------------------------------
    if (err instanceof AppError) {
        const data = Array.isArray(err.errors) && err.errors.length > 0
            ? { errors: err.errors }
            : {};

        return res
            .status(err.statusCode)
            .json(ApiResponse.error(err.message, data));
    }

    // -----------------------------------------------------------------------
    // 6. Unexpected / programmer errors
    // -----------------------------------------------------------------------
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
    });

    const message =
        config.env === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error';

    return res.status(500).json(ApiResponse.error(message));
};

export default errorHandler;

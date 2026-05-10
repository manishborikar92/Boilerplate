import { AppError, BadRequestError, ConflictError, InternalServerError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import logger from '../utils/logger.js';

const normalizeDatabaseError = (error) => {
  if (error.name === 'ValidationError') {
    return new BadRequestError('Validation failed', {
      errors: Object.values(error.errors || {}).map((item) => item.message),
    });
  }

  if (error.name === 'CastError') {
    return new BadRequestError('Invalid identifier', {
      path: error.path,
      value: error.value,
    });
  }

  if (error.code === 11000) {
    return new ConflictError('Duplicate value', {
      fields: Object.keys(error.keyPattern || {}),
    });
  }

  return error;
};

export const errorHandler = (err, req, res, _next) => {
  const normalized = normalizeDatabaseError(err);
  const error = normalized instanceof AppError
    ? normalized
    : new InternalServerError(normalized.message || 'Internal server error');

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error('Unhandled application error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: error.statusCode,
      error: normalized,
    });
  }

  const config = req.app.get('config');
  const details = error.statusCode >= 500 && config?.isProduction ? {} : error.details;

  res.status(error.statusCode).json(ApiResponse.error(error.message, details));
};

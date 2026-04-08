import env from '../config/env.js';
import { createErrorResponse } from '../utils/api-response.js';
import { AppError, ValidationError } from '../utils/app-error.js';
import logger from '../utils/logger.js';

const normalizeError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.isJoi) {
    return new ValidationError(
      'Request validation failed',
      error.details.map((detail) => ({
        message: detail.message,
        path: detail.path.join('.'),
        type: detail.type,
      })),
    );
  }

  if (error instanceof SyntaxError && Object.hasOwn(error, 'body')) {
    return new ValidationError('Malformed JSON payload');
  }

  return new AppError('Internal server error');
};

const errorHandler = (error, req, res, _next) => {
  const normalizedError = normalizeError(error);
  const activeLogger = req.logger ?? logger;
  const shouldExposeDetails = normalizedError.expose || env.isDevelopment;

  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    error,
  };

  if (normalizedError.statusCode >= 500) {
    activeLogger.error('request.failed.unhandled', logPayload);
  } else {
    activeLogger.warn('request.failed.handled', logPayload);
  }

  return res.status(normalizedError.statusCode).json(
    createErrorResponse({
      message: shouldExposeDetails ? normalizedError.message : 'Internal server error',
      code: normalizedError.code,
      details: shouldExposeDetails ? normalizedError.details : undefined,
      meta: { requestId: req.id },
    }),
  );
};

export default errorHandler;

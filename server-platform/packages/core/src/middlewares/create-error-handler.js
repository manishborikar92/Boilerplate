import { createErrorResponse } from '../http/api-response.js';
import { AppError, ValidationError } from '../errors/app-error.js';

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

const createErrorHandler = ({ logger, isDevelopment = false } = {}) => (error, req, res, _next) => {
  const normalizedError = normalizeError(error);
  const activeLogger = req.logger ?? logger;
  const shouldExpose = normalizedError.expose || isDevelopment;

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
      message: shouldExpose ? normalizedError.message : 'Internal server error',
      code: normalizedError.code,
      details: shouldExpose ? normalizedError.details : undefined,
      meta: { requestId: req.id },
    }),
  );
};

export default createErrorHandler;

export class AppError extends Error {
  constructor(message = 'Internal server error', statusCode = 500, details = {}, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = {}) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = {}) {
    super(message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 409, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details = {}) {
    super(message, 429, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = {}) {
    super(message, 500, details, false);
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

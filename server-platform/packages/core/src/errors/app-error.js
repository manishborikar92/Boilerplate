export class AppError extends Error {
  constructor(
    message = 'Internal server error',
    {
      statusCode = 500,
      code = 'INTERNAL_SERVER_ERROR',
      details,
      expose = statusCode < 500,
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details) {
    super(message, {
      statusCode: 400,
      code: 'BAD_REQUEST',
      details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
      details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(message, {
      statusCode: 409,
      code: 'CONFLICT',
      details,
    });
  }
}

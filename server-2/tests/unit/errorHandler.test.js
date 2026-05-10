jest.mock('../../src/middleware/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  asyncHandler,
  handleDatabaseError,
  globalErrorHandler
} = require('../../src/utils/errorHandler');

describe('Error Handler Utilities', () => {
  describe('Error Classes', () => {
    it('should create ValidationError with correct status code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.isOperational).toBe(true);
    });

    it('should create AuthenticationError with correct status code', () => {
      const error = new AuthenticationError('Not authenticated');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Not authenticated');
    });

    it('should create AuthorizationError with correct status code', () => {
      const error = new AuthorizationError('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });

    it('should create NotFoundError with correct status code', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    it('should create ConflictError with correct status code', () => {
      const error = new ConflictError('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource conflict');
    });

    it('should create InternalError with correct status code', () => {
      const error = new InternalError('Server error');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Server error');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const mockReq = {};
      const mockRes = {
        json: jest.fn()
      };
      const mockNext = jest.fn();

      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();
      const testError = new ValidationError('Test error');

      const handler = asyncHandler(async (req, res) => {
        throw testError;
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });
  });

  describe('handleDatabaseError', () => {
    it('should convert Mongoose ValidationError', () => {
      const mongooseError = {
        name: 'ValidationError',
        errors: {
          email: { message: 'Email is required' },
          password: { message: 'Password is required' }
        }
      };

      const error = handleDatabaseError(mongooseError);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Email is required');
    });

    it('should convert Mongoose duplicate key error', () => {
      const mongooseError = {
        code: 11000,
        keyPattern: { email: 1 }
      };

      const error = handleDatabaseError(mongooseError);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('email already exists');
    });

    it('should convert folder duplicate key errors into a folder-specific conflict message', () => {
      const mongooseError = {
        code: 11000,
        keyPattern: { clientId: 1, parentId: 1, normalizedName: 1, isDeleted: 1 },
        message: 'E11000 duplicate key error collection: test.folders index: clientId_1_parentId_1_normalizedName_1_isDeleted_1 dup key'
      };

      const error = handleDatabaseError(mongooseError);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('A folder with this name already exists in this location');
    });

    it('should convert Mongoose CastError', () => {
      const mongooseError = {
        name: 'CastError',
        path: 'userId',
        value: 'invalid-id'
      };

      const error = handleDatabaseError(mongooseError);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
    });

    it('should convert JWT errors', () => {
      const jwtError = {
        name: 'JsonWebTokenError',
        message: 'invalid token'
      };

      const error = handleDatabaseError(jwtError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
    });

    it('should convert TokenExpiredError', () => {
      const jwtError = {
        name: 'TokenExpiredError',
        message: 'jwt expired'
      };

      const error = handleDatabaseError(jwtError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AppError', () => {
    it('should set status to "fail" for 4xx errors', () => {
      const error = new AppError('Test error', 400);
      expect(error.status).toBe('fail');
    });

    it('should set status to "error" for 5xx errors', () => {
      const error = new AppError('Test error', 500);
      expect(error.status).toBe('error');
    });

    it('should be operational by default', () => {
      const error = new AppError('Test error', 400);
      expect(error.isOperational).toBe(true);
    });

    it('should allow setting isOperational to false', () => {
      const error = new AppError('Test error', 500, false);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('globalErrorHandler', () => {
    it('returns operational error details', () => {
      process.env.NODE_ENV = 'development';
      const err = new ValidationError('Bad input');
      const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Bad input'
      }));
    });

    it('wraps unknown errors as InternalError', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('boom');
      const req = { method: 'POST', originalUrl: '/y', ip: '1.1.1.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Something went wrong'
      }));
    });

    it('converts database errors', () => {
      const err = {
        name: 'ValidationError',
        errors: {
          field: { message: 'Required' }
        }
      };
      const req = { method: 'GET', originalUrl: '/z', ip: '1.1.1.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('Required')
      }));
    });
  });
});

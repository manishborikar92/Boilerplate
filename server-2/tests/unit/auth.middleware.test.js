jest.mock('../../src/utils/tokenBlacklist', () => ({
  isTokenBlacklisted: jest.fn(() => false)
}));

const { protect, authorize } = require('../../src/middleware/auth');
const User = require('../../src/models/User');
const { generateAccessToken } = require('../../src/utils/jwt');
const { AuthenticationError, AuthorizationError } = require('../../src/utils/errorHandler');
const { isTokenBlacklisted } = require('../../src/utils/tokenBlacklist');

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

describe('Auth Middleware', () => {
  describe('protect middleware', () => {
    let req, res, next;

    beforeEach(async () => {
      await User.deleteMany({});
      req = {
        headers: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should fail without authorization header', async () => {
      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
    });

    it('should fail with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should fail with blacklisted token', async () => {
      const user = await User.create({
        email: 'blocked@example.com',
        name: 'Blocked User',
        password: 'password123'
      });
      const token = generateAccessToken(user._id.toString(), user.role);
      req.headers.authorization = `Bearer ${token}`;
      isTokenBlacklisted.mockReturnValueOnce(true);

      await protect(req, res, next);

      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should fail when user not found', async () => {
      const token = generateAccessToken('507f1f77bcf86cd799439011', 'Client');
      req.headers.authorization = `Bearer ${token}`;

      await new Promise((resolve) => {
        next = jest.fn((error) => resolve(error));
        protect(req, res, next);
      });

      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should fail when user is deleted', async () => {
      const user = await User.create({
        email: 'deleted@example.com',
        name: 'Deleted User',
        password: 'password123',
        isDeleted: true
      });

      const token = generateAccessToken(user._id.toString(), user.role);
      req.headers.authorization = `Bearer ${token}`;

      await new Promise((resolve) => {
        next = jest.fn((error) => resolve(error));
        protect(req, res, next);
      });

      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    it('should succeed with valid token and active user', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

      const token = generateAccessToken(user._id.toString(), user.role);
      req.headers.authorization = `Bearer ${token}`;

      // Wrap in promise to wait for next() to be called
      await new Promise((resolve) => {
        next = jest.fn(resolve);
        protect(req, res, next);
      });

      // Check that user was attached to request
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe(user.email);
      expect(next).toHaveBeenCalledWith(); // Called without error
    });

    it('should fail with inactive user', async () => {
      const user = await User.create({
        email: 'test2@example.com',
        name: 'Test User',
        password: 'password123',
        lockUntil: new Date(Date.now() + 60_000)
      });

      const token = generateAccessToken(user._id.toString(), user.role);
      req.headers.authorization = `Bearer ${token}`;

      // Wrap in promise to wait for next() to be called
      await new Promise((resolve) => {
        next = jest.fn((error) => resolve(error));
        protect(req, res, next);
      });

      // Check that next was called with an error
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('authorize middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should fail without user in request', () => {
      const middleware = authorize('CA-Admin');
      
      expect(() => {
        middleware(req, res, next);
      }).toThrow(AuthenticationError);
    });

    it('should fail with unauthorized role', () => {
      req.user = { role: 'Client' };
      const middleware = authorize('CA-Admin');
      
      expect(() => {
        middleware(req, res, next);
      }).toThrow(AuthorizationError);
    });

    it('should succeed with authorized role', () => {
      req.user = { role: 'CA-Admin' };
      const middleware = authorize('CA-Admin');
      
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should succeed with multiple authorized roles', () => {
      req.user = { role: 'CA-Employee' };
      const middleware = authorize('CA-Admin', 'CA-Employee');
      
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

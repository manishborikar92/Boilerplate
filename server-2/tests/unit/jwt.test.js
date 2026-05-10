const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} = require('../../src/utils/jwt');

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

describe('JWT Utilities', () => {
  const userId = '507f1f77bcf86cd799439011';
  const role = 'Client';

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(userId, role);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include userId and role in token payload', () => {
      const token = generateAccessToken(userId, role);
      const decoded = verifyAccessToken(token);
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
      expect(decoded.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include userId in token payload', () => {
      const token = generateRefreshToken(userId);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(userId, role);
      const decoded = verifyAccessToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(userId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for refresh token used as access token', () => {
      const refreshToken = generateRefreshToken(userId);
      
      expect(() => {
        verifyAccessToken(refreshToken);
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(userId);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(userId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyRefreshToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = generateAccessToken(userId, role);
      
      expect(() => {
        verifyRefreshToken(accessToken);
      }).toThrow();
    });
  });
});

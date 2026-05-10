jest.mock('express-rate-limit', () => jest.fn((options) => options));

describe('rateLimiter middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('configures limiters for test environment', () => {
    process.env.NODE_ENV = 'test';
    const {
      apiLimiter,
      authLimiter,
      passwordResetLimiter,
      emailVerificationLimiter,
      uploadLimiter
    } = require('../../src/middleware/rateLimiter');

    expect(apiLimiter.max).toBe(1000);
    expect(authLimiter.max).toBe(1000);
    expect(passwordResetLimiter.max).toBe(1000);
    expect(emailVerificationLimiter.max).toBe(1000);
    expect(uploadLimiter.max).toBe(1000);
    expect(apiLimiter.skip()).toBe(true);
  });

  it('configures limiters for development', () => {
    process.env.NODE_ENV = 'development';
    const { apiLimiter, authLimiter, uploadLimiter } = require('../../src/middleware/rateLimiter');

    expect(apiLimiter.max).toBe(800);
    expect(authLimiter.max).toBe(50);
    expect(uploadLimiter.max).toBe(200);
    expect(apiLimiter.skip()).toBe(false);
  });

  it('configures limiters for production defaults', () => {
    process.env.NODE_ENV = 'production';
    const { apiLimiter, authLimiter, uploadLimiter } = require('../../src/middleware/rateLimiter');

    expect(apiLimiter.max).toBe(500);
    expect(authLimiter.max).toBe(15);
    expect(uploadLimiter.max).toBe(100);
    expect(apiLimiter.skip()).toBe(false);
  });
});

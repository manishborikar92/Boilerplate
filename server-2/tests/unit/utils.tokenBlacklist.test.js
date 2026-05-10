jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn()
  }
}));

const loadModule = () => {
  let tokenBlacklist;
  jest.isolateModules(() => {
    tokenBlacklist = require('../../src/utils/tokenBlacklist');
  });
  return tokenBlacklist;
};

describe('tokenBlacklist', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('blacklists and checks tokens', () => {
    const { blacklistToken, isTokenBlacklisted, clearBlacklist, getBlacklistCount } = loadModule();
    clearBlacklist();
    blacklistToken('token-1', Date.now() + 10000);
    expect(isTokenBlacklisted('token-1')).toBe(true);
    expect(getBlacklistCount()).toBe(1);
    clearBlacklist();
    expect(getBlacklistCount()).toBe(0);
  });

  it('cleans up expired tokens', () => {
    const { blacklistToken, cleanupExpiredTokens, getBlacklistCount, clearBlacklist } = loadModule();
    clearBlacklist();
    blacklistToken('token-expired', Date.now() - 1000);
    expect(getBlacklistCount()).toBe(1);
    cleanupExpiredTokens();
    expect(getBlacklistCount()).toBe(0);
  });

  it('stops cleanup interval', () => {
    process.env.NODE_ENV = 'production';
    const { stopCleanup } = loadModule();
    expect(() => stopCleanup()).not.toThrow();
  });
});

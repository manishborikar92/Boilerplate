jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const { logger } = require('../../src/middleware/logger');
const {
  AUTH_EVENTS,
  logAuthEvent,
  logLoginSuccess,
  logLoginFailure,
  logAccountLocked,
  logSuspiciousActivity,
  logTokenRefresh,
  logLogout
} = require('../../src/utils/authLogger');

describe('authLogger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('logs info events', () => {
    logAuthEvent(AUTH_EVENTS.LOGIN_SUCCESS, { userId: '1' });
    expect(logger.info).toHaveBeenCalled();
  });

  it('logs warn events for failures', () => {
    logAuthEvent(AUTH_EVENTS.LOGIN_FAILURE, { reason: 'bad' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs specialized events', () => {
    logLoginSuccess('1', 'a@test.com', 'Client', 'email', 'ip', 'ua');
    logLoginFailure('a@test.com', 'bad', 'ip');
    logAccountLocked('1', 'a@test.com', 5, 'ip');
    logSuspiciousActivity('test', { ip: 'ip' });
    logTokenRefresh('1', false);
    logLogout('1', true);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

let capturedPrintf;
jest.mock('winston', () => {
  const format = {
    combine: jest.fn(() => 'combine'),
    timestamp: jest.fn(() => 'timestamp'),
    errors: jest.fn(() => 'errors'),
    splat: jest.fn(() => 'splat'),
    json: jest.fn(() => 'json'),
    colorize: jest.fn(() => 'colorize'),
    printf: jest.fn((fn) => {
      capturedPrintf = fn;
      return 'printf';
    })
  };
  const transports = {
    File: jest.fn(),
    Console: jest.fn()
  };
  return {
    format,
    transports,
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      add: jest.fn()
    }))
  };
});

describe('logger middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('logs successful requests', () => {
    process.env.NODE_ENV = 'production';
    const { logger, requestLogger } = require('../../src/middleware/logger');
    const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1', get: jest.fn() };
    let finish;
    const res = {
      statusCode: 200,
      on: (event, cb) => {
        if (event === 'finish') finish = cb;
      }
    };
    const next = jest.fn();

    requestLogger(req, res, next);
    finish();

    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('logs failed requests', () => {
    process.env.NODE_ENV = 'production';
    const { logger, requestLogger } = require('../../src/middleware/logger');
    const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1', get: jest.fn() };
    let finish;
    const res = {
      statusCode: 500,
      on: (event, cb) => {
        if (event === 'finish') finish = cb;
      }
    };
    const next = jest.fn();

    requestLogger(req, res, next);
    finish();

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs errors and passes to next', () => {
    process.env.NODE_ENV = 'production';
    const { logger, errorLogger } = require('../../src/middleware/logger');
    const err = new Error('boom');
    const req = { method: 'GET', originalUrl: '/x', ip: '1.1.1.1' };
    const res = {};
    const next = jest.fn();

    errorLogger(err, req, res, next);

    expect(logger.error).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it('adds console transport in development', () => {
    process.env.NODE_ENV = 'development';
    const { logger } = require('../../src/middleware/logger');
    expect(logger.add).toHaveBeenCalled();
  });

  it('formats log output with metadata', () => {
    process.env.NODE_ENV = 'development';
    require('../../src/middleware/logger');
    const output = capturedPrintf({
      timestamp: '12:00:00',
      level: 'info',
      message: 'hello',
      service: undefined,
      extra: 'data'
    });
    expect(output).toBe('[12:00:00] info: hello {"extra":"data"}');
  });
});

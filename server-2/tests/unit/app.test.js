const request = require('supertest');

const buildAppWithEnv = async (env) => {
  process.env.NODE_ENV = env;
  let app;
  await jest.isolateModulesAsync(async () => {
    app = require('../../src/app');
  });
  return app;
};

describe('app', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('uses requestLogger in production', async () => {
    jest.doMock('../../src/middleware/logger', () => ({
      requestLogger: jest.fn((req, res, next) => {
        res.set('x-request-logger', 'on');
        next();
      }),
      errorLogger: jest.fn(),
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
    }));
    jest.doMock('morgan', () => jest.fn(() => (req, res, next) => next()));

    const app = await buildAppWithEnv('production');
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-logger']).toBe('on');
  });

  it('uses morgan in development', async () => {
    const morganMock = jest.fn(() => (req, res, next) => next());
    jest.doMock('morgan', () => morganMock);
    jest.doMock('../../src/middleware/logger', () => ({
      requestLogger: jest.fn((req, res, next) => next()),
      errorLogger: jest.fn(),
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
    }));

    const app = await buildAppWithEnv('development');
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(morganMock).toHaveBeenCalledWith('dev');
  });

  it('responds to health check', async () => {
    jest.doMock('../../src/services/socketManager', () => ({
      getMetrics: jest.fn(() => ({
        totalConnections: 3,
        onlineUsers: 2,
        rooms: 5
      }))
    }));

    const app = await buildAppWithEnv('test');
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.database).toBeDefined();
    expect(response.body.websocket).toEqual({
      totalConnections: 3,
      onlineUsers: 2,
      rooms: 5
    });
  });

  it('returns 404 for unknown routes', async () => {
    const app = await buildAppWithEnv('test');
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('not found');
  });
});

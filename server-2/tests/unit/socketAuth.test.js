const loadSocketConfig = () => {
  jest.resetModules();

  const ioInstance = {
    use: jest.fn(),
    on: jest.fn()
  };
  const Server = jest.fn(() => ioInstance);
  const verifyAccessToken = jest.fn();
  const isTokenBlacklisted = jest.fn().mockReturnValue(false);
  const query = {
    select: jest.fn()
  };
  const User = {
    findById: jest.fn(() => query)
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  const socketManager = {
    initialize: jest.fn()
  };

  jest.doMock('socket.io', () => ({ Server }));
  jest.doMock('../../src/utils/jwt', () => ({ verifyAccessToken }));
  jest.doMock('../../src/utils/tokenBlacklist', () => ({ isTokenBlacklisted }));
  jest.doMock('../../src/models/User', () => User);
  jest.doMock('../../src/middleware/logger', () => ({ logger }));
  jest.doMock('../../src/services/socketManager', () => socketManager);

  let socketConfig;
  jest.isolateModules(() => {
    socketConfig = require('../../src/config/socket');
  });

  return {
    socketConfig,
    ioInstance,
    mocks: {
      Server,
      verifyAccessToken,
      isTokenBlacklisted,
      User,
      query,
      logger,
      socketManager
    }
  };
};

describe('socket auth middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates a socket with a valid access token', async () => {
    const { socketConfig, ioInstance, mocks } = loadSocketConfig();
    const httpServer = {};
    const user = {
      _id: { toString: () => 'u1' },
      name: 'Socket User',
      email: 'socket@example.com',
      role: 'CA-Admin',
      firmId: { toString: () => 'firm-1' },
      isLocked: false
    };
    const next = jest.fn();
    const socket = {
      id: 'socket-1',
      handshake: {
        auth: { token: 'valid-token' },
        headers: {}
      }
    };

    mocks.verifyAccessToken.mockReturnValue({ userId: 'u1' });
    mocks.query.select.mockResolvedValue(user);

    const io = socketConfig.initializeSocket(httpServer);
    const middleware = ioInstance.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(io).toBe(ioInstance);
    expect(mocks.Server).toHaveBeenCalledWith(httpServer, expect.objectContaining({
      transports: ['websocket', 'polling']
    }));
    expect(mocks.socketManager.initialize).toHaveBeenCalledWith(ioInstance);
    expect(mocks.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(mocks.User.findById).toHaveBeenCalledWith('u1');
    expect(socket.user).toEqual({
      _id: 'u1',
      name: 'Socket User',
      email: 'socket@example.com',
      role: 'CA-Admin',
      firmId: 'firm-1'
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects blacklisted socket tokens before JWT verification', async () => {
    const { socketConfig, ioInstance, mocks } = loadSocketConfig();
    const next = jest.fn();
    const socket = {
      id: 'socket-2',
      handshake: {
        auth: {},
        headers: {
          authorization: 'Bearer blacklisted-token'
        }
      }
    };

    mocks.isTokenBlacklisted.mockReturnValue(true);

    socketConfig.initializeSocket({});
    const middleware = ioInstance.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Token has been invalidated'
    }));
  });

  it('rejects invalid socket tokens and logs the auth failure', async () => {
    const { socketConfig, ioInstance, mocks } = loadSocketConfig();
    const next = jest.fn();
    const socket = {
      id: 'socket-3',
      handshake: {
        auth: { token: 'bad-token' },
        headers: {}
      }
    };

    mocks.verifyAccessToken.mockImplementation(() => {
      throw new Error('Invalid access token');
    });

    socketConfig.initializeSocket({});
    const middleware = ioInstance.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(mocks.logger.error).toHaveBeenCalledWith('Socket authentication failed', {
      error: 'Invalid access token',
      socketId: 'socket-3'
    });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Authentication failed'
    }));
  });
});

const buildSocketManager = () => {
  jest.resetModules();

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  const Client = {
    findOne: jest.fn()
  };
  const Thread = {
    findOne: jest.fn()
  };

  jest.doMock('../../src/middleware/logger', () => ({ logger }));
  jest.doMock('../../src/models/Client', () => Client);
  jest.doMock('../../src/models/Thread', () => Thread);

  let socketManager;
  jest.isolateModules(() => {
    socketManager = require('../../src/services/socketManager');
  });

  return {
    socketManager,
    mocks: {
      logger,
      Client,
      Thread
    }
  };
};

const createIoDouble = () => {
  const roomTarget = {
    emit: jest.fn(),
    except: jest.fn()
  };

  roomTarget.except.mockReturnValue(roomTarget);

  return {
    io: {
      on: jest.fn(),
      to: jest.fn(() => roomTarget),
      engine: {
        clientsCount: 2
      },
      sockets: {
        adapter: {
          rooms: new Map([
            ['socket-1', new Set(['socket-1'])],
            ['socket-2', new Set(['socket-2'])],
            ['user:u1', new Set(['socket-1'])],
            ['firm:f1', new Set(['socket-1'])]
          ])
        },
        sockets: new Map([
          ['socket-1', {}],
          ['socket-2', {}]
        ])
      }
    },
    roomTarget
  };
};

const createSocketDouble = ({ id, user }) => {
  const handlers = {};
  const roomTarget = {
    emit: jest.fn()
  };

  return {
    id,
    user,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    to: jest.fn(() => roomTarget),
    handlers,
    roomTarget
  };
};

const mockThreadAccessQuery = (Thread, thread) => {
  const lean = jest.fn().mockResolvedValue(thread);
  const select = jest.fn().mockReturnValue({ lean });
  Thread.findOne.mockReturnValue({ select });
  return { select, lean };
};

describe('socketManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('emits notifications to the recipient user room', () => {
    const { socketManager } = buildSocketManager();
    const { io, roomTarget } = createIoDouble();

    socketManager.initialize(io);
    socketManager.emitNotification('user-123', {
      _id: 'notif-1',
      type: 'thread',
      subtype: 'thread_created',
      priority: 'normal',
      title: 'New Thread',
      message: 'A new thread was created',
      actionUrl: '/app/conversations/1',
      actionLabel: 'View',
      relatedEntity: { entityType: 'Thread', entityId: 'thread-1' },
      metadata: { subject: 'GST' },
      createdAt: '2026-03-23T10:00:00.000Z'
    });

    expect(io.to).toHaveBeenCalledWith('user:user-123');
    expect(roomTarget.emit).toHaveBeenCalledWith('notification:new', {
      notification: expect.objectContaining({
        _id: 'notif-1',
        subtype: 'thread_created',
        message: 'A new thread was created'
      })
    });
  });

  it('emits new thread messages to the room and excludes the sender socket when provided', () => {
    const { socketManager } = buildSocketManager();
    const { io, roomTarget } = createIoDouble();
    const message = { _id: 'm1', content: 'Hello there' };

    socketManager.initialize(io);
    socketManager.emitNewMessage('thread-1', message, 'socket-1');

    expect(io.to).toHaveBeenCalledWith('thread:thread-1');
    expect(roomTarget.except).toHaveBeenCalledWith('socket-1');
    expect(roomTarget.emit).toHaveBeenCalledWith('thread:new-message', {
      threadId: 'thread-1',
      message
    });
  });

  it('emits thread list updates to both the firm room and the owning client user room', () => {
    const { socketManager } = buildSocketManager();
    const { io, roomTarget } = createIoDouble();
    const threadSummary = {
      _id: 'thread-1',
      subject: 'GST filing',
      status: 'pending-client'
    };

    socketManager.initialize(io);
    socketManager.emitThreadListUpdate('firm-1', threadSummary, {
      clientUserId: 'client-user-1'
    });

    expect(io.to).toHaveBeenNthCalledWith(1, 'firm:firm-1');
    expect(io.to).toHaveBeenNthCalledWith(2, 'user:client-user-1');
    expect(roomTarget.emit).toHaveBeenNthCalledWith(1, 'thread:list-updated', {
      thread: threadSummary
    });
    expect(roomTarget.emit).toHaveBeenNthCalledWith(2, 'thread:list-updated', {
      thread: threadSummary
    });
  });

  it('tracks online users across connect and disconnect and reports websocket metrics', async () => {
    const { socketManager } = buildSocketManager();
    const { io } = createIoDouble();
    const socket = createSocketDouble({
      id: 'socket-1',
      user: {
        _id: 'u1',
        role: 'CA-Admin',
        firmId: 'f1',
        name: 'Admin User'
      }
    });

    socketManager.initialize(io);
    const connectionHandler = io.on.mock.calls.find(([eventName]) => eventName === 'connection')[1];

    await connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith('user:u1');
    expect(socket.join).toHaveBeenCalledWith('firm:f1');
    expect(socket.roomTarget.emit).toHaveBeenNthCalledWith(1, 'user:online', {
      userId: 'u1',
      role: 'CA-Admin',
      name: 'Admin User'
    });
    expect(socketManager.isUserOnline('u1')).toBe(true);
    expect(socketManager.getOnlineUserIds()).toEqual(['u1']);
    expect(socketManager.getMetrics()).toEqual({
      totalConnections: 2,
      onlineUsers: 1,
      rooms: 2
    });

    socket.handlers.disconnect('transport close');

    expect(socket.roomTarget.emit).toHaveBeenNthCalledWith(2, 'user:offline', {
      userId: 'u1',
      role: 'CA-Admin'
    });
    expect(socketManager.isUserOnline('u1')).toBe(false);
    expect(socketManager.getOnlineUserIds()).toEqual([]);
  });

  it('rate limits thread joins per user within a one-minute window', async () => {
    const { socketManager, mocks } = buildSocketManager();
    const { io } = createIoDouble();
    const socket = createSocketDouble({
      id: 'socket-join',
      user: {
        _id: 'u1',
        role: 'CA-Admin',
        firmId: 'f1',
        name: 'Admin User'
      }
    });

    mockThreadAccessQuery(mocks.Thread, {
      _id: 'thread-1',
      firmId: 'f1',
      clientId: 'c1'
    });

    socketManager.initialize(io);
    const connectionHandler = io.on.mock.calls.find(([eventName]) => eventName === 'connection')[1];

    await connectionHandler(socket);

    for (let index = 0; index < 30; index += 1) {
      await socket.handlers['thread:join']('thread-1');
    }

    expect(socket.join).toHaveBeenCalledTimes(32); // user room + firm room + 30 thread joins

    await socket.handlers['thread:join']('thread-1');

    expect(socket.join).toHaveBeenCalledTimes(32);
    expect(socket.emit).toHaveBeenCalledWith('socket:rate-limit', expect.objectContaining({
      event: 'thread:join'
    }));

    jest.advanceTimersByTime(60 * 1000);

    await socket.handlers['thread:join']('thread-1');

    expect(socket.join).toHaveBeenCalledTimes(33);
  });

  it('rate limits typing events per user within a one-minute window', async () => {
    const { socketManager, mocks } = buildSocketManager();
    const { io } = createIoDouble();
    const socket = createSocketDouble({
      id: 'socket-typing',
      user: {
        _id: 'u1',
        role: 'CA-Admin',
        firmId: 'f1',
        name: 'Admin User'
      }
    });

    mockThreadAccessQuery(mocks.Thread, {
      _id: 'thread-1',
      firmId: 'f1',
      clientId: 'c1'
    });

    socketManager.initialize(io);
    const connectionHandler = io.on.mock.calls.find(([eventName]) => eventName === 'connection')[1];

    await connectionHandler(socket);

    for (let index = 0; index < 60; index += 1) {
      await socket.handlers['thread:typing']({
        threadId: 'thread-1',
        isTyping: true
      });
    }

    expect(socket.roomTarget.emit).toHaveBeenCalledTimes(61); // user:online + 60 typing relays

    await socket.handlers['thread:typing']({
      threadId: 'thread-1',
      isTyping: true
    });

    expect(socket.roomTarget.emit).toHaveBeenCalledTimes(61);
    expect(socket.emit).toHaveBeenCalledWith('socket:rate-limit', expect.objectContaining({
      event: 'thread:typing'
    }));

    jest.advanceTimersByTime(60 * 1000);

    await socket.handlers['thread:typing']({
      threadId: 'thread-1',
      isTyping: true
    });

    expect(socket.roomTarget.emit).toHaveBeenCalledTimes(62);
  });
});

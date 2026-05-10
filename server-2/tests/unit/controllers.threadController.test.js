const mongoose = require('mongoose');

const buildController = (overrides = {}) => {
  jest.resetModules();
  const threadModel = {
    generateThreadNumber: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    schema: {
      path: jest.fn().mockReturnValue({ enumValues: ['open', 'pending-ca', 'pending-client', 'resolved', 'closed'] })
    }
  };
  const messageModel = {
    create: jest.fn(),
    getThreadMessages: jest.fn(),
    markAsRead: jest.fn(),
    createSystemMessage: jest.fn()
  };
  const clientModel = { findOne: jest.fn(), findById: jest.fn() };
  const documentModel = { find: jest.fn() };
  const userModel = { findById: jest.fn() };

  Object.assign(threadModel, overrides.Thread || {});
  Object.assign(messageModel, overrides.Message || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(userModel, overrides.User || {});

  jest.doMock('../../src/models/Thread', () => threadModel);
  jest.doMock('../../src/models/Message', () => messageModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/models/User', () => userModel);
  jest.doMock('../../src/services/notificationService', () => ({
    notifyThreadCreated: jest.fn().mockRejectedValue(new Error('fail'))
  }));

  const controller = require('../../src/controllers/threadController');
  return { controller, mocks: { Thread: threadModel, Message: messageModel, Client: clientModel, Document: documentModel, User: userModel } };
};

const run = async (handler, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  await handler(req, res, next);
  await new Promise(setImmediate);
  return { res, next };
};

describe('threadController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates required fields', async () => {
    const { controller } = buildController();
    const { next } = await run(controller.createThread, {
      body: { subject: '', serviceType: '', message: '' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('required');
  });

  it('rejects client creation when profile missing', async () => {
    const { controller } = buildController({
      Client: { findOne: jest.fn().mockResolvedValue(null) }
    });
    const { next } = await run(controller.createThread, {
      body: { subject: 'S', serviceType: 'Tax', message: 'Hi' },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Client profile not found');
  });

  it('requires clientId for CA-Admin', async () => {
    const { controller } = buildController();
    const { next } = await run(controller.createThread, {
      body: { subject: 'S', serviceType: 'Tax', message: 'Hi' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Client ID is required');
  });

  it('validates attachments', async () => {
    const clientId = new mongoose.Types.ObjectId();
    const firmId = new mongoose.Types.ObjectId();
    const { controller, mocks } = buildController({
      Client: { findOne: jest.fn().mockResolvedValue({ _id: clientId, firmId }) },
      Thread: {
        generateThreadNumber: jest.fn().mockResolvedValue('THR-2026-00001'),
        create: jest.fn().mockResolvedValue({
          _id: 't1',
          populate: jest.fn().mockResolvedValue()
        })
      }
    });
    mocks.Document.find.mockResolvedValue([]);

    const { next } = await run(controller.createThread, {
      body: { subject: 'S', serviceType: 'Tax', message: 'Hi', clientId, attachments: ['d1'] },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('attachments not found');
  });

  it('creates thread and ignores notification failures', async () => {
    const clientId = new mongoose.Types.ObjectId();
    const firmId = new mongoose.Types.ObjectId();
    const docId = new mongoose.Types.ObjectId();
    const thread = { _id: 't1', populate: jest.fn().mockResolvedValue() };
    const { controller, mocks } = buildController({
      Client: {
        findOne: jest.fn().mockResolvedValue({ _id: clientId, firmId }),
        findById: jest.fn().mockResolvedValue({ _id: clientId })
      },
      Thread: {
        generateThreadNumber: jest.fn().mockResolvedValue('THR-2026-00001'),
        create: jest.fn().mockResolvedValue(thread)
      },
      Document: {
        find: jest.fn().mockResolvedValue([{ _id: docId, firmId, clientId }])
      },
      User: { findById: jest.fn().mockResolvedValue({ _id: 'u1' }) }
    });
    mocks.Message.create.mockResolvedValue({ _id: 'm1' });

    const { res, next } = await run(controller.createThread, {
      body: {
        subject: 'S',
        serviceType: 'Tax',
        message: 'Hi',
        clientId,
        attachments: [docId]
      },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns threads with filters and unread flag', async () => {
    const { controller, mocks } = buildController();
    mocks.Thread.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([{ unreadCountCA: 2, toObject: jest.fn(() => ({ unreadCountCA: 2 })) }])
    });
    mocks.Thread.countDocuments.mockResolvedValue(1);

    const { res } = await run(controller.getThreads, {
      query: { status: 'active', sortOrder: 'asc', limit: 10, page: 1 },
      user: { role: 'CA-Admin', firmId: 'f1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('gets thread and validates pagination', async () => {
    const thread = {
      _id: 't1',
      firmId: 'f1',
      clientId: { _id: 'c1' },
      isDeleted: false,
      markAsRead: jest.fn()
    };
    const query = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(thread)
    };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockReturnValue(query) },
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) }
    });
    mocks.Message.getThreadMessages.mockResolvedValue({ messages: [], pagination: { total: 0 } });

    const { next } = await run(controller.getThread, {
      params: { id: 't1' },
      query: { messagePage: 0, messageLimit: 200 },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid pagination parameters');
  });

  it('updates thread and handles invalid status/deadline', async () => {
    const thread = {
      _id: 't1',
      firmId: 'f1',
      isDeleted: false,
      status: 'open',
      save: jest.fn(),
      populate: jest.fn().mockResolvedValue()
    };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    let result = await run(controller.updateThread, {
      params: { id: 't1' },
      body: { status: 'invalid' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(result.next.mock.calls[0][0].message).toContain('Invalid thread status');

    result = await run(controller.updateThread, {
      params: { id: 't1' },
      body: { deadline: new Date(Date.now() - 1000).toISOString() },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(result.next.mock.calls[0][0].message).toContain('Deadline must be in the future');
    expect(mocks.Message.createSystemMessage).not.toHaveBeenCalled();
  });

  it('resolves, closes, reopens, and deletes thread', async () => {
    const thread = {
      _id: 't1',
      firmId: 'f1',
      isDeleted: false,
      resolve: jest.fn(),
      close: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn()
    };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) },
      Client: { findById: jest.fn().mockResolvedValue({ _id: 'c1' }) },
      User: { findById: jest.fn().mockResolvedValue({ _id: 'u1' }) }
    });

    await run(controller.resolveThread, {
      params: { id: 't1' },
      body: { resolutionNotes: 'Done' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    await run(controller.closeThread, {
      params: { id: 't1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    await run(controller.reopenThread, {
      params: { id: 't1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    const { res } = await run(controller.deleteThread, {
      params: { id: 't1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns thread stats and rejects invalid role', async () => {
    const { controller, mocks } = buildController({
      Thread: {
        aggregate: jest.fn().mockResolvedValue([{ _id: 'open', count: 1 }]),
        countDocuments: jest.fn().mockResolvedValue(1)
      }
    });
    const { next } = await run(controller.getThreadStats, {
      user: { role: 'Unknown', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid role');

    const { res } = await run(controller.getThreadStats, {
      user: { role: 'CA-Admin', firmId: 'f1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

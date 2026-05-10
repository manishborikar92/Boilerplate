const mongoose = require('mongoose');

const buildController = (overrides = {}) => {
  jest.resetModules();
  const messageModel = {
    create: jest.fn(),
    findById: jest.fn(),
    getThreadMessages: jest.fn(),
    markAsRead: jest.fn(),
    getPendingPaymentMessages: jest.fn(),
    find: jest.fn()
  };
  const threadModel = {
    findById: jest.fn(),
    find: jest.fn()
  };
  const clientModel = { findOne: jest.fn(), findById: jest.fn() };
  const documentModel = { find: jest.fn() };
  const chatMessagePaymentService = {
    createChatMessagePaymentRequirement: jest.fn()
  };
  const messageVisibility = {
    stripPaymentLockedUrlsForClient: jest.fn()
  };

  Object.assign(messageModel, overrides.Message || {});
  Object.assign(threadModel, overrides.Thread || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(chatMessagePaymentService, overrides.chatMessagePaymentService || {});
  Object.assign(messageVisibility, overrides.messageVisibility || {});

  jest.doMock('../../src/models/Message', () => messageModel);
  jest.doMock('../../src/models/Thread', () => threadModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/services/chatMessagePaymentService', () => chatMessagePaymentService);
  jest.doMock('../../src/utils/messageVisibility', () => messageVisibility);
  jest.doMock('../../src/services/notificationService', () => ({
    notifyThreadMessageReceived: jest.fn().mockRejectedValue(new Error('fail'))
  }));
  jest.doMock('../../src/models/User', () => ({ findById: jest.fn().mockResolvedValue({ _id: 'u1' }) }));

  const controller = require('../../src/controllers/messageController');
  return { controller, mocks: { Message: messageModel, Thread: threadModel, Client: clientModel, Document: documentModel, chatMessagePaymentService, messageVisibility } };
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

describe('messageController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects adding message to closed thread', async () => {
    const thread = { _id: 't1', status: 'closed', firmId: 'f1', clientId: 'c1', isDeleted: false };
    const { controller } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    const { next } = await run(controller.createMessage, {
      params: { threadId: 't1' },
      body: { content: 'Hi' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('closed thread');
  });

  it('validates missing content or attachments', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: 'c1', isDeleted: false };
    const { controller } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    const { next } = await run(controller.createMessage, {
      params: { threadId: 't1' },
      body: {},
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('content or attachments');
  });

  it('validates attachment ownership and payment requirements', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: new mongoose.Types.ObjectId(), isDeleted: false };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    mocks.Document.find.mockResolvedValue([]);

    const { next } = await run(controller.createMessage, {
      params: { threadId: 't1' },
      body: { content: 'Hi', attachments: ['d1'] },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('attachments not found');

    mocks.Document.find.mockResolvedValue([{ _id: 'd1', clientId: thread.clientId, firmId: 'f1' }]);
    const { next: nextPayment } = await run(controller.createMessage, {
      params: { threadId: 't1' },
      body: { content: 'Hi', attachments: ['d1'], paymentRequired: true },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(nextPayment.mock.calls[0][0].message).toContain('Payment amount is required');
  });

  it('creates payment request message and ignores notification failures', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: new mongoose.Types.ObjectId(), isDeleted: false };
    const paymentRecord = {
      _id: 'p1',
      amount: 1000,
      notes: { set: jest.fn() },
      save: jest.fn()
    };
    const message = { _id: 'm1', populate: jest.fn().mockResolvedValue() };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    mocks.Document.find.mockResolvedValue([{ _id: 'd1', clientId: thread.clientId, firmId: 'f1' }]);
    mocks.chatMessagePaymentService.createChatMessagePaymentRequirement.mockResolvedValue(paymentRecord);
    mocks.Message.create.mockResolvedValue(message);

    const { res, next } = await run(controller.createMessage, {
      params: { threadId: 't1' },
      body: { content: 'Hi', attachments: ['d1'], paymentRequired: true, paymentAmount: 1000 },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(paymentRecord.save).toHaveBeenCalled();
  });

  it('returns messages and marks read for client', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: 'c1', isDeleted: false, markAsRead: jest.fn() };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) },
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) }
    });
    mocks.Message.getThreadMessages.mockResolvedValue({ messages: [{ _id: 'm1' }], pagination: { total: 1 } });

    const { res } = await run(controller.getMessages, {
      params: { threadId: 't1' },
      query: { page: 1, limit: 10 },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(mocks.messageVisibility.stripPaymentLockedUrlsForClient).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('prevents updates for non-owners or read messages', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: 'c1', isDeleted: false };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    mocks.Message.findById.mockResolvedValue({ sender: 'u2' });
    const { next } = await run(controller.updateMessage, {
      params: { threadId: 't1', messageId: 'm1' },
      body: { content: 'Updated' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('edit your own messages');

    mocks.Message.findById.mockResolvedValue({
      sender: 'u1',
      isDeleted: false,
      canModify: jest.fn().mockReturnValue(false)
    });
    const { next: nextCannot } = await run(controller.updateMessage, {
      params: { threadId: 't1', messageId: 'm1' },
      body: { content: 'Updated' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(nextCannot.mock.calls[0][0].message).toContain('Cannot edit message');
  });

  it('marks message as read and handles payment actions', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: 'c1', isDeleted: false };
    const message = { senderRole: 'Client', isDeleted: false, save: jest.fn() };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) }
    });
    mocks.Message.findById.mockResolvedValue(message);

    const { res } = await run(controller.markMessageAsRead, {
      params: { threadId: 't1', messageId: 'm1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);

    const payable = {
      isDeleted: false,
      paymentRequired: true,
      paymentStatus: 'pending',
      markPaymentComplete: jest.fn()
    };
    mocks.Message.findById.mockResolvedValue(payable);
    const { res: paymentRes } = await run(controller.markPaymentComplete, {
      params: { threadId: 't1', messageId: 'm1' },
      body: { paymentId: 'p1' }
    });
    expect(paymentRes.status).toHaveBeenCalledWith(200);
  });

  it('handles waive payment and pending payment lists', async () => {
    const thread = { _id: 't1', status: 'open', firmId: 'f1', clientId: 'c1', isDeleted: false };
    const { controller, mocks } = buildController({
      Thread: { findById: jest.fn().mockResolvedValue(thread) },
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) }
    });
    mocks.Message.findById.mockResolvedValue({
      isDeleted: false,
      paymentRequired: true,
      paymentStatus: 'pending',
      waivePayment: jest.fn()
    });
    const { res } = await run(controller.waivePayment, {
      params: { threadId: 't1', messageId: 'm1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);

    mocks.Message.getPendingPaymentMessages.mockResolvedValue([{ _id: 'm1' }]);
    const { res: pendingRes } = await run(controller.getPendingPaymentMessages, {
      params: { threadId: 't1' },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(pendingRes.status).toHaveBeenCalledWith(200);
  });

  it('returns pending payments for client', async () => {
    const { controller, mocks } = buildController({
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) },
      Thread: { find: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 't1' }]) }) }
    });
    mocks.Message.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([{ paymentAmount: 2500 }])
    });

    const { res } = await run(controller.getMyPendingPayments, {
      user: { role: 'Client', _id: 'u1' }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalPendingAmount: 2500 })
    }));
  });
});

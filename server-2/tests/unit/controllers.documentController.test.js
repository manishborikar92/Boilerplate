const buildController = (overrides = {}) => {
  jest.resetModules();
  const documentModel = {
    getFolderStructure: jest.fn(),
    getWorkspaceStorageRoot: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn()
  };
  const clientModel = {
    findById: jest.fn()
  };
  const folderModel = {
    findOne: jest.fn()
  };
  const messageModel = {
    find: jest.fn()
  };
  const threadModel = {
    find: jest.fn()
  };
  const cloudinaryService = {
    uploadFile: jest.fn()
  };
  const documentLockService = {
    isDocumentLockedByPendingChatPayment: jest.fn()
  };
  const subscriptionService = {
    assertMonthlyLimit: jest.fn()
  };
  const workspaceManager = {
    getWorkspaceContents: jest.fn(),
    moveWorkspaceDocument: jest.fn(),
    refreshFolderDocumentCounts: jest.fn()
  };

  Object.assign(documentModel, overrides.Document || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(folderModel, overrides.Folder || {});
  Object.assign(messageModel, overrides.Message || {});
  Object.assign(threadModel, overrides.Thread || {});
  Object.assign(cloudinaryService, overrides.CloudinaryService || {});
  Object.assign(documentLockService, overrides.documentLockService || {});
  Object.assign(subscriptionService, overrides.subscriptionService || {});
  Object.assign(workspaceManager, overrides.workspaceManager || {});

  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Folder', () => folderModel);
  jest.doMock('../../src/models/Message', () => messageModel);
  jest.doMock('../../src/models/Thread', () => threadModel);
  jest.doMock('../../src/services/cloudinaryService', () => cloudinaryService);
  jest.doMock('../../src/services/documentLockService', () => documentLockService);
  jest.doMock('../../src/services/subscriptionService', () => subscriptionService);
  jest.doMock('../../src/services/documentWorkspaceManager', () => workspaceManager);
  jest.doMock('../../src/middleware/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }));

  const controller = require('../../src/controllers/documentController');
  return { controller, mocks: { Document: documentModel, Client: clientModel, Folder: folderModel, Message: messageModel, Thread: threadModel, CloudinaryService: cloudinaryService, subscriptionService, workspaceManager } };
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

describe('documentController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates upload inputs and authorization', async () => {
    const { controller } = buildController();
    let result = await run(controller.uploadDocument, { body: {}, files: [], user: { role: 'CA-Admin' } });
    expect(result.next.mock.calls[0][0].message).toContain('No files uploaded');

    result = await run(controller.uploadDocument, { body: { category: 'tax' }, files: [{}], user: { role: 'CA-Admin' } });
    expect(result.next.mock.calls[0][0].message).toContain('Client ID is required');
  });

  it('uploads documents and handles failures', async () => {
    const client = { _id: 'c1', firmId: 'f1', companyName: 'ACME' };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) }
    });
    mocks.Document.getWorkspaceStorageRoot.mockReturnValue('workspace-folder');
    mocks.CloudinaryService.uploadFile.mockRejectedValue(new Error('fail'));

    let result = await run(controller.uploadDocument, {
      body: { clientId: 'c1', category: 'tax' },
      files: [{ originalname: 'a.pdf', size: 1, mimetype: 'pdf', buffer: Buffer.from('x') }],
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(result.next.mock.calls[0][0].message).toContain('Failed to upload any documents');

    mocks.CloudinaryService.uploadFile.mockResolvedValue({ publicId: 'pid', url: 'url' });
    mocks.Document.create.mockResolvedValue({ _id: 'd1' });
    const { res, next } = await run(controller.uploadDocument, {
      body: { clientId: 'c1', category: 'tax' },
      files: [{ originalname: 'a.pdf', size: 1, mimetype: 'pdf', buffer: Buffer.from('x') }],
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns workspace contents for CA-Admin', async () => {
    const client = { _id: 'c1', firmId: 'f1', companyName: 'ACME' };
    const workspace = {
      currentFolder: null,
      breadcrumbs: [],
      folders: [],
      documents: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      summary: { folderCount: 0, documentCount: 0, totalFileSize: 0 }
    };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) },
      workspaceManager: { getWorkspaceContents: jest.fn().mockResolvedValue(workspace) }
    });

    const { res, next } = await run(controller.getWorkspace, {
      params: { clientId: 'c1' },
      query: { page: 1, limit: 20 },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });

    expect(next).not.toHaveBeenCalled();
    expect(mocks.workspaceManager.getWorkspaceContents).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'c1',
      page: 1,
      limit: 20
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ companyName: 'ACME' })
    }));
  });

  it('gets client documents with authorization checks', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u2' };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) }
    });
    const { next } = await run(controller.getClientDocuments, {
      params: { clientId: 'c1' },
      query: {},
      user: { role: 'Client', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('access to these documents');

    mocks.Document.countDocuments.mockResolvedValue(0);
    mocks.Document.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([])
    });
    const { res } = await run(controller.getClientDocuments, {
      params: { clientId: 'c1' },
      query: { page: 1, limit: 10 },
      user: { role: 'CA-Admin', firmId: 'f1', _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ pagination: expect.objectContaining({ total: 0 }) })
    }));
  });

  it('returns empty shared conversation documents when no threads', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u1' };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) }
    });
    mocks.Thread.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

    const { res } = await run(controller.getSharedConversationDocuments, {
      params: { clientId: 'c1' },
      query: { page: 1, limit: 20 },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ documents: [] })
    }));
  });

  it('returns shared conversation documents with payment flags', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u1' };
    const doc = { _id: 'd1', fileName: 'a', toObject: jest.fn(() => ({ _id: 'd1', fileName: 'a' })) };
    const message = {
      _id: 'm1',
      threadId: 't1',
      createdAt: new Date(),
      paymentRequired: true,
      paymentStatus: 'pending',
      paymentAmount: 100,
      paymentDescription: 'Pay',
      attachments: [doc]
    };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) }
    });
    mocks.Thread.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 't1' }]) });
    mocks.Message.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([message])
    });

    const { res } = await run(controller.getSharedConversationDocuments, {
      params: { clientId: 'c1' },
      query: { page: 1, limit: 10 },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ documents: expect.any(Array) })
    }));
  });

  it('returns category documents and marks locked items', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u1' };
    const doc = { _id: 'd1', toObject: jest.fn(() => ({ _id: 'd1' })) };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) }
    });
    mocks.Document.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([doc])
    });
    mocks.Message.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ attachments: ['d1'] }])
    });

    const { res } = await run(controller.getDocumentsByCategory, {
      params: { clientId: 'c1', category: 'tax' },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ documents: expect.any(Array) })
    }));
  });
});

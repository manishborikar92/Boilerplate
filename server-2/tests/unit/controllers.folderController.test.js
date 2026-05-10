const mongoose = require('mongoose');

const buildController = (overrides = {}) => {
  jest.resetModules();
  const folderModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  };
  const clientModel = { findById: jest.fn() };
  const documentModel = {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn()
  };
  const workspaceManager = {
    getWorkspaceTree: jest.fn(),
    createWorkspaceFolder: jest.fn(),
    updateWorkspaceFolder: jest.fn(),
    deleteWorkspaceFolder: jest.fn(),
    hydrateFoldersWithLiveCounts: jest.fn(async (folders) => folders),
  };

  Object.assign(folderModel, overrides.Folder || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(workspaceManager, overrides.workspaceManager || {});

  jest.doMock('../../src/models/Folder', () => folderModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/services/documentWorkspaceManager', () => workspaceManager);
  jest.doMock('../../src/middleware/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }));

  const controller = require('../../src/controllers/folderController');
  return { controller, mocks: { Folder: folderModel, Client: clientModel, Document: documentModel, workspaceManager } };
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

describe('folderController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when client is missing', async () => {
    const { controller } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(null) }
    });
    const { next } = await run(controller.getFolderTree, {
      params: { clientId: 'c1' },
      user: { role: 'CA-Admin', firmId: 'f1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Client not found');
  });

  it('returns a nested workspace tree', async () => {
    const client = { _id: 'c1', firmId: new mongoose.Types.ObjectId() };
    const tree = [{ _id: 'f1', name: 'Root', children: [{ _id: 'f2', name: 'Child', children: [] }] }];
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) },
      workspaceManager: { getWorkspaceTree: jest.fn().mockResolvedValue(tree) }
    });

    const { res, next } = await run(controller.getFolderTree, {
      params: { clientId: client._id.toString() },
      user: { role: 'CA-Admin', firmId: client.firmId }
    });

    expect(next).not.toHaveBeenCalled();
    expect(mocks.workspaceManager.getWorkspaceTree).toHaveBeenCalledWith({ clientId: client._id.toString() });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ folders: tree, count: 1 })
    }));
  });

  it('creates folder and blocks duplicates', async () => {
    const firmId = new mongoose.Types.ObjectId();
    const client = { _id: 'c1', firmId };
    const { controller, mocks } = buildController({
      Client: { findById: jest.fn().mockResolvedValue(client) },
      workspaceManager: {
        createWorkspaceFolder: jest.fn().mockRejectedValue(new Error('A folder with this name already exists in this location'))
      }
    });
    const { next } = await run(controller.createFolder, {
      params: { clientId: 'c1' },
      body: { name: 'Docs' },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('already exists');

    mocks.workspaceManager.createWorkspaceFolder.mockResolvedValue({ _id: 'f1' });
    const { res } = await run(controller.createFolder, {
      params: { clientId: 'c1' },
      body: { name: 'Docs', parentId: 'parent1' },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(mocks.workspaceManager.createWorkspaceFolder).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'c1',
      firmId,
      createdBy: 'u1',
      name: 'Docs',
      parentId: 'parent1'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates and deletes folders with cascade handling', async () => {
    const firmId = new mongoose.Types.ObjectId();
    const folder = {
      _id: 'f1',
      firmId,
      clientId: 'c1',
      name: 'Docs',
      save: jest.fn(),
      softDelete: jest.fn(),
      isDeleted: false
    };
    const { controller, mocks } = buildController({
      Folder: { findById: jest.fn().mockResolvedValue(folder) },
      workspaceManager: {
        updateWorkspaceFolder: jest.fn().mockResolvedValue({ _id: 'f1', name: 'New Docs' }),
        deleteWorkspaceFolder: jest.fn().mockResolvedValue({ deletedDocuments: 2, deletedFolders: 1 })
      }
    });

    const { res } = await run(controller.updateFolder, {
      params: { id: 'f1' },
      body: { name: 'New Docs', color: '#000', parentId: null },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Folder updated successfully'
    }));

    const { res: deleteRes } = await run(controller.deleteFolder, {
      params: { id: 'f1' },
      query: { cascade: 'true' },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(deleteRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ deletedDocuments: 2, deletedFolders: 1 })
    }));
  });

  it('prevents delete without cascade when documents exist', async () => {
    const firmId = new mongoose.Types.ObjectId();
    const folder = {
      _id: 'f1',
      firmId,
      clientId: 'c1',
      name: 'Docs',
      softDelete: jest.fn(),
      isDeleted: false
    };
    const { controller, mocks } = buildController({
      Folder: { findById: jest.fn().mockResolvedValue(folder) },
      workspaceManager: {
        deleteWorkspaceFolder: jest.fn().mockRejectedValue(new Error('Cannot delete folder with 1 child folder(s) and 1 document(s). Use cascade=true query parameter to delete the entire subtree.'))
      }
    });

    const { next } = await run(controller.deleteFolder, {
      params: { id: 'f1' },
      query: { cascade: 'false' },
      user: { role: 'CA-Admin', firmId, _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Cannot delete folder');
  });
});

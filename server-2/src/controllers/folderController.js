/**
 * Folder Controller
 * Handles folder management for organizing documents
 */
const Folder = require('../models/Folder');
const Client = require('../models/Client');
const {
  getWorkspaceTree,
  createWorkspaceFolder,
  updateWorkspaceFolder,
  deleteWorkspaceFolder,
  hydrateFoldersWithLiveCounts,
} = require('../services/documentWorkspaceManager');
const {
  asyncHandler,
  NotFoundError,
  AuthorizationError,
} = require('../utils/errorHandler');
const { logger } = require('../middleware/logger');

async function getAuthorizedClient(clientId, user) {
  const client = await Client.findById(clientId);
  if (!client) {
    throw new NotFoundError('Client not found');
  }

  if (user.role === 'Client') {
    if (!client.userAccountId || client.userAccountId.toString() !== user._id.toString()) {
      throw new AuthorizationError('You do not have access to these folders');
    }
  } else if (user.role === 'CA-Admin') {
    if (client.firmId.toString() !== user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to these folders');
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  return client;
}

async function getAuthorizedFolder(folderId, user) {
  const folder = await Folder.findById(folderId);
  if (!folder || folder.isDeleted) {
    throw new NotFoundError('Folder not found');
  }

  if (user.role === 'Client') {
    const client = await Client.findById(folder.clientId);
    if (!client?.userAccountId || client.userAccountId.toString() !== user._id.toString()) {
      throw new AuthorizationError('You do not have access to this folder');
    }
  } else if (user.role === 'CA-Admin') {
    if (folder.firmId.toString() !== user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this folder');
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  return folder;
}

/**
 * @desc    Get the nested folder tree for a client workspace
 * @route   GET /api/documents/client/:clientId/folders/tree
 * @access  Protected (CA-Admin only)
 */
exports.getFolderTree = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  await getAuthorizedClient(clientId, req.user);

  const tree = await getWorkspaceTree({ clientId });

  res.json({
    success: true,
    data: {
      folders: tree,
      count: tree.length,
    }
  });
});

/**
 * @desc    Create a new folder
 * @route   POST /api/documents/client/:clientId/folders
 * @access  Protected (CA-Admin only)
 */
exports.createFolder = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { name, parentId, category, description, color } = req.body;

  const client = await getAuthorizedClient(clientId, req.user);

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can create folders');
  }

  const folder = await createWorkspaceFolder({
    clientId,
    firmId: client.firmId,
    createdBy: req.user._id,
    name,
    parentId: parentId || null,
    category,
    description,
    color,
  });
  const [folderWithCounts] = await hydrateFoldersWithLiveCounts([folder]);

  logger.info('Folder created', {
    folderId: folder._id,
    clientId,
    parentId: folder.parentId,
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Folder created successfully',
    data: { folder: folderWithCounts }
  });
});

/**
 * @desc    Update folder
 * @route   PUT /api/documents/folders/:id
 * @access  Protected (CA-Admin only)
 */
exports.updateFolder = asyncHandler(async (req, res) => {
  const { name, parentId, category, description, color } = req.body;

  const folder = await getAuthorizedFolder(req.params.id, req.user);

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can update folders');
  }

  const updatedFolder = await updateWorkspaceFolder({
    folderId: folder._id,
    name,
    parentId,
    category,
    description,
    color,
  });
  const [folderWithCounts] = await hydrateFoldersWithLiveCounts([updatedFolder]);

  logger.info('Folder updated', {
    folderId: updatedFolder._id,
    updatedBy: req.user._id,
  });

  res.json({
    success: true,
    message: 'Folder updated successfully',
    data: { folder: folderWithCounts }
  });
});

/**
 * @desc    Delete folder (soft delete) with optional subtree cascade
 * @route   DELETE /api/documents/folders/:id
 * @access  Protected (CA-Admin only)
 */
exports.deleteFolder = asyncHandler(async (req, res) => {
  const { cascade } = req.query;
  const folder = await getAuthorizedFolder(req.params.id, req.user);

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can delete folders');
  }

  const result = await deleteWorkspaceFolder({
    folderId: folder._id,
    deletedBy: req.user._id,
    cascade: cascade === 'true',
  });

  logger.info('Folder deleted', {
    folderId: folder._id,
    deletedFolders: result.deletedFolders,
    deletedDocuments: result.deletedDocuments,
    deletedBy: req.user._id,
  });

  res.json({
    success: true,
    message: result.deletedDocuments > 0
      ? `Folder and ${result.deletedDocuments} document(s) deleted successfully`
      : result.deletedFolders > 1
        ? 'Folder subtree deleted successfully'
        : 'Folder deleted successfully',
    data: result
  });
});

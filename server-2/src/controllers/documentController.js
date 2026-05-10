/**
 * Document Controller
 * Handles all document upload, retrieval, and management operations
 */
const Document = require('../models/Document');
const Client = require('../models/Client');
const Folder = require('../models/Folder');
const Message = require('../models/Message');
const Thread = require('../models/Thread');
const CloudinaryService = require('../services/cloudinaryService');
const { isDocumentLockedByPendingChatPayment } = require('../services/documentLockService');
const { assertMonthlyLimit } = require('../services/subscriptionService');
const notificationService = require('../services/notificationService');
const {
  getWorkspaceContents,
  moveWorkspaceDocument,
  refreshFolderDocumentCounts,
} = require('../services/documentWorkspaceManager');
const {
  WORKSPACE_DOCUMENT_SOURCE,
  CONVERSATION_DOCUMENT_SOURCE,
  buildConversationStorageRoot,
} = require('../services/documentWorkspaceService');
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  InternalError
} = require('../utils/errorHandler');
const { logger } = require('../middleware/logger');
const path = require('path');
const https = require('https');
const http = require('http');

async function getAuthorizedClient(clientId, user, options = {}) {
  const { allowClient = true } = options;
  const client = await Client.findById(clientId);
  if (!client) {
    throw new NotFoundError('Client not found');
  }

  if (user.role === 'Client') {
    if (!allowClient) {
      throw new AuthorizationError('Only CA-Admin can access this workspace');
    }

    if (!client.userAccountId || client.userAccountId.toString() !== user._id.toString()) {
      throw new AuthorizationError('You do not have access to these documents');
    }
  } else if (user.role === 'CA-Admin') {
    if (client.firmId.toString() !== user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to these documents');
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  return client;
}

/**
 * @desc    Upload document(s) for a client
 * @route   POST /api/documents/upload
 * @access  Protected (CA-Admin only)
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  const { clientId, category, description, tags, financialYear, month, folderId } = req.body;
  const files = req.files;

  // Validation
  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  if (!clientId) {
    throw new ValidationError('Client ID is required');
  }

  // Verify client exists and belongs to user's firm
  const client = await getAuthorizedClient(clientId, req.user, { allowClient: false });

  // Authorization check - Only CA-Admin
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can upload documents');
  }

  let targetFolder = null;
  if (folderId) {
    targetFolder = await Folder.findOne({
      _id: folderId,
      clientId,
      firmId: client.firmId,
      isDeleted: false,
    });

    if (!targetFolder) {
      throw new ValidationError('Selected folder was not found for this client');
    }
  }

  const uploadFolder = Document.getWorkspaceStorageRoot(client.firmId, clientId);
  const resolvedCategory = category || 'Miscellaneous';
  const parsedTags = Array.isArray(tags)
    ? tags
    : tags
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

  // Upload files to Cloudinary
  const uploadedDocuments = [];

  for (const file of files) {
    try {
      // Upload to Cloudinary
      const uploadResult = await CloudinaryService.uploadFile(file.buffer, {
        folder: uploadFolder,
        resourceType: 'auto',
        tags: parsedTags
      });

      // Create document record
      const document = await Document.create({
        fileName: file.originalname,
        originalName: file.originalname,
        displayName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileExtension: path.extname(file.originalname),
        cloudinaryPublicId: uploadResult.publicId,
        cloudinaryUrl: uploadResult.url,
        cloudinaryFolder: uploadFolder,
        category: resolvedCategory,
        clientId,
        firmId: client.firmId,
        uploadedBy: req.user._id,
        documentSource: WORKSPACE_DOCUMENT_SOURCE,
        folderId: folderId || null,
        description,
        tags: parsedTags,
        financialYear,
        month
      });

      uploadedDocuments.push(document);

      logger.info('Document uploaded successfully', {
        documentId: document._id,
        clientId,
        category: resolvedCategory,
        folderId: folderId || null,
        uploadedBy: req.user._id
      });
    } catch (error) {
      logger.error('Failed to upload document', {
        filename: file.originalname,
        error: error.message
      });
      // Continue with other files
    }
  }

  if (uploadedDocuments.length === 0) {
    throw new ValidationError('Failed to upload any documents');
  }

  if (folderId) {
    await refreshFolderDocumentCounts([folderId]);
  }

  // Note: Regular document uploads (non-conversation) don't trigger notifications
  // Only conversation uploads trigger bidirectional notifications

  res.status(201).json({
    success: true,
    message: `Successfully uploaded ${uploadedDocuments.length} document(s)`,
    data: {
      documents: uploadedDocuments,
      count: uploadedDocuments.length
    }
  });
});

/**
 * @desc    Get Drive-style workspace contents for a client
 * @route   GET /api/documents/client/:clientId/workspace
 * @access  Protected (CA-Admin only)
 */
exports.getWorkspace = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const {
    parentId = null,
    search = '',
    scope = 'current',
    page = 1,
    limit = 50,
    sortBy = 'name',
    sortOrder = 'asc'
  } = req.query;

  const client = await getAuthorizedClient(clientId, req.user, { allowClient: false });

  const workspace = await getWorkspaceContents({
    clientId,
    parentId: parentId || null,
    search,
    scope,
    page,
    limit,
    sortBy,
    sortOrder
  });

  res.json({
    success: true,
    data: {
      companyName: client.companyName,
      ...workspace,
    }
  });
});

/**
 * @desc    Get all documents for a client
 * @route   GET /api/documents/client/:clientId
 * @access  Protected
 */
exports.getClientDocuments = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { category, search, folderId, page = 1, limit = 50 } = req.query;

  await getAuthorizedClient(clientId, req.user);

  // Build query
  const query = {
    clientId,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  }

  if (category) {
    query.category = category;
  }

  if (folderId) {
    query.folderId = folderId;
  }

  if (search) {
    query.$or = [
      { displayName: { $regex: search, $options: 'i' } },
      { fileName: { $regex: search, $options: 'i' } },
      { originalName: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  const total = await Document.countDocuments(query);

  // Fetch documents
  const documents = await Document.find(query)
    .populate('uploadedBy', 'name email')
    .populate('folderId', 'name color category parentId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  let responseDocuments = documents;

  if (req.user.role === 'Client' && documents.length > 0) {
    const documentIds = documents.map((doc) => doc._id);
    const lockedMessages = await Message.find({
      attachments: { $in: documentIds },
      paymentRequired: true,
      paymentStatus: 'pending',
      isDeleted: false,
    }).select('attachments');

    const lockedDocumentIds = new Set();
    lockedMessages.forEach((message) => {
      (message.attachments || []).forEach((attachmentId) => {
        lockedDocumentIds.add(attachmentId.toString());
      });
    });

    responseDocuments = documents.map((doc) => {
      const docObject = doc.toObject({ virtuals: true });
      return {
        ...docObject,
        lockedByChatPayment: lockedDocumentIds.has(doc._id.toString()),
      };
    });
  }

  res.json({
    success: true,
    data: {
      documents: responseDocuments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

exports.getSharedConversationDocuments = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { page = 1, limit = 20, search } = req.query;

  // Validate pagination parameters
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const client = await Client.findById(clientId);
  if (!client) {
    throw new NotFoundError('Client not found');
  }

  if (req.user.role === 'Client') {
    if (!client.userAccountId || client.userAccountId.toString() !== req.user._id.toString()) {
      throw new AuthorizationError('You do not have access to these documents');
    }
  } else if (req.user.role === 'CA-Admin') {
    if (client.firmId.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to these documents');
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  const threads = await Thread.find({ clientId, isDeleted: false }).select('_id');
  const threadIds = threads.map((thread) => thread._id);

  if (threadIds.length === 0) {
    res.json({
      success: true,
      data: {
        documents: [],
        pagination: {
          total: 0,
          page: pageNumber,
          pages: 1,
          limit: limitNumber
        }
      }
    });
    return;
  }

  const messages = await Message.find({
    threadId: { $in: threadIds },
    senderRole: 'CA-Admin',
    isDeleted: false,
    attachments: { $exists: true, $ne: [] }
  })
    .populate('attachments', 'fileName originalName fileSize mimeType cloudinaryUrl category createdAt requiresPayment isPaid paymentAmount paymentDescription folderId')
    .sort({ createdAt: -1 });

  const sharedMap = new Map();
  const pendingMap = new Map();
  const paidMap = new Map();

  messages.forEach((message) => {
    const attachments = message.attachments || [];
    attachments.forEach((attachment) => {
      if (!attachment?._id) return;
      const documentId = attachment._id.toString();
      const sharedAt = message.createdAt || new Date();

      const existing = sharedMap.get(documentId);
      if (!existing || sharedAt > existing.sharedAt) {
        sharedMap.set(documentId, {
          document: attachment,
          sharedAt,
          threadId: message.threadId,
          messageId: message._id
        });
      }

      if (message.paymentRequired) {
        if (message.paymentStatus === 'pending') {
          pendingMap.set(documentId, {
            messageId: message._id,
            paymentAmount: message.paymentAmount || 0,
            paymentDescription: message.paymentDescription || ''
          });
        } else if (message.paymentStatus === 'paid') {
          paidMap.set(documentId, {
            messageId: message._id,
            paymentAmount: message.paymentAmount || 0,
            paymentDescription: message.paymentDescription || ''
          });
        }
      }
    });
  });

  let documents = Array.from(sharedMap.entries()).map(([documentId, info]) => {
    const docObject = info.document.toObject ? info.document.toObject({ virtuals: true }) : info.document;
    let messagePaymentStatus = 'not-required';
    let messagePaymentRequired = false;
    let messagePaymentAmount = 0;
    let messagePaymentDescription = '';
    let messageId = info.messageId;

    if (pendingMap.has(documentId)) {
      const pending = pendingMap.get(documentId);
      messagePaymentStatus = 'pending';
      messagePaymentRequired = true;
      messagePaymentAmount = pending.paymentAmount;
      messagePaymentDescription = pending.paymentDescription;
      messageId = pending.messageId;
    } else if (paidMap.has(documentId)) {
      const paid = paidMap.get(documentId);
      messagePaymentStatus = 'paid';
      messagePaymentRequired = true;
      messagePaymentAmount = paid.paymentAmount;
      messagePaymentDescription = paid.paymentDescription;
      messageId = paid.messageId;
    }

    return {
      ...docObject,
      sharedAt: info.sharedAt,
      sharedFromThreadId: info.threadId,
      sharedFromMessageId: messageId,
      messagePaymentRequired,
      messagePaymentStatus,
      messagePaymentAmount,
      messagePaymentDescription
    };
  });

  if (search) {
    const normalized = search.toLowerCase();
    documents = documents.filter((doc) => {
      const fileName = doc.fileName || '';
      const originalName = doc.originalName || '';
      const description = doc.description || '';
      return (
        fileName.toLowerCase().includes(normalized) ||
        originalName.toLowerCase().includes(normalized) ||
        description.toLowerCase().includes(normalized)
      );
    });
  }

  documents.sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt));

  // Use validated values from the top of the function
  const total = documents.length;
  const pages = Math.max(1, Math.ceil(total / limitNumber));
  const startIndex = (pageNumber - 1) * limitNumber;
  const pagedDocuments = documents.slice(startIndex, startIndex + limitNumber);

  res.json({
    success: true,
    data: {
      documents: pagedDocuments,
      pagination: {
        total,
        page: pageNumber,
        pages,
        limit: limitNumber
      }
    }
  });
});

/**
 * @desc    Get documents by category for a client
 * @route   GET /api/documents/client/:clientId/category/:category
 * @access  Protected
 */
exports.getDocumentsByCategory = asyncHandler(async (req, res) => {
  const { clientId, category } = req.params;

  await getAuthorizedClient(clientId, req.user);

  // Fetch documents
  const documentsQuery = {
    clientId,
    category,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  };

  const documents = await Document.find(documentsQuery)
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

  let responseDocuments = documents;

  if (req.user.role === 'Client' && documents.length > 0) {
    const documentIds = documents.map((doc) => doc._id);
    const lockedMessages = await Message.find({
      attachments: { $in: documentIds },
      paymentRequired: true,
      paymentStatus: 'pending',
      isDeleted: false,
    }).select('attachments');

    const lockedDocumentIds = new Set();
    lockedMessages.forEach((message) => {
      (message.attachments || []).forEach((attachmentId) => {
        lockedDocumentIds.add(attachmentId.toString());
      });
    });

    responseDocuments = documents.map((doc) => {
      const docObject = doc.toObject({ virtuals: true });
      return {
        ...docObject,
        lockedByChatPayment: lockedDocumentIds.has(doc._id.toString()),
      };
    });
  }

  res.json({
    success: true,
    data: {
      category,
      documents: responseDocuments,
      count: responseDocuments.length
    }
  });
});

/**
 * @desc    Get single document details
 * @route   GET /api/documents/:id
 * @access  Protected
 */
exports.getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate('clientId', 'companyName email')
    .populate('uploadedBy', 'name email')
    .populate('paymentId', 'status amount paidAt')
    .populate('firmId', 'firmName');

  if (!document || document.isDeleted) {
    throw new NotFoundError('Document not found');
  }

  // Authorization check
  let canDownload = true;

  if (req.user.role === 'Client') {
    const client = await Client.findById(document.clientId);
    if (!client.userAccountId || client.userAccountId.toString() !== req.user._id.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }

    // Check payment requirement for clients
    if (document.requiresPayment && !document.isPaid) {
      canDownload = false;
    } else {
      const lockedByChatPayment = await isDocumentLockedByPendingChatPayment(document._id);
      if (lockedByChatPayment) {
        canDownload = false;
      }
    }
  } else if (req.user.role === 'CA-Admin') {
    if (document.firmId._id.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }
    // CA-Admin always has download access
    canDownload = true;
  } else {
    throw new AuthorizationError('Invalid role');
  }

  res.json({
    success: true,
    data: {
      document,
      canDownload,
      accessStatus: document.accessStatus
    }
  });
});

/**
 * @desc    Update document metadata
 * @route   PUT /api/documents/:id
 * @access  Protected (CA-Admin only)
 */
exports.updateDocument = asyncHandler(async (req, res) => {
  const { displayName, description, tags, financialYear, month, category, folderId } = req.body;
  const hasFolderUpdate = Object.prototype.hasOwnProperty.call(req.body, 'folderId');

  const document = await Document.findById(req.params.id);

  if (!document || document.isDeleted) {
    throw new NotFoundError('Document not found');
  }

  // Authorization check - Only CA-Admin
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can update document metadata');
  }

  if (document.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this document');
  }

  // Update fields
  if (displayName !== undefined) {
    document.displayName = displayName?.trim() || document.originalName || document.fileName;
  }
  if (description !== undefined) document.description = description;
  if (tags !== undefined) {
    document.tags = Array.isArray(tags)
      ? tags
      : String(tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
  }
  if (financialYear !== undefined) document.financialYear = financialYear;
  if (month !== undefined) document.month = month;
  if (category !== undefined) document.category = category || 'Miscellaneous';

  await document.save();

  let updatedDocument = document;

  if (hasFolderUpdate) {
    if (document.documentSource !== WORKSPACE_DOCUMENT_SOURCE) {
      throw new ValidationError('Only workspace documents can be moved between folders');
    }

    updatedDocument = await moveWorkspaceDocument({
      documentId: document._id,
      targetFolderId: folderId || null,
    });
  }

  logger.info('Document updated', {
    documentId: updatedDocument._id,
    updatedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Document updated successfully',
    data: { document: updatedDocument }
  });
});

/**
 * @desc    Delete document (soft delete)
 * @route   DELETE /api/documents/:id
 * @access  Protected (CA-Admin only)
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document || document.isDeleted) {
    throw new NotFoundError('Document not found');
  }

  // Authorization check - Only CA-Admin
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can delete documents');
  }

  if (document.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this document');
  }

  // Soft delete
  document.isDeleted = true;
  document.deletedAt = new Date();
  document.deletedBy = req.user._id;
  await document.save();

  if (document.folderId && document.documentSource === WORKSPACE_DOCUMENT_SOURCE) {
    await refreshFolderDocumentCounts([document.folderId]);
  }

  logger.info('Document deleted', {
    documentId: document._id,
    deletedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

/**
 * @desc    Permanently delete document from Cloudinary and database
 * @route   DELETE /api/documents/:id/permanent
 * @access  Protected (CA-Admin only)
 */
exports.permanentDeleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  // Authorization check - Only CA-Admin
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can permanently delete documents');
  }

  if (document.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this document');
  }

  // Delete from Cloudinary
  try {
    await CloudinaryService.deleteFile(document.cloudinaryPublicId, 'auto');
  } catch (error) {
    logger.warn('Failed to delete file from Cloudinary', {
      publicId: document.cloudinaryPublicId,
      error: error.message
    });
    // Continue with database deletion even if Cloudinary deletion fails
  }

  // Delete from database
  await Document.findByIdAndDelete(req.params.id);

  if (document.folderId && document.documentSource === WORKSPACE_DOCUMENT_SOURCE) {
    await refreshFolderDocumentCounts([document.folderId]);
  }

  logger.info('Document permanently deleted', {
    documentId: document._id,
    deletedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Document permanently deleted'
  });
});

/**
 * @desc    Get document categories
 * @route   GET /api/documents/categories
 * @access  Protected
 */
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = Document.getCategories();

  res.json({
    success: true,
    data: { categories }
  });
});

/**
 * @desc    Search documents across all clients (for CA-Admin)
 * @route   GET /api/documents/search
 * @access  Protected (CA-Admin only)
 */
exports.searchDocuments = asyncHandler(async (req, res) => {
  const { query, category, clientId, page = 1, limit = 50 } = req.query;

  // Only CA-Admin can search across clients
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can search across all documents');
  }

  // Build search query
  const searchQuery = {
    firmId: req.user.firmId,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  };

  if (query) {
    searchQuery.$or = [
      { displayName: { $regex: query, $options: 'i' } },
      { fileName: { $regex: query, $options: 'i' } },
      { originalName: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }

  if (category) {
    searchQuery.category = category;
  }

  if (clientId) {
    searchQuery.clientId = clientId;
  }

  // Pagination
  const skip = (page - 1) * limit;
  const total = await Document.countDocuments(searchQuery);

  // Fetch documents
  const documents = await Document.find(searchQuery)
    .populate('clientId', 'companyName email companyType')
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      documents,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    }
  });
});

/**
 * @desc    Set payment requirement for document(s)
 * @route   PUT /api/documents/set-payment-requirement
 * @access  Protected (CA-Admin only)
 */
exports.setPaymentRequirement = asyncHandler(async (req, res) => {
  const { documentIds, requiresPayment, paymentAmount, paymentDescription } = req.body;

  // Validate input
  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    throw new ValidationError('Document IDs are required');
  }

  if (requiresPayment === undefined) {
    throw new ValidationError('requiresPayment flag is required');
  }

  if (requiresPayment && (!paymentAmount || paymentAmount <= 0)) {
    throw new ValidationError('Payment amount is required and must be greater than 0');
  }

  // Only CA-Admin can set payment requirements
  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can set payment requirements');
  }

  // Get documents and verify they belong to CA's firm
  const documents = await Document.find({
    _id: { $in: documentIds },
    firmId: req.user.firmId,
    isDeleted: false
  });

  if (documents.length !== documentIds.length) {
    throw new ValidationError('Some documents not found or do not belong to your firm');
  }

  // Update documents
  const updateData = {
    requiresPayment,
    paymentAmount: requiresPayment ? paymentAmount : 0,
    paymentDescription: requiresPayment ? paymentDescription : null
  };

  await Document.updateMany(
    { _id: { $in: documentIds } },
    { $set: updateData }
  );

  logger.info('Payment requirement updated for documents', {
    documentIds,
    requiresPayment,
    paymentAmount,
    updatedBy: req.user._id
  });

  res.json({
    success: true,
    message: `Payment requirement ${requiresPayment ? 'enabled' : 'disabled'} for ${documents.length} document(s)`,
    data: {
      updatedCount: documents.length,
      requiresPayment,
      paymentAmount: requiresPayment ? paymentAmount : 0
    }
  });
});

/**
 * @desc    Get document with access check
 * @route   GET /api/documents/:id/access
 * @access  Protected
 */
exports.getDocumentWithAccessCheck = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate('clientId', 'companyName email')
    .populate('uploadedBy', 'name email')
    .populate('paymentId', 'status amount paidAt')
    .populate('firmId', 'firmName');

  if (!document || document.isDeleted) {
    throw new NotFoundError('Document not found');
  }

  // Authorization check
  let hasAccess = false;
  let accessReason = '';

  if (req.user.role === 'CA-Admin') {
    // CA-Admin always has access to their firm's documents
    if (document.firmId._id.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }
    hasAccess = true;
    accessReason = 'CA-Admin access';
  } else if (req.user.role === 'Client') {
    // Client needs to verify ownership
    const client = await Client.findById(document.clientId);
    if (!client.userAccountId || client.userAccountId.toString() !== req.user._id.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }

    // Check payment requirement
    if (document.requiresPayment) {
      if (document.isPaid) {
        hasAccess = true;
        accessReason = 'Payment completed';
      } else {
        hasAccess = false;
        accessReason = 'Payment required';
      }
    } else {
      hasAccess = true;
      accessReason = 'Free document';
    }

    if (hasAccess) {
      const lockedByChatPayment = await isDocumentLockedByPendingChatPayment(document._id);
      if (lockedByChatPayment) {
        hasAccess = false;
        accessReason = 'Payment required';
      }
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  res.json({
    success: true,
    data: {
      document,
      hasAccess,
      reason: accessReason,
      requiresPayment: document.requiresPayment,
      isPaid: document.isPaid,
      paymentAmount: document.paymentAmount,
      paymentAmountInRupees: document.paymentAmountInRupees,
      access: {
        hasAccess,
        reason: accessReason,
        requiresPayment: document.requiresPayment,
        isPaid: document.isPaid,
        paymentAmount: document.paymentAmount,
        paymentAmountInRupees: document.paymentAmountInRupees
      }
    }
  });
});

const sanitizeDownloadFilename = (value) => {
  if (!value || typeof value !== 'string') return 'document';
  const stripped = value.replace(/[\r\n]/g, '').trim();
  const normalized = stripped.replace(/[/\\?%*:|"<>]/g, '_');
  return normalized || 'document';
};

const buildContentDisposition = (disposition, filename) => {
  const safe = sanitizeDownloadFilename(filename);
  const encoded = encodeURIComponent(safe);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
};

const proxyDownload = async (sourceUrl, res) => {
  const maxRedirects = 3;

  return await new Promise((resolve, reject) => {
    const requestOnce = (url, redirectCount) => {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        reject(new InternalError('Invalid file URL'));
        return;
      }

      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.get(parsed, (upstreamRes) => {
        const status = upstreamRes.statusCode || 0;

        if (status >= 300 && status < 400 && upstreamRes.headers.location) {
          if (redirectCount >= maxRedirects) {
            reject(new InternalError('Too many redirects while fetching file'));
            return;
          }
          const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
          upstreamRes.resume();
          requestOnce(nextUrl, redirectCount + 1);
          return;
        }

        if (status < 200 || status >= 300) {
          upstreamRes.resume();
          reject(new InternalError('Failed to fetch document from storage'));
          return;
        }

        if (upstreamRes.headers['content-type'] && !res.getHeader('content-type')) {
          res.setHeader('content-type', upstreamRes.headers['content-type']);
        }

        if (upstreamRes.headers['content-length'] && !res.getHeader('content-length')) {
          res.setHeader('content-length', upstreamRes.headers['content-length']);
        }

        upstreamRes.on('error', reject);
        res.on('close', resolve);
        upstreamRes.pipe(res);
        upstreamRes.on('end', resolve);
      });

      req.on('error', reject);
      req.end();
    };

    requestOnce(sourceUrl, 0);
  });
};

/**
 * @desc    Download document file (streamed via API to avoid CORS issues)
 * @route   GET /api/documents/:id/download
 * @access  Protected
 */
exports.downloadDocument = asyncHandler(async (req, res) => {
  const dispositionParam = String(req.query?.disposition || 'attachment').toLowerCase();
  const disposition = dispositionParam === 'inline' ? 'inline' : 'attachment';

  const document = await Document.findById(req.params.id);

  if (!document || document.isDeleted) {
    throw new NotFoundError('Document not found');
  }

  if (req.user.role === 'CA-Admin') {
    if (document.firmId.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }
  } else if (req.user.role === 'Client') {
    const client = await Client.findById(document.clientId);
    if (!client?.userAccountId || client.userAccountId.toString() !== req.user._id.toString()) {
      throw new AuthorizationError('You do not have access to this document');
    }
    if (document.requiresPayment && !document.isPaid) {
      throw new AuthorizationError('Payment required to access this document');
    }
    const lockedByChatPayment = await isDocumentLockedByPendingChatPayment(document._id);
    if (lockedByChatPayment) {
      throw new AuthorizationError('Payment required to access this document');
    }
  } else {
    throw new AuthorizationError('Invalid role');
  }

  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('cache-control', 'private, no-store, max-age=0');
  res.setHeader('content-type', document.mimeType || 'application/octet-stream');
  res.setHeader('content-disposition', buildContentDisposition(disposition, document.fileName || document.originalName));

  logger.info('Document download requested', {
    documentId: document._id,
    userId: req.user._id,
    role: req.user.role,
    disposition
  });

  // Create document accessed notification (non-blocking, only for Client access)
  if (req.user.role === 'Client') {
    try {
      const client = await Client.findById(document.clientId);
      if (client) {
        await notificationService.notifyDocumentAccessed(document, client, req.user);
      }
    } catch (notificationError) {
      logger.warn('Failed to create document accessed notification', {
        error: notificationError.message
      });
      // Continue even if notification fails
    }
  }

  try {
    await proxyDownload(document.cloudinaryUrl, res);
  } catch (error) {
    logger.error('Document download failed', {
      documentId: document._id,
      userId: req.user._id,
      role: req.user.role,
      error: error?.message || String(error)
    });
    if (!res.headersSent) {
      throw error;
    }
  }
});

exports.uploadChatDocuments = asyncHandler(async (req, res) => {
  const files = req.files;
  let { clientId } = req.body;

  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  let client;

  if (req.user.role === 'Client') {
    client = await Client.findOne({
      userAccountId: req.user._id,
      isDeleted: false
    });

    if (!client) {
      throw new NotFoundError('Client profile not found');
    }

    if (clientId && clientId.toString() !== client._id.toString()) {
      throw new AuthorizationError('You do not have access to upload for this client');
    }

    clientId = client._id;
  } else if (req.user.role === 'CA-Admin') {
    if (!clientId) {
      throw new ValidationError('Client ID is required');
    }

    client = await Client.findById(clientId);
    if (!client || client.isDeleted) {
      throw new NotFoundError('Client not found');
    }

    if (client.firmId.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to upload for this client');
    }

    await assertMonthlyLimit({
      firmId: req.user.firmId,
      modelType: 'Document',
      increment: files.length
    });
  } else {
    throw new AuthorizationError('Invalid role');
  }

  const uploadFolder = buildConversationStorageRoot({
    firmId: client.firmId,
    clientId,
  });

  const created = [];

  for (const file of files) {
    const uploadResult = await CloudinaryService.uploadFile(file.buffer, {
      folder: uploadFolder,
      resourceType: 'auto',
      tags: ['chat-upload']
    });

    const document = await Document.create({
      fileName: file.originalname,
      originalName: file.originalname,
      displayName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileExtension: path.extname(file.originalname),
      cloudinaryPublicId: uploadResult.publicId,
      cloudinaryUrl: uploadResult.url,
      cloudinaryFolder: uploadFolder,
      category: 'Miscellaneous',
      clientId,
      firmId: client.firmId,
      uploadedBy: req.user._id,
      documentSource: CONVERSATION_DOCUMENT_SOURCE,
      folderId: null,
      description: 'Chat upload',
      tags: ['chat']
    });

    created.push(document);
  }

  // Create conversation document upload notification (non-blocking)
  try {
    const User = require('../models/User');
    const uploadedBy = await User.findById(req.user._id);
    if (uploadedBy) {
      await notificationService.notifyDocumentsUploaded(created, client, uploadedBy, true);
    }
  } catch (notificationError) {
    logger.warn('Failed to create conversation document upload notification', {
      error: notificationError.message
    });
    // Continue even if notification fails
  }

  res.status(201).json({
    success: true,
    message: `Uploaded ${created.length} file(s)`,
    data: {
      documents: created,
      count: created.length
    }
  });
});

/**
 * @desc    Get locked documents for a client
 * @route   GET /api/documents/client/:clientId/locked
 * @access  Protected
 */
exports.getLockedDocuments = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  await getAuthorizedClient(clientId, req.user);

  const lockedQuery = {
    clientId,
    isDeleted: false,
    requiresPayment: true,
    isPaid: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  };

  const documents = await Document.find(lockedQuery)
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

  const threadIds = await Thread.find({ clientId, isDeleted: false }).distinct('_id');
  const messagePaymentMap = new Map();
  const messageDocumentIds = new Set();

  if (threadIds.length > 0) {
    const pendingMessages = await Message.find({
      threadId: { $in: threadIds },
      senderRole: 'CA-Admin',
      isDeleted: false,
      paymentRequired: true,
      paymentStatus: 'pending',
      attachments: { $exists: true, $ne: [] }
    }).select('attachments paymentAmount paymentDescription createdAt');

    pendingMessages.forEach((message) => {
      const attachmentIds = message.attachments || [];
      if (!messagePaymentMap.has(message._id.toString())) {
        messagePaymentMap.set(message._id.toString(), {
          paymentAmount: message.paymentAmount || 0,
          paymentDescription: message.paymentDescription || '',
          createdAt: message.createdAt
        });
      }
      attachmentIds.forEach((attachmentId) => {
        if (!attachmentId) return;
        const docId = attachmentId.toString();
        messageDocumentIds.add(docId);
      });
    });
  }

  const lockedDocumentMap = new Map();
  documents.forEach((doc) => lockedDocumentMap.set(doc._id.toString(), doc));

  const messageDocIds = Array.from(messageDocumentIds).filter((docId) => !lockedDocumentMap.has(docId));
  if (messageDocIds.length > 0) {
    const messageDocs = await Document.find({ _id: { $in: messageDocIds }, isDeleted: false })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    messageDocs.forEach((doc) => lockedDocumentMap.set(doc._id.toString(), doc));
  }

  const lockedDocuments = Array.from(lockedDocumentMap.values());
  const totalMessageAmount = Array.from(messagePaymentMap.values()).reduce(
    (sum, paymentInfo) => sum + (paymentInfo.paymentAmount || 0),
    0
  );

  const totalDocumentAmount = lockedDocuments.reduce((sum, doc) => {
    if (messageDocumentIds.has(doc._id.toString())) {
      return sum;
    }
    return sum + (doc.paymentAmount || 0);
  }, 0);

  const totalPaymentRequired = totalMessageAmount + totalDocumentAmount;

  res.json({
    success: true,
    data: {
      documents: lockedDocuments,
      count: lockedDocuments.length,
      totalPaymentRequired,
      totalPaymentRequiredInRupees: totalPaymentRequired / 100
    }
  });
});

/**
 * @desc    Get document statistics for the firm
 * @route   GET /api/documents/stats
 * @access  Protected (CA-Admin only)
 */
exports.getDocumentStats = asyncHandler(async (req, res) => {
  const firmId = req.user.firmId;

  // Total documents count
  const totalDocuments = await Document.countDocuments({
    firmId,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  });

  // Documents by category
  const byCategory = await Document.aggregate([
    {
      $match: {
        firmId,
        isDeleted: false,
        documentSource: WORKSPACE_DOCUMENT_SOURCE,
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  // Documents requiring payment
  const lockedDocuments = await Document.countDocuments({
    firmId,
    isDeleted: false,
    requiresPayment: true,
    isPaid: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  });

  // Paid documents
  const paidDocuments = await Document.countDocuments({
    firmId,
    isDeleted: false,
    requiresPayment: true,
    isPaid: true,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  });

  res.json({
    success: true,
    data: {
      totalDocuments,
      lockedDocuments,
      paidDocuments,
      byCategory
    }
  });
});

/**
 * @desc    Get paid documents for a client
 * @route   GET /api/documents/client/:clientId/paid
 * @access  Protected
 */
exports.getPaidDocuments = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  await getAuthorizedClient(clientId, req.user);

  // Fetch paid documents
  const paidQuery = {
    clientId,
    isDeleted: false,
    requiresPayment: true,
    isPaid: true,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  };

  const documents = await Document.find(paidQuery)
    .populate('uploadedBy', 'name email')
    .populate('paymentId', 'amount paidAt status')
    .sort({ paidAt: -1 });

  res.json({
    success: true,
    data: {
      documents,
      count: documents.length
    }
  });
});

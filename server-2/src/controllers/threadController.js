const Thread = require('../models/Thread');
const Message = require('../models/Message');
const Client = require('../models/Client');
const Document = require('../models/Document');
const notificationService = require('../services/notificationService');
const socketManager = require('../services/socketManager');
const { stripPaymentLockedUrlsForClient } = require('../utils/messageVisibility');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  AuthorizationError 
} = require('../utils/errorHandler');

function buildThreadListPayload(thread) {
  return {
    _id: thread._id.toString(),
    subject: thread.subject,
    status: thread.status,
    priority: thread.priority,
    lastMessage: thread.lastMessage
      ? {
          content: thread.lastMessage.content || '',
          senderRole: thread.lastMessage.senderRole,
          hasAttachments: Boolean(thread.lastMessage.hasAttachments),
          createdAt: thread.lastMessage.createdAt
        }
      : undefined
  };
}

async function resolveClientUserAccountId(thread) {
  const populatedClientUserId = thread?.clientId?.userAccountId;
  if (populatedClientUserId) {
    return populatedClientUserId.toString();
  }

  const clientId = thread?.clientId?._id || thread?.clientId;
  if (!clientId) {
    return null;
  }

  const client = await Client.findById(clientId)
    .select('userAccountId')
    .lean();

  return client?.userAccountId ? client.userAccountId.toString() : null;
}

async function emitThreadListUpdate(thread) {
  const clientUserId = await resolveClientUserAccountId(thread);

  socketManager.emitThreadListUpdate(
    thread.firmId.toString(),
    buildThreadListPayload(thread),
    { clientUserId }
  );
}

/**
 * @desc    Create a new thread
 * @route   POST /api/threads
 * @access  Private (CA-Admin and Client)
 */
exports.createThread = asyncHandler(async (req, res) => {
  const { subject, serviceType, customServiceName, clientId, message, 
          priority, deadline, attachments, inlineFiles } = req.body;

  // Validate required fields
  if (!subject || !serviceType || !message) {
    throw new ValidationError('Subject, service type, and initial message are required');
  }

  let targetClientId = clientId;
  let firmId = req.user.firmId;

  // If user is Client, get their client profile
  if (req.user.role === 'Client') {
    const client = await Client.findOne({ 
      userAccountId: req.user._id, 
      isDeleted: false 
    });
    
    if (!client) {
      throw new NotFoundError('Client profile not found');
    }
    
    targetClientId = client._id;
    firmId = client.firmId;
  } else {
    // CA-Admin must specify client
    if (!clientId) {
      throw new ValidationError('Client ID is required');
    }

    // Verify client belongs to firm
    const client = await Client.findOne({
      _id: clientId,
      firmId: req.user.firmId,
      isDeleted: false
    });

    if (!client) {
      throw new ValidationError('Client not found or does not belong to your firm');
    }
  }

  // Generate thread number
  const threadNumber = await Thread.generateThreadNumber(firmId);

  // Create thread
  const thread = await Thread.create({
    threadNumber,
    subject,
    serviceType,
    customServiceName: serviceType === 'Other' ? customServiceName : undefined,
    clientId: targetClientId,
    firmId,
    initiatedBy: req.user.role,
    initiatedByUser: req.user._id,
    status: 'open',
    priority: priority || 'normal',
    deadline: deadline || undefined,
    assignedTo: req.user.role === 'CA-Admin' ? req.user._id : undefined
  });

  if (attachments && attachments.length > 0) {
    const docs = await Document.find({
      _id: { $in: attachments },
      isDeleted: false
    });

    if (docs.length !== attachments.length) {
      throw new ValidationError('One or more attachments not found');
    }

    for (const doc of docs) {
      if (doc.firmId.toString() !== firmId.toString()) {
        throw new AuthorizationError('You do not have access to one or more attachments');
      }
      if (doc.clientId.toString() !== targetClientId.toString()) {
        throw new AuthorizationError('Attachments must belong to the selected client');
      }
    }
  }

  // Create initial message
  const initialMessage = await Message.create({
    threadId: thread._id,
    sender: req.user._id,
    senderRole: req.user.role,
    content: message,
    messageType: 'text',
    attachments: attachments || [],
    inlineFiles: inlineFiles || []
  });

  // Populate thread data
  await thread.populate([
    { path: 'clientId', select: 'companyName email userId companyType userAccountId' },
    { path: 'initiatedByUser', select: 'name email' },
    { path: 'assignedTo', select: 'name email' }
  ]);

  // Create thread notification (non-blocking)
  try {
    const client = await Client.findById(targetClientId);
    const initiatedBy = await require('../models/User').findById(req.user._id);
    if (client && initiatedBy) {
      await notificationService.notifyThreadCreated(thread, client, initiatedBy);
    }
  } catch (notificationError) {
    console.error('Failed to create thread notification:', notificationError);
    // Continue even if notification fails
  }

  await emitThreadListUpdate(thread);

  res.status(201).json({
    success: true,
    message: 'Thread created successfully',
    data: { 
      thread,
      initialMessage
    }
  });
});

/**
 * @desc    Get all threads (with filters)
 * @route   GET /api/threads
 * @access  Private (CA-Admin and Client)
 */
exports.getThreads = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    serviceType, 
    priority,
    clientId,
    assignedTo,
    search,
    sortBy = 'lastMessage.createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query based on user role
  let query = { isDeleted: false };

  if (req.user.role === 'CA-Admin') {
    query.firmId = req.user.firmId;
    if (clientId) query.clientId = clientId;
    if (assignedTo) query.assignedTo = assignedTo;
  } else {
    // Client can only see their own threads
    const client = await Client.findOne({ 
      userAccountId: req.user._id, 
      isDeleted: false 
    });
    
    if (!client) {
      throw new NotFoundError('Client profile not found');
    }
    
    query.clientId = client._id;
  }

  // Apply filters
  if (status) {
    if (status === 'active') {
      query.status = { $nin: ['resolved', 'closed'] };
    } else {
      query.status = status;
    }
  }
  if (serviceType) query.serviceType = serviceType;
  if (priority) query.priority = priority;

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const threads = await Thread.find(query)
    .populate('clientId', 'companyName email userId companyType')
    .populate('initiatedByUser', 'name email')
    .populate('assignedTo', 'name email')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Thread.countDocuments(query);

  // Add unread indicator for current user
  const threadsWithUnread = threads.map(thread => {
    const threadObj = thread.toObject();
    threadObj.hasUnread = req.user.role === 'CA-Admin' 
      ? thread.unreadCountCA > 0 
      : thread.unreadCountClient > 0;
    return threadObj;
  });

  res.status(200).json({
    success: true,
    data: {
      threads: threadsWithUnread,
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
 * @desc    Get single thread with messages
 * @route   GET /api/threads/:id
 * @access  Private (CA-Admin and Client)
 */
exports.getThread = asyncHandler(async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id)
      .populate('clientId', 'companyName email userId companyType phoneNumber')
      .populate('initiatedByUser', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email');

    if (!thread || thread.isDeleted) {
      throw new NotFoundError('Thread not found');
    }

    // Authorization check
    if (req.user.role === 'CA-Admin') {
      if (thread.firmId.toString() !== req.user.firmId.toString()) {
        throw new AuthorizationError('You do not have access to this thread');
      }
    } else {
      const client = await Client.findOne({ 
        userAccountId: req.user._id, 
        isDeleted: false 
      });
      
      if (!client || thread.clientId._id.toString() !== client._id.toString()) {
        throw new AuthorizationError('You do not have access to this thread');
      }
    }

    // Mark as read for current user
    await thread.markAsRead(req.user.role);

    // Mark messages as read
    await Message.markAsRead(thread._id, req.user.role);

    // Get messages with validated pagination
    const messagePage = parseInt(req.query.messagePage, 10) || 1;
    const messageLimit = parseInt(req.query.messageLimit, 10) || 50;
    
    // Validate pagination parameters
    if (messagePage < 1 || messageLimit < 1 || messageLimit > 100) {
      throw new ValidationError('Invalid pagination parameters');
    }

    const { messages, pagination } = await Message.getThreadMessages(thread._id, {
      page: messagePage,
      limit: messageLimit,
      sortOrder: 'asc'
    });

    if (req.user.role === 'Client') {
      stripPaymentLockedUrlsForClient(messages);
    }

    res.status(200).json({
      success: true,
      data: { 
        thread,
        messages,
        messagePagination: pagination
      }
    });
  } catch (error) {
    // Log the specific error for debugging
    console.error('Error in getThread:', {
      threadId: req.params.id,
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    throw error;
  }
});

/**
 * @desc    Update thread
 * @route   PUT /api/threads/:id
 * @access  Private (CA-Admin only for most fields)
 */
exports.updateThread = asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  // Authorization check
  if (req.user.role === 'CA-Admin') {
    if (thread.firmId.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this thread');
    }
  } else {
    throw new AuthorizationError('Only CA-Admin can update thread details');
  }

  const { status, priority, deadline, assignedTo, tags, internalNotes } = req.body;

  // Track status change for system message
  const oldStatus = thread.status;

  // Update fields
  if (status && status !== thread.status) {
    const allowedStatuses = Thread.schema.path('status')?.enumValues || [];
    if (!allowedStatuses.includes(status)) {
      throw new ValidationError('Invalid thread status');
    }

    thread.status = status;
    
    // Create system message for status change
    await Message.createSystemMessage(
      thread._id, 
      'status-changed', 
      { oldStatus, newStatus: status },
      req.user._id
    );
  }
  
  if (priority) thread.priority = priority;
  if (deadline !== undefined) {
    // Validate deadline is in the future when setting a new deadline
    if (deadline && new Date(deadline) <= new Date()) {
      throw new ValidationError('Deadline must be in the future');
    }
    thread.deadline = deadline || null;
    if (deadline) {
      await Message.createSystemMessage(
        thread._id,
        'deadline-set',
        { deadline },
        req.user._id
      );
    }
  }
  if (assignedTo !== undefined) {
    thread.assignedTo = assignedTo || null;
  }
  if (tags) thread.tags = tags;
  if (internalNotes !== undefined) thread.internalNotes = internalNotes;

  await thread.save();

  await thread.populate([
    { path: 'clientId', select: 'companyName email userId' },
    { path: 'assignedTo', select: 'name email' }
  ]);

  await emitThreadListUpdate(thread);

  if (status && status !== oldStatus) {
    socketManager.emitThreadStatusChange(thread._id.toString(), {
      status: thread.status,
      updatedBy: req.user.name
    });
  }

  res.status(200).json({
    success: true,
    message: 'Thread updated successfully',
    data: { thread }
  });
});

/**
 * @desc    Resolve thread
 * @route   PUT /api/threads/:id/resolve
 * @access  Private (CA-Admin only)
 */
exports.resolveThread = asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can resolve threads');
  }

  if (thread.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this thread');
  }

  const { resolutionNotes } = req.body;

  await thread.resolve(req.user._id, resolutionNotes);

  // Create system message
  await Message.createSystemMessage(
    thread._id,
    'resolved',
    { resolutionNotes },
    req.user._id
  );

  // Create thread resolved notification (non-blocking)
  try {
    const client = await Client.findById(thread.clientId);
    const resolvedBy = await require('../models/User').findById(req.user._id);
    if (client && resolvedBy) {
      await notificationService.notifyThreadResolved(thread, client, resolvedBy);
    }
  } catch (notificationError) {
    console.error('Failed to create thread resolved notification:', notificationError);
    // Continue even if notification fails
  }

  socketManager.emitThreadStatusChange(thread._id.toString(), {
    status: 'resolved',
    updatedBy: req.user.name
  });

  await emitThreadListUpdate(thread);

  res.status(200).json({
    success: true,
    message: 'Thread resolved successfully',
    data: { thread }
  });
});

/**
 * @desc    Close thread
 * @route   PUT /api/threads/:id/close
 * @access  Private (CA-Admin only)
 */
exports.closeThread = asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can close threads');
  }

  if (thread.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this thread');
  }

  await thread.close();

  // Create system message
  await Message.createSystemMessage(
    thread._id,
    'closed',
    {},
    req.user._id
  );

  socketManager.emitThreadStatusChange(thread._id.toString(), {
    status: 'closed',
    updatedBy: req.user.name
  });

  await emitThreadListUpdate(thread);

  res.status(200).json({
    success: true,
    message: 'Thread closed successfully',
    data: { thread }
  });
});

/**
 * @desc    Reopen thread
 * @route   PUT /api/threads/:id/reopen
 * @access  Private (CA-Admin only)
 */
exports.reopenThread = asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can reopen threads');
  }

  if (thread.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this thread');
  }

  thread.status = 'open';
  thread.resolvedAt = null;
  thread.resolvedBy = null;
  thread.resolutionNotes = null;
  await thread.save();

  // Create system message
  await Message.createSystemMessage(
    thread._id,
    'reopened',
    {},
    req.user._id
  );

  socketManager.emitThreadStatusChange(thread._id.toString(), {
    status: 'open',
    updatedBy: req.user.name
  });

  await emitThreadListUpdate(thread);

  res.status(200).json({
    success: true,
    message: 'Thread reopened successfully',
    data: { thread }
  });
});

/**
 * @desc    Delete thread (soft delete)
 * @route   DELETE /api/threads/:id
 * @access  Private (CA-Admin only)
 */
exports.deleteThread = asyncHandler(async (req, res) => {
  const thread = await Thread.findById(req.params.id);

  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can delete threads');
  }

  if (thread.firmId.toString() !== req.user.firmId.toString()) {
    throw new AuthorizationError('You do not have access to this thread');
  }

  await thread.softDelete(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Thread deleted successfully'
  });
});

/**
 * @desc    Get thread statistics
 * @route   GET /api/threads/stats
 * @access  Private (CA-Admin only)
 */
exports.getThreadStats = asyncHandler(async (req, res) => {
  let match = { isDeleted: false };
  let unreadCountField = 'unreadCountCA';

  if (req.user.role === 'CA-Admin') {
    match.firmId = req.user.firmId;
    unreadCountField = 'unreadCountCA';
  } else if (req.user.role === 'Client') {
    const client = await Client.findOne({
      userAccountId: req.user._id,
      isDeleted: false
    });

    if (!client) {
      throw new NotFoundError('Client profile not found');
    }

    match.clientId = client._id;
    unreadCountField = 'unreadCountClient';
  } else {
    throw new AuthorizationError('Invalid role');
  }

  // Status breakdown
  const statusStats = await Thread.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Service type breakdown
  const serviceTypeStats = await Thread.aggregate([
    { $match: match },
    { $group: { _id: '$serviceType', count: { $sum: 1 } } }
  ]);

  // Priority breakdown
  const priorityStats = await Thread.aggregate([
    { $match: match },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);

  // Overdue threads
  const overdueCount = await Thread.countDocuments({
    ...match,
    status: { $nin: ['resolved', 'closed'] },
    deadline: { $lt: new Date() }
  });

  const unreadCount = await Thread.countDocuments({ ...match, [unreadCountField]: { $gt: 0 } });

  // Total counts
  const totalThreads = await Thread.countDocuments(match);
  const activeThreads = await Thread.countDocuments({ 
    ...match,
    status: { $nin: ['resolved', 'closed'] }
  });

  // Threads by initiator
  const initiatorStats = await Thread.aggregate([
    { $match: match },
    { $group: { _id: '$initiatedBy', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalThreads,
      activeThreads,
      overdueCount,
      unreadCount,
      byStatus: statusStats,
      byServiceType: serviceTypeStats,
      byPriority: priorityStats,
      byInitiator: initiatorStats
    }
  });
});

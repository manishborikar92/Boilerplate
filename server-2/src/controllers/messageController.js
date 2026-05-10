const Message = require('../models/Message');
const Thread = require('../models/Thread');
const Client = require('../models/Client');
const Document = require('../models/Document');
const { stripPaymentLockedUrlsForClient } = require('../utils/messageVisibility');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  AuthorizationError 
} = require('../utils/errorHandler');
const chatMessagePaymentService = require('../services/chatMessagePaymentService');
const notificationService = require('../services/notificationService');
const socketManager = require('../services/socketManager');

function getThreadStatusAfterMessage(currentStatus, senderRole) {
  if (currentStatus === 'open' || currentStatus?.startsWith('pending')) {
    return senderRole === 'CA-Admin' ? 'pending-client' : 'pending-ca';
  }

  return currentStatus;
}

async function resolveClientUserAccountId(clientId) {
  if (!clientId) {
    return null;
  }

  const client = await Client.findById(clientId)
    .select('userAccountId')
    .lean();

  return client?.userAccountId ? client.userAccountId.toString() : null;
}

/**
 * Helper: Verify thread access
 */
async function verifyThreadAccess(threadId, user) {
  const thread = await Thread.findById(threadId);
  
  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  if (user.role === 'CA-Admin') {
    if (thread.firmId.toString() !== user.firmId.toString()) {
      throw new AuthorizationError('You do not have access to this thread');
    }
  } else {
    const client = await Client.findOne({ 
      userAccountId: user._id, 
      isDeleted: false 
    });
    
    if (!client || thread.clientId.toString() !== client._id.toString()) {
      throw new AuthorizationError('You do not have access to this thread');
    }
  }

  return thread;
}

/**
 * @desc    Add message to thread
 * @route   POST /api/threads/:threadId/messages
 * @access  Private (CA-Admin and Client)
 */
exports.createMessage = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { content, attachments, inlineFiles, paymentRequired, 
          paymentAmount, paymentDescription, messageType, replyTo } = req.body;

  // Verify thread access
  const thread = await verifyThreadAccess(threadId, req.user);

  // Check if thread is closed
  if (thread.status === 'closed') {
    throw new ValidationError('Cannot add messages to a closed thread');
  }

  // Validate content or attachments
  if (!content && (!attachments || attachments.length === 0) && 
      (!inlineFiles || inlineFiles.length === 0)) {
    throw new ValidationError('Message must have content or attachments');
  }

  // Validate attachments if provided (must belong to user/firm)
  if (attachments && attachments.length > 0) {
    const docs = await Document.find({
      _id: { $in: attachments },
      isDeleted: false
    });

    if (docs.length !== attachments.length) {
      throw new ValidationError('One or more attachments not found');
    }

    // Verify ownership
    for (const doc of docs) {
      if (doc.clientId.toString() !== thread.clientId.toString()) {
        throw new AuthorizationError('Attachments must belong to this thread client');
      }

      if (req.user.role === 'CA-Admin') {
        if (doc.firmId.toString() !== req.user.firmId.toString()) {
          throw new AuthorizationError('You do not have access to one or more attachments');
        }
      } else {
        const client = await Client.findOne({ userAccountId: req.user._id });
        if (doc.clientId.toString() !== client._id.toString()) {
          throw new AuthorizationError('You do not have access to one or more attachments');
        }
      }
    }
  }

  // Only CA-Admin can set payment requirements
  let finalPaymentRequired = false;
  let finalPaymentAmount = 0;
  let paymentRecord = null;

  if (req.user.role === 'CA-Admin' && paymentRequired) {
    if (!paymentAmount || paymentAmount <= 0) {
      throw new ValidationError('Payment amount is required when payment is enabled');
    }

    // Validate attachment requirement
    const attachmentCount = (attachments?.length || 0) + (inlineFiles?.length || 0);
    if (attachmentCount === 0) {
      throw new ValidationError('A file attachment is required for payment requests');
    }

    // Check subscription limits and Create Payment record via service
    paymentRecord = await chatMessagePaymentService.createChatMessagePaymentRequirement({
      firmId: req.user.firmId,
      clientId: thread.clientId,
      threadId: thread._id,
      amount: paymentAmount, // Amount in paise passed from client
      description: paymentDescription,
      createdBy: req.user._id,
      documentIds: attachments
    });

    finalPaymentRequired = true;
    finalPaymentAmount = paymentRecord.amount;
  }

  // Determine message type
  let finalMessageType = messageType || 'text';
  if (finalPaymentRequired) {
    finalMessageType = 'payment-request';
  } else if (attachments?.length > 0 || inlineFiles?.length > 0) {
    if (req.user.role === 'CA-Admin') {
      finalMessageType = 'document-delivery';
    } else {
      finalMessageType = 'document-request'; // Client submitting documents
    }
  }

  // Create message
  const message = await Message.create({
    threadId,
    sender: req.user._id,
    senderRole: req.user.role,
    content: content || '',
    attachments: attachments || [],
    inlineFiles: inlineFiles || [],
    paymentRequired: finalPaymentRequired,
    paymentAmount: finalPaymentAmount,
    paymentDescription: paymentDescription || '',
    paymentId: paymentRecord?._id, // Link to the Payment record if created
    messageType: finalMessageType,
    replyTo: replyTo || undefined
  });

  // Update Payment record with messageId (if payment was created)
  if (paymentRecord) {
    paymentRecord.messageId = message._id;
    paymentRecord.notes.set('messageId', message._id.toString());
    await paymentRecord.save();
  }

  // Populate message data
  await message.populate([
    { path: 'sender', select: 'name email photoURL' },
    { path: 'attachments', select: 'fileName cloudinaryUrl fileSize mimeType', match: { isDeleted: false } },
    { path: 'replyTo', select: 'content senderRole createdAt' }
  ]);

  // Create message notification (non-blocking)
  try {
    const client = await Client.findById(thread.clientId);
    const sender = await require('../models/User').findById(req.user._id);
    if (client && sender) {
      await notificationService.notifyThreadMessageReceived(thread, message, client, sender);
    }
  } catch (notificationError) {
    console.error('Failed to create message notification:', notificationError);
    // Continue even if notification fails
  }

  socketManager.emitNewMessage(threadId, message);

  const clientUserId = await resolveClientUserAccountId(thread.clientId);

  socketManager.emitThreadListUpdate(thread.firmId.toString(), {
    _id: thread._id.toString(),
    subject: thread.subject,
    status: getThreadStatusAfterMessage(thread.status, req.user.role),
    lastMessage: {
      content: message.content?.substring(0, 200) || '',
      senderRole: req.user.role,
      hasAttachments: (message.attachments?.length > 0) || (message.inlineFiles?.length > 0),
      createdAt: message.createdAt
    }
  }, {
    clientUserId
  });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { message }
  });
});

/**
 * @desc    Get messages for a thread
 * @route   GET /api/threads/:threadId/messages
 * @access  Private (CA-Admin and Client)
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { page = 1, limit = 50, sortOrder = 'asc' } = req.query;

  // Verify thread access
  await verifyThreadAccess(threadId, req.user);

  // Get messages
  const result = await Message.getThreadMessages(threadId, {
    page: parseInt(page),
    limit: parseInt(limit),
    sortOrder
  });

  if (req.user.role === 'Client') {
    stripPaymentLockedUrlsForClient(result?.messages);
  }

  // Mark messages as read for current user
  await Message.markAsRead(threadId, req.user.role);

  // Update thread read status
  const thread = await Thread.findById(threadId);
  await thread.markAsRead(req.user.role);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Update message (before read)
 * @route   PUT /api/threads/:threadId/messages/:messageId
 * @access  Private (Message sender only)
 */
exports.updateMessage = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;
  const { content } = req.body;

  // Verify thread access
  await verifyThreadAccess(threadId, req.user);

  // Find message
  const message = await Message.findById(messageId);

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Verify ownership
  if (message.sender.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only edit your own messages');
  }

  // Check if can modify
  if (!message.canModify()) {
    throw new ValidationError('Cannot edit message after it has been read');
  }

  // Update content
  await message.editContent(content);

  await message.populate([
    { path: 'sender', select: 'name email photoURL' },
    { path: 'attachments', select: 'fileName cloudinaryUrl fileSize mimeType', match: { isDeleted: false } }
  ]);

  res.status(200).json({
    success: true,
    message: 'Message updated successfully',
    data: { message }
  });
});

/**
 * @desc    Delete message (before read)
 * @route   DELETE /api/threads/:threadId/messages/:messageId
 * @access  Private (Message sender only)
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;

  // Verify thread access
  await verifyThreadAccess(threadId, req.user);

  // Find message
  const message = await Message.findById(messageId);

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Verify ownership
  if (message.sender.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only delete your own messages');
  }

  // Check if can modify
  if (!message.canModify()) {
    throw new ValidationError('Cannot delete message after it has been read');
  }

  await message.softDelete(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully'
  });
});

/**
 * @desc    Mark message as read
 * @route   PUT /api/threads/:threadId/messages/:messageId/read
 * @access  Private (CA-Admin and Client)
 */
exports.markMessageAsRead = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;

  // Verify thread access
  await verifyThreadAccess(threadId, req.user);

  // Find message
  const message = await Message.findById(messageId);

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Only mark as read if from the other party
  if (message.senderRole !== req.user.role) {
    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    socketManager.emitMessagesRead(threadId, req.user.role);
  }

  res.status(200).json({
    success: true,
    message: 'Message marked as read'
  });
});

/**
 * @desc    Mark payment as complete for a message
 * @route   PUT /api/threads/:threadId/messages/:messageId/payment-complete
 * @access  Private (System/Webhook - called after payment verification)
 */
exports.markPaymentComplete = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;
  const { paymentId } = req.body;

  // Find message
  const message = await Message.findById(messageId);

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  if (!message.paymentRequired) {
    throw new ValidationError('This message does not require payment');
  }

  if (message.paymentStatus === 'paid') {
    throw new ValidationError('Payment already completed');
  }

  await message.markPaymentComplete(paymentId);

  res.status(200).json({
    success: true,
    message: 'Payment marked as complete',
    data: { message }
  });
});

/**
 * @desc    Waive payment for a message
 * @route   PUT /api/threads/:threadId/messages/:messageId/waive-payment
 * @access  Private (CA-Admin only)
 */
exports.waivePayment = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.params;

  // Verify thread access and CA-Admin role
  const thread = await verifyThreadAccess(threadId, req.user);

  if (req.user.role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin can waive payments');
  }

  // Find message
  const message = await Message.findById(messageId);

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  if (!message.paymentRequired) {
    throw new ValidationError('This message does not require payment');
  }

  if (message.paymentStatus === 'paid') {
    throw new ValidationError('Payment already completed');
  }

  await message.waivePayment();

  res.status(200).json({
    success: true,
    message: 'Payment waived successfully',
    data: { message }
  });
});

/**
 * @desc    Get messages with pending payments for a thread
 * @route   GET /api/threads/:threadId/messages/pending-payments
 * @access  Private (CA-Admin and Client)
 */
exports.getPendingPaymentMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  // Verify thread access
  await verifyThreadAccess(threadId, req.user);

  const messages = await Message.getPendingPaymentMessages(threadId);

  res.status(200).json({
    success: true,
    data: { 
      messages,
      count: messages.length
    }
  });
});

/**
 * @desc    Get all pending payment messages across threads (Client view)
 * @route   GET /api/messages/my-pending-payments
 * @access  Private (Client only)
 */
exports.getMyPendingPayments = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Client') {
    throw new AuthorizationError('This endpoint is for clients only');
  }

  // Get client
  const client = await Client.findOne({ 
    userAccountId: req.user._id, 
    isDeleted: false 
  });

  if (!client) {
    throw new NotFoundError('Client profile not found');
  }

  // Get all threads for this client
  const threads = await Thread.find({ 
    clientId: client._id, 
    isDeleted: false 
  }).select('_id threadNumber subject');

  const threadIds = threads.map(t => t._id);

  // Get pending payment messages
  const messages = await Message.find({
    threadId: { $in: threadIds },
    paymentRequired: true,
    paymentStatus: 'pending',
    isDeleted: false
  })
    .populate('threadId', 'threadNumber subject')
    .populate('sender', 'name email')
    .populate({ path: 'attachments', select: 'fileName cloudinaryUrl fileSize', match: { isDeleted: false } })
    .sort({ createdAt: -1 });

  // Calculate total pending amount
  const totalPendingAmount = messages.reduce((sum, msg) => sum + msg.paymentAmount, 0);

  res.status(200).json({
    success: true,
    data: {
      messages,
      count: messages.length,
      totalPendingAmount,
      totalPendingAmountFormatted: `₹${(totalPendingAmount / 100).toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`
    }
  });
});

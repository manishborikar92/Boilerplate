const mongoose = require('mongoose');

/**
 * Message Schema
 * Represents individual messages within a conversation thread
 * Supports text, attachments, and payment requirements
 */
const messageSchema = new mongoose.Schema({
  // Thread Reference
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
    required: [true, 'Thread reference is required'],
    index: true
  },
  
  // Sender Information
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  
  senderRole: {
    type: String,
    enum: {
      values: ['CA-Admin', 'Client'],
      message: '{VALUE} is not a valid sender role'
    },
    required: [true, 'Sender role is required']
  },
  
  // Message Content
  content: {
    type: String,
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  
  // Document Attachments (references to Document model)
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  
  // Inline uploaded files (for quick uploads within conversation)
  inlineFiles: [{
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String
    },
    cloudinaryUrl: {
      type: String,
      required: true
    },
    cloudinaryPublicId: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number
    },
    mimeType: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Payment Requirements (for CA responses with deliverables)
  paymentRequired: {
    type: Boolean,
    default: false
  },
  
  paymentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Payment amount cannot be negative']
    // Stored in paise (Indian currency smallest unit)
  },
  
  paymentDescription: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  paymentStatus: {
    type: String,
    enum: ['not-required', 'pending', 'paid', 'waived'],
    default: 'not-required'
  },
  
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  
  paidAt: {
    type: Date
  },
  
  // Read Status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  
  // Message Type (for UI rendering and filtering)
  messageType: {
    type: String,
    enum: {
      values: ['text', 'document-request', 'document-delivery', 
               'status-update', 'system', 'payment-request'],
      message: '{VALUE} is not a valid message type'
    },
    default: 'text'
  },
  
  // System message metadata (for messageType: 'system')
  systemAction: {
    type: String,
    enum: ['thread-created', 'status-changed', 'assigned', 
           'deadline-set', 'resolved', 'closed', 'reopened']
  },
  
  systemMetadata: {
    type: mongoose.Schema.Types.Mixed
    // Stores action-specific data like { oldStatus, newStatus }
  },
  
  // Edit tracking
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  originalContent: {
    type: String
    // Stores original content before edit
  },
  
  // Reply reference (for threaded replies within conversation)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Legacy reference (for migration)
  legacyResponseId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ senderRole: 1 });
messageSchema.index({ paymentStatus: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ isDeleted: 1 });

// Compound indexes for common queries
messageSchema.index({ threadId: 1, isDeleted: 1, createdAt: 1 });
messageSchema.index({ threadId: 1, paymentRequired: 1 });

// ==================== VIRTUALS ====================
messageSchema.virtual('attachmentCount').get(function() {
  const docCount = this.attachments?.length || 0;
  const inlineCount = this.inlineFiles?.length || 0;
  return docCount + inlineCount;
});

messageSchema.virtual('hasAttachments').get(function() {
  return this.attachmentCount > 0;
});

messageSchema.virtual('paymentAmountFormatted').get(function() {
  if (!this.paymentAmount) return '₹0.00';
  const rupees = this.paymentAmount / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

messageSchema.virtual('isPaymentPending').get(function() {
  return this.paymentRequired && this.paymentStatus === 'pending';
});

// ==================== MIDDLEWARE ====================

/**
 * Pre-save: Set payment status based on paymentRequired
 */
messageSchema.pre('save', function(next) {
  this._wasNew = this.isNew;
  if (this.isNew) {
    if (this.paymentRequired && this.paymentAmount > 0) {
      this.paymentStatus = 'pending';
    } else {
      this.paymentStatus = 'not-required';
    }
  }
  next();
});

/**
 * Post-save: Update thread's last message
 */
messageSchema.post('save', async function(doc) {
  if (doc._wasNew && !doc.isDeleted) {
    try {
      const Thread = mongoose.model('Thread');
      const thread = await Thread.findById(doc.threadId);
      if (thread) {
        await thread.updateLastMessage(doc);
        if (doc.messageType !== 'system') {
          await thread.updateStatusAfterMessage(doc.senderRole);
        }
      }
    } catch (error) {
      console.error('Error updating thread after message save:', error);
    }
  }
});

// ==================== STATIC METHODS ====================

/**
 * Get messages for a thread with pagination
 */
messageSchema.statics.getThreadMessages = async function(threadId, options = {}) {
  const {
    page = 1,
    limit = 50,
    sortOrder = 'asc' // 'asc' for oldest first, 'desc' for newest first
  } = options;
  
  // Ensure page and limit are integers
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;
  
  // Validate pagination parameters
  if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
    throw new Error('Invalid pagination parameters');
  }
  
  const query = { 
    threadId, 
    isDeleted: false 
  };
  
  const sort = sortOrder === 'desc' ? { createdAt: -1 } : { createdAt: 1 };
  
  const messages = await this.find(query)
    .populate('sender', 'name email photoURL')
    .populate({
      path: 'attachments',
      select: 'fileName cloudinaryUrl fileSize mimeType',
      match: { isDeleted: false }
    })
    .populate('replyTo', 'content senderRole createdAt')
    .sort(sort)
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum);
  
  const total = await this.countDocuments(query);
  
  return {
    messages,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum
    }
  };
};

/**
 * Get unread messages count for a thread by role
 */
messageSchema.statics.getUnreadCount = async function(threadId, forRole) {
  // Unread messages are those sent by the OTHER role
  const senderRole = forRole === 'CA-Admin' ? 'Client' : 'CA-Admin';
  
  return this.countDocuments({
    threadId,
    senderRole,
    isRead: false,
    isDeleted: false
  });
};

/**
 * Mark messages as read
 */
messageSchema.statics.markAsRead = async function(threadId, forRole) {
  // Mark messages from the OTHER role as read
  const senderRole = forRole === 'CA-Admin' ? 'Client' : 'CA-Admin';
  
  const result = await this.updateMany(
    {
      threadId,
      senderRole,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
  
  return result.modifiedCount;
};

/**
 * Get messages with pending payments
 */
messageSchema.statics.getPendingPaymentMessages = async function(threadId) {
  return this.find({
    threadId,
    paymentRequired: true,
    paymentStatus: 'pending',
    isDeleted: false
  })
    .populate({
      path: 'attachments',
      select: 'fileName cloudinaryUrl fileSize',
      match: { isDeleted: false }
    })
    .sort({ createdAt: -1 });
};

/**
 * Create system message
 */
messageSchema.statics.createSystemMessage = async function(threadId, action, metadata, userId) {
  const actionMessages = {
    'thread-created': 'Thread created',
    'status-changed': `Status changed from "${metadata.oldStatus}" to "${metadata.newStatus}"`,
    'assigned': `Assigned to ${metadata.assigneeName}`,
    'deadline-set': `Deadline set to ${new Date(metadata.deadline).toLocaleDateString()}`,
    'resolved': 'Thread marked as resolved',
    'closed': 'Thread closed',
    'reopened': 'Thread reopened'
  };
  
  return this.create({
    threadId,
    sender: userId,
    senderRole: 'CA-Admin', // System messages are always from CA side
    content: actionMessages[action] || action,
    messageType: 'system',
    systemAction: action,
    systemMetadata: metadata
  });
};

// ==================== INSTANCE METHODS ====================

/**
 * Edit message content
 */
messageSchema.methods.editContent = async function(newContent) {
  if (this.isRead) {
    throw new Error('Cannot edit message after it has been read');
  }
  
  if (!this.originalContent) {
    this.originalContent = this.content;
  }
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

/**
 * Mark payment as completed
 */
messageSchema.methods.markPaymentComplete = async function(paymentId) {
  this.paymentStatus = 'paid';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  
  return this.save();
};

/**
 * Waive payment requirement
 */
messageSchema.methods.waivePayment = async function() {
  this.paymentStatus = 'waived';
  this.paidAt = new Date();
  
  return this.save();
};

/**
 * Soft delete
 */
messageSchema.methods.softDelete = async function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  
  return this.save();
};

/**
 * Check if message can be edited/deleted
 */
messageSchema.methods.canModify = function() {
  // Can only modify if not read and not a system message
  return !this.isRead && this.messageType !== 'system';
};

module.exports = mongoose.model('Message', messageSchema);

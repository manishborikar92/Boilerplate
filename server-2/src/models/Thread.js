const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Thread Schema
 * Represents a conversation thread between CA-Admin and Client
 */
const threadSchema = new mongoose.Schema({
  // Thread Identity
  threadNumber: {
    type: String,
    required: true
    // Format: THR-YYYY-NNNNN
    // Uniqueness is enforced by compound index with firmId
  },
  
  // Subject/Title
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  
  // Service Classification
  serviceType: {
    type: String,
    enum: {
      values: ['Tax Filing', 'GST Return', 'Audit', 'Compliance', 
               'ROC Filing', 'Consultation', 'Notice', 'General', 'Other'],
      message: '{VALUE} is not a valid service type'
    },
    required: [true, 'Service type is required']
  },
  
  // Custom service name (when serviceType is 'Other')
  customServiceName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Client Participant
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  
  // Firm Association
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required']
  },
  
  // Thread Initiator
  initiatedBy: {
    type: String,
    enum: ['CA-Admin', 'Client'],
    required: [true, 'Initiator role is required']
  },
  
  initiatedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Initiator user is required']
  },
  
  // Status Management
  status: {
    type: String,
    enum: {
      values: ['open', 'pending-client', 'pending-ca', 'resolved', 'closed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'open'
  },
  
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Deadline (optional)
  deadline: {
    type: Date
    // Note: No validation - deadlines can be in the past (overdue)
  },
  
  // Assignment (CA-Admin user)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Read Status Tracking
  lastReadByCA: {
    type: Date
  },
  lastReadByClient: {
    type: Date
  },
  
  // Unread counts (denormalized for performance)
  unreadCountCA: {
    type: Number,
    default: 0
  },
  unreadCountClient: {
    type: Number,
    default: 0
  },
  
  // Message Count (denormalized for performance)
  messageCount: {
    type: Number,
    default: 0
  },
  
  // Last Message Preview (denormalized for list display)
  lastMessage: {
    content: {
      type: String,
      maxlength: 200
    },
    senderRole: {
      type: String,
      enum: ['CA-Admin', 'Client']
    },
    hasAttachments: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date
    }
  },
  
  // Tags for organization
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Notes (internal, CA-Admin only)
  internalNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Resolution details
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Soft delete
  isActive: {
    type: Boolean,
    default: true
  },
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
// Compound unique index: threadNumber must be unique within each firm
threadSchema.index(
  { firmId: 1, threadNumber: 1 },
  { unique: true }
);

threadSchema.index({ firmId: 1, status: 1, createdAt: -1 });
threadSchema.index({ clientId: 1, status: 1, createdAt: -1 });
threadSchema.index({ firmId: 1, clientId: 1 });
threadSchema.index({ serviceType: 1 });
threadSchema.index({ assignedTo: 1, status: 1 });
threadSchema.index({ priority: 1, status: 1 });
threadSchema.index({ deadline: 1 });
threadSchema.index({ 'lastMessage.createdAt': -1 });
threadSchema.index({ isDeleted: 1 });

// Text index for search
threadSchema.index({ 
  subject: 'text', 
  threadNumber: 'text',
  tags: 'text'
});

// ==================== VIRTUALS ====================
threadSchema.virtual('isOverdue').get(function() {
  if (!this.deadline || ['resolved', 'closed'].includes(this.status)) {
    return false;
  }
  return new Date() > new Date(this.deadline);
});

threadSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

threadSchema.virtual('daysSinceCreation').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// ==================== STATIC METHODS ====================

/**
 * Generate unique thread number using atomic counter
 * Format: THR-YYYY-NNNNN
 * This method is thread-safe and handles concurrent requests properly
 */
threadSchema.statics.generateThreadNumber = async function(firmId) {
  const year = new Date().getFullYear();
  
  // Get next sequence number atomically
  const sequence = await Counter.getNextSequence(firmId, year, 'thread');
  
  return `THR-${year}-${String(sequence).padStart(5, '0')}`;
};

/**
 * Find active threads for a firm
 */
threadSchema.statics.findByFirm = function(firmId, options = {}) {
  const query = { firmId, isDeleted: false };
  
  if (options.status) query.status = options.status;
  if (options.clientId) query.clientId = options.clientId;
  if (options.serviceType) query.serviceType = options.serviceType;
  if (options.priority) query.priority = options.priority;
  if (options.assignedTo) query.assignedTo = options.assignedTo;
  
  return this.find(query);
};

/**
 * Find active threads for a client
 */
threadSchema.statics.findByClient = function(clientId, options = {}) {
  const query = { clientId, isDeleted: false };
  
  if (options.status) query.status = options.status;
  if (options.serviceType) query.serviceType = options.serviceType;
  
  return this.find(query);
};

// ==================== INSTANCE METHODS ====================

/**
 * Update last message preview
 */
threadSchema.methods.updateLastMessage = async function(message) {
  this.lastMessage = {
    content: message.content ? message.content.substring(0, 200) : '',
    senderRole: message.senderRole,
    hasAttachments: (message.attachments?.length > 0) || (message.inlineFiles?.length > 0),
    createdAt: message.createdAt || new Date()
  };
  this.messageCount += 1;
  
  // Update unread counts
  if (message.senderRole === 'CA-Admin') {
    this.unreadCountClient += 1;
  } else {
    this.unreadCountCA += 1;
  }
  
  return this.save();
};

/**
 * Mark as read by role
 */
threadSchema.methods.markAsRead = async function(role) {
  const now = new Date();
  
  if (role === 'CA-Admin') {
    this.lastReadByCA = now;
    this.unreadCountCA = 0;
  } else if (role === 'Client') {
    this.lastReadByClient = now;
    this.unreadCountClient = 0;
  }
  
  return this.save();
};

/**
 * Update status with automatic pending state
 */
threadSchema.methods.updateStatusAfterMessage = async function(senderRole) {
  // If sender is CA, status becomes pending-client
  // If sender is Client, status becomes pending-ca
  if (this.status === 'open' || this.status.startsWith('pending')) {
    this.status = senderRole === 'CA-Admin' ? 'pending-client' : 'pending-ca';
  }
  
  return this.save();
};

/**
 * Resolve thread
 */
threadSchema.methods.resolve = async function(userId, notes) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  if (notes) this.resolutionNotes = notes;
  
  return this.save();
};

/**
 * Close thread
 */
threadSchema.methods.close = async function() {
  this.status = 'closed';
  return this.save();
};

/**
 * Soft delete
 */
threadSchema.methods.softDelete = async function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

module.exports = mongoose.model('Thread', threadSchema);

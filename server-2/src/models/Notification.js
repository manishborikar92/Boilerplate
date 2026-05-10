const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Notification Schema
 * System-generated notifications for CA-Admin users
 * 
 * Notification Types:
 * - payment: Payment received, payment failed, subscription events
 * - login: User login events (CA-Admin, Client)
 * - subscription: Subscription activated, cancelled, upgraded
 * - client: New client added, client updated
 * - document: Document uploaded, document accessed
 * - thread: New thread created, thread message received
 * - system: System alerts, warnings, errors
 */
const notificationSchema = new mongoose.Schema({
  // Notification Identity
  notificationNumber: {
    type: String,
    required: true
    // Format: NOT-YYYY-NNNNN
    // Uniqueness is enforced by compound index with firmId
  },
  
  // Notification Type
  type: {
    type: String,
    enum: {
      values: [
        'payment',
        'login',
        'subscription',
        'client',
        'document',
        'thread',
        'system'
      ],
      message: '{VALUE} is not a valid notification type'
    },
    required: [true, 'Notification type is required'],
    index: true
  },
  
  // Notification Subtype (for more granular categorization)
  subtype: {
    type: String,
    enum: {
      values: [
        // Payment subtypes
        'payment_received',
        'payment_failed',
        'payment_pending',
        'document_payment_received',
        'invoice_payment_received',
        
        // Login subtypes
        'ca_admin_login',
        'client_login',
        'client_first_login',
        'failed_login_attempt',
        
        // Subscription subtypes
        'subscription_activated',
        'subscription_cancelled',
        'subscription_upgraded',
        'subscription_payment_failed',
        'subscription_expiring_soon',
        
        // Client subtypes
        'client_added',
        'client_updated',
        'client_deleted',
        'client_account_created',
        
        // Document subtypes
        'document_uploaded',
        'document_accessed',
        'document_payment_required',
        'bulk_documents_uploaded',
        
        // Thread subtypes
        'thread_created',
        'thread_message_received',
        'thread_resolved',
        'thread_reopened',
        
        // System subtypes
        'system_alert',
        'system_warning',
        'system_error'
      ],
      message: '{VALUE} is not a valid notification subtype'
    },
    required: [true, 'Notification subtype is required'],
    index: true
  },
  
  // Priority Level
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  // Notification Title
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  // Notification Message
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  
  // Recipient (CA-Admin user)
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required'],
    index: true
  },
  
  // Firm Association
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true
  },
  
  // Related Entity References (for navigation)
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['Payment', 'Client', 'Document', 'Thread', 'Message', 'User', 'Subscription', 'Firm'],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    }
  },
  
  // Additional Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // Can store additional context like amounts, names, etc.
  },
  
  // Action URL (for navigation)
  actionUrl: {
    type: String,
    trim: true
  },
  
  // Action Label (button text)
  actionLabel: {
    type: String,
    trim: true,
    maxlength: [50, 'Action label cannot exceed 50 characters']
  },
  
  // Read Status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  
  readAt: {
    type: Date,
    index: true
  },
  
  // Archived Status
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  
  archivedAt: {
    type: Date
  },
  
  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: {
    type: Date
  },
  
  // Expiration (auto-delete old notifications)
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
// Compound unique index: notificationNumber must be unique within each firm
notificationSchema.index(
  { firmId: 1, notificationNumber: 1 },
  { unique: true }
);

notificationSchema.index({ firmId: 1, recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ firmId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1, isArchived: 1, isDeleted: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// ==================== VIRTUALS ====================
notificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
});

notificationSchema.virtual('age').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60)); // Age in minutes
});

// ==================== STATIC METHODS ====================

/**
 * Generate unique notification number using atomic counter
 * Format: NOT-YYYY-NNNNN
 * Thread-safe and handles concurrent requests properly
 */
notificationSchema.statics.generateNotificationNumber = async function(firmId) {
  const year = new Date().getFullYear();
  const sequence = await Counter.getNextSequence(firmId, year, 'notification');
  return `NOT-${year}-${String(sequence).padStart(5, '0')}`;
};

/**
 * Create notification with auto-generated number
 */
notificationSchema.statics.createNotification = async function(data) {
  const notificationNumber = await this.generateNotificationNumber(data.firmId);
  
  return await this.create({
    ...data,
    notificationNumber
  });
};

/**
 * Get unread count for a user
 */
notificationSchema.statics.getUnreadCount = async function(recipientId) {
  return this.countDocuments({
    recipientId,
    isRead: false,
    isArchived: false,
    isDeleted: false
  });
};

/**
 * Get notifications for a user with filters
 */
notificationSchema.statics.getUserNotifications = async function(recipientId, options = {}) {
  const {
    type,
    subtype,
    isRead,
    isArchived = false,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;
  
  const query = {
    recipientId,
    isDeleted: false,
    isArchived
  };
  
  if (type) query.type = type;
  if (subtype) query.subtype = subtype;
  if (isRead !== undefined) query.isRead = isRead;
  
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;
  
  const notifications = await this.find(query)
    .populate('recipientId', 'name email')
    .populate('firmId', 'firmName')
    .sort(sort)
    .skip(skip)
    .limit(limit);
  
  const total = await this.countDocuments(query);
  
  return {
    notifications,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    }
  };
};

/**
 * Mark notification as read
 */
notificationSchema.statics.markAsRead = async function(notificationId, recipientId) {
  return this.findOneAndUpdate(
    { _id: notificationId, recipientId },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    },
    { new: true }
  );
};

/**
 * Mark all notifications as read for a user
 */
notificationSchema.statics.markAllAsRead = async function(recipientId) {
  return this.updateMany(
    { recipientId, isRead: false, isDeleted: false },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

/**
 * Archive notification
 */
notificationSchema.statics.archiveNotification = async function(notificationId, recipientId) {
  return this.findOneAndUpdate(
    { _id: notificationId, recipientId },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date()
      }
    },
    { new: true }
  );
};

/**
 * Delete old notifications (cleanup)
 */
notificationSchema.statics.deleteOldNotifications = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// ==================== INSTANCE METHODS ====================

/**
 * Mark as read
 */
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

/**
 * Archive notification
 */
notificationSchema.methods.archive = async function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

/**
 * Soft delete
 */
notificationSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);

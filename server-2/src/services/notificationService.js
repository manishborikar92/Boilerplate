const Notification = require('../models/Notification');
const User = require('../models/User');
const { logger } = require('../middleware/logger');
const emailNotificationService = require('./emailNotificationService');
const socketManager = require('./socketManager');
const {
  CA_ADMIN_ROUTES,
  CLIENT_PORTAL_ROUTES,
  buildCaAdminConversationPath,
  buildCaAdminSettingsPath,
  buildClientConversationPath,
} = require('../constants/frontendRoutes');
// TWILIO DISABLED: SMS and WhatsApp notifications are not currently in use
// const smsNotificationService = require('./smsNotificationService');
// const whatsappNotificationService = require('./whatsappNotificationService');

/**
 * Notification Service
 * Centralized service for creating and managing system notifications
 */
class NotificationService {
  /**
   * Create a notification
   * @param {Object} data - Notification data
   * @returns {Promise<Notification>}
   */
  async createNotification(data) {
    try {
      const notification = await Notification.createNotification(data);
      
      logger.info('Notification created', {
        notificationId: notification._id,
        type: notification.type,
        subtype: notification.subtype,
        recipientId: notification.recipientId,
        priority: notification.priority
      });
      
      // Send notifications via all enabled channels (non-blocking)
      if (['urgent', 'high', 'normal'].includes(notification.priority)) {
        // Fire and forget - don't wait for notifications to complete
        
        // Email notification
        emailNotificationService.sendNotificationEmail(notification).catch(error => {
          logger.error('Email notification failed (non-blocking)', {
            error: error.message,
            notificationId: notification._id
          });
        });
        
        // TWILIO DISABLED: SMS and WhatsApp notifications are not currently in use
        // To re-enable: uncomment the imports at the top and these service calls
        /*
        // SMS notification (respects firm preferences and subscription)
        smsNotificationService.sendNotificationSMS(notification).catch(error => {
          logger.error('SMS notification failed (non-blocking)', {
            error: error.message,
            notificationId: notification._id
          });
        });
        
        // WhatsApp notification (respects firm preferences and subscription)
        whatsappNotificationService.sendNotificationWhatsApp(notification).catch(error => {
          logger.error('WhatsApp notification failed (non-blocking)', {
            error: error.message,
            notificationId: notification._id
          });
        });
        */
      }
      
      socketManager.emitNotification(
        notification.recipientId.toString(),
        notification
      );

      const unreadCount = await Notification.getUnreadCount(notification.recipientId);
      socketManager.emitUnreadCount(
        notification.recipientId.toString(),
        unreadCount
      );
      
      return notification;
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Create notification for all CA-Admins in a firm
   * @param {ObjectId} firmId - Firm ID
   * @param {Object} notificationData - Notification data (without recipientId)
   * @returns {Promise<Array>}
   */
  async createFirmNotification(firmId, notificationData) {
    try {
      // Get all CA-Admin users for this firm
      const caAdmins = await User.find({
        firmId,
        role: 'CA-Admin',
        isDeleted: false
      }).select('_id');
      
      const notifications = [];
      
      for (const admin of caAdmins) {
        const notification = await Notification.createNotification({
          ...notificationData,
          recipientId: admin._id,
          firmId
        });
        notifications.push(notification);
        
        logger.info('Firm notification created', {
          notificationId: notification._id,
          type: notification.type,
          subtype: notification.subtype,
          recipientId: admin._id,
          priority: notification.priority
        });

        socketManager.emitNotification(
          admin._id.toString(),
          notification
        );

        const unreadCount = await Notification.getUnreadCount(admin._id);
        socketManager.emitUnreadCount(
          admin._id.toString(),
          unreadCount
        );
      }
      
      // Send batch notifications via all enabled channels (non-blocking)
      if (['urgent', 'high', 'normal'].includes(notificationData.priority)) {
        // Fire and forget - don't wait for notifications to complete
        
        // Batch email notifications
        emailNotificationService.sendBatchNotificationEmails(notifications).catch(error => {
          logger.error('Batch email notifications failed (non-blocking)', {
            error: error.message,
            firmId
          });
        });
        
        // TWILIO DISABLED: SMS and WhatsApp notifications are not currently in use
        // To re-enable: uncomment the imports at the top and these service calls
        /*
        // Batch SMS notifications (respects firm preferences and subscription)
        smsNotificationService.sendBatchNotificationSMS(notifications).catch(error => {
          logger.error('Batch SMS notifications failed (non-blocking)', {
            error: error.message,
            firmId
          });
        });
        
        // Batch WhatsApp notifications (respects firm preferences and subscription)
        whatsappNotificationService.sendBatchNotificationWhatsApp(notifications).catch(error => {
          logger.error('Batch WhatsApp notifications failed (non-blocking)', {
            error: error.message,
            firmId
          });
        });
        */
      }
      
      return notifications;
    } catch (error) {
      logger.error('Failed to create firm notification', {
        error: error.message,
        firmId
      });
      throw error;
    }
  }

  // ==================== PAYMENT NOTIFICATIONS ====================

  /**
   * Notify when payment is received
   */
  async notifyPaymentReceived(payment, client) {
    const amountInRupees = (payment.amount / 100).toFixed(2);
    
    return this.createFirmNotification(payment.firmId, {
      type: 'payment',
      subtype: payment.paymentType === 'document' ? 'document_payment_received' : 'invoice_payment_received',
      priority: 'high',
      title: 'Payment Received',
      message: `Payment of ₹${amountInRupees} received from ${client.companyName}`,
      relatedEntity: {
        entityType: 'Payment',
        entityId: payment._id
      },
      metadata: {
        amount: payment.amount,
        amountInRupees,
        clientName: client.companyName,
        clientId: client._id,
        paymentType: payment.paymentType,
        invoiceNumber: payment.invoiceNumber
      },
      actionUrl: buildCaAdminSettingsPath('payments'),
      actionLabel: 'View Payment'
    });
  }

  /**
   * Notify when payment fails
   */
  async notifyPaymentFailed(payment, client) {
    const amountInRupees = (payment.amount / 100).toFixed(2);
    
    return this.createFirmNotification(payment.firmId, {
      type: 'payment',
      subtype: 'payment_failed',
      priority: 'high',
      title: 'Payment Failed',
      message: `Payment of ₹${amountInRupees} from ${client.companyName} has failed`,
      relatedEntity: {
        entityType: 'Payment',
        entityId: payment._id
      },
      metadata: {
        amount: payment.amount,
        amountInRupees,
        clientName: client.companyName,
        clientId: client._id,
        paymentType: payment.paymentType
      },
      actionUrl: buildCaAdminSettingsPath('payments'),
      actionLabel: 'View Details'
    });
  }

  // ==================== LOGIN NOTIFICATIONS ====================

  /**
   * Notify when client logs in (first time)
   */
  async notifyClientFirstLogin(client, user) {
    return this.createFirmNotification(client.firmId, {
      type: 'login',
      subtype: 'client_first_login',
      priority: 'normal',
      title: 'Client First Login',
      message: `${client.companyName} logged in for the first time`,
      relatedEntity: {
        entityType: 'Client',
        entityId: client._id
      },
      metadata: {
        clientName: client.companyName,
        clientId: client._id,
        userId: client.userAccountId,
        loginTime: new Date()
      },
      actionUrl: CA_ADMIN_ROUTES.CLIENTS,
      actionLabel: 'View Client'
    });
  }

  /**
   * Notify when client logs in (regular)
   */
  async notifyClientLogin(client, user) {
    return this.createFirmNotification(client.firmId, {
      type: 'login',
      subtype: 'client_login',
      priority: 'low',
      title: 'Client Login',
      message: `${client.companyName} logged in`,
      relatedEntity: {
        entityType: 'Client',
        entityId: client._id
      },
      metadata: {
        clientName: client.companyName,
        clientId: client._id,
        userId: client.userAccountId,
        loginTime: new Date()
      },
      actionUrl: CA_ADMIN_ROUTES.CLIENTS,
      actionLabel: 'View Client'
    });
  }

  // ==================== SUBSCRIPTION NOTIFICATIONS ====================

  /**
   * Notify when subscription is activated
   */
  async notifySubscriptionActivated(payment, plan) {
    return this.createNotification({
      type: 'subscription',
      subtype: 'subscription_activated',
      priority: 'high',
      title: 'Subscription Activated',
      message: `Your ${plan.planName} subscription has been activated`,
      recipientId: payment.createdBy,
      firmId: payment.firmId,
      relatedEntity: {
        entityType: 'Payment',
        entityId: payment._id
      },
      metadata: {
        planName: plan.planName,
        amount: payment.amount,
        billingPeriod: payment.billingPeriod,
        nextBillingDate: payment.nextBillingDate
      },
      actionUrl: buildCaAdminSettingsPath('subscriptions'),
      actionLabel: 'View Subscription'
    });
  }

  /**
   * Notify when subscription payment fails
   */
  async notifySubscriptionPaymentFailed(payment, plan) {
    return this.createNotification({
      type: 'subscription',
      subtype: 'subscription_payment_failed',
      priority: 'urgent',
      title: 'Subscription Payment Failed',
      message: `Payment for your ${plan.planName} subscription has failed`,
      recipientId: payment.createdBy,
      firmId: payment.firmId,
      relatedEntity: {
        entityType: 'Payment',
        entityId: payment._id
      },
      metadata: {
        planName: plan.planName,
        amount: payment.amount,
        billingPeriod: payment.billingPeriod
      },
      actionUrl: buildCaAdminSettingsPath('subscriptions'),
      actionLabel: 'Update Payment'
    });
  }

  /**
   * Notify when subscription is cancelled
   */
  async notifySubscriptionCancelled(payment, plan) {
    return this.createNotification({
      type: 'subscription',
      subtype: 'subscription_cancelled',
      priority: 'high',
      title: 'Subscription Cancelled',
      message: `Your ${plan.planName} subscription has been cancelled`,
      recipientId: payment.createdBy,
      firmId: payment.firmId,
      relatedEntity: {
        entityType: 'Payment',
        entityId: payment._id
      },
      metadata: {
        planName: plan.planName,
        cancelledAt: new Date()
      },
      actionUrl: buildCaAdminSettingsPath('subscriptions'),
      actionLabel: 'View Details'
    });
  }

  // ==================== DOCUMENT NOTIFICATIONS ====================

  /**
   * Notify when documents are uploaded from conversations (bidirectional - notifies opposite party)
   * When CA-Admin uploads in conversation, notify Client
   * When Client uploads in conversation, notify CA-Admin
   */
  async notifyDocumentsUploaded(documents, client, uploadedBy, isConversationUpload = false) {
    const count = documents.length;
    const title = count === 1 ? 'Document Uploaded' : `${count} Documents Uploaded`;
    
    // Only apply bidirectional logic for conversation uploads
    if (isConversationUpload) {
      // Determine who to notify based on who uploaded
      if (uploadedBy.role === 'CA-Admin') {
        // CA-Admin uploaded in conversation, notify Client
        if (!client.userAccountId) return null;
        
        const message = count === 1 
          ? `Your CA uploaded ${documents[0].fileName} in conversation`
          : `Your CA uploaded ${count} documents in conversation`;
        
        return this.createNotification({
          type: 'document',
          subtype: count === 1 ? 'document_uploaded' : 'bulk_documents_uploaded',
          priority: 'low',
          title,
          message,
          recipientId: client.userAccountId,
          firmId: client.firmId,
          relatedEntity: {
            entityType: 'Document',
            entityId: documents[0]._id
          },
          metadata: {
            documentCount: count,
            clientName: client.companyName,
            clientId: client._id,
            uploadedBy: uploadedBy.name,
            category: documents[0].category,
            source: 'conversation'
          },
          actionUrl: CLIENT_PORTAL_ROUTES.CONVERSATIONS,
          actionLabel: 'View Conversations'
        });
      } else if (uploadedBy.role === 'Client') {
        // Client uploaded in conversation, notify CA-Admin
        const message = count === 1 
          ? `${client.companyName} uploaded ${documents[0].fileName} in conversation`
          : `${client.companyName} uploaded ${count} documents in conversation`;
        
        return this.createFirmNotification(client.firmId, {
          type: 'document',
          subtype: count === 1 ? 'document_uploaded' : 'bulk_documents_uploaded',
          priority: 'low',
          title,
          message,
          relatedEntity: {
            entityType: 'Document',
            entityId: documents[0]._id
          },
          metadata: {
            documentCount: count,
            clientName: client.companyName,
            clientId: client._id,
            uploadedBy: uploadedBy.name,
            category: documents[0].category,
            source: 'conversation'
          },
          actionUrl: CA_ADMIN_ROUTES.CONVERSATIONS,
          actionLabel: 'View Conversations'
        });
      }
    } else {
      // Regular document upload (non-conversation) - only CA-Admin can upload
      // No notification needed as it's an internal CA operation
      return null;
    }
    
    return null;
  }

  /**
   * Notify when client accesses a document (only notifies CA-Admin when Client accesses)
   */
  async notifyDocumentAccessed(document, client, accessedBy) {
    // Only notify if accessed by Client
    if (accessedBy.role !== 'Client') return null;
    
    return this.createFirmNotification(document.firmId, {
      type: 'document',
      subtype: 'document_accessed',
      priority: 'low',
      title: 'Document Accessed',
      message: `${client.companyName} accessed ${document.fileName}`,
      relatedEntity: {
        entityType: 'Document',
        entityId: document._id
      },
      metadata: {
        documentName: document.fileName,
        clientName: client.companyName,
        clientId: client._id,
        accessedAt: new Date()
      },
      actionUrl: CA_ADMIN_ROUTES.DOCUMENTS,
      actionLabel: 'View Document'
    });
  }

  // ==================== THREAD NOTIFICATIONS ====================

  /**
   * Notify when new thread is created (bidirectional - notifies opposite party)
   * When CA-Admin creates, notify Client
   * When Client creates, notify CA-Admin
   */
  async notifyThreadCreated(thread, client, initiatedBy) {
    if (initiatedBy.role === 'CA-Admin') {
      // CA-Admin created, notify Client
      if (!client.userAccountId) return null;
      
      return this.createNotification({
        type: 'thread',
        subtype: 'thread_created',
        priority: 'normal',
        title: 'New Conversation',
        message: `Your CA started a new conversation: ${thread.subject}`,
        recipientId: client.userAccountId,
        firmId: thread.firmId,
        relatedEntity: {
          entityType: 'Thread',
          entityId: thread._id
        },
        metadata: {
          threadNumber: thread.threadNumber,
          subject: thread.subject,
          serviceType: thread.serviceType,
          clientName: client.companyName,
          clientId: client._id,
          initiatedBy: initiatedBy.role
        },
        actionUrl: buildClientConversationPath(thread._id),
        actionLabel: 'View Conversation'
      });
    } else if (initiatedBy.role === 'Client') {
      // Client created, notify CA-Admin
      return this.createFirmNotification(thread.firmId, {
        type: 'thread',
        subtype: 'thread_created',
        priority: 'normal',
        title: 'New Conversation',
        message: `${client.companyName} started a new conversation: ${thread.subject}`,
        relatedEntity: {
          entityType: 'Thread',
          entityId: thread._id
        },
        metadata: {
          threadNumber: thread.threadNumber,
          subject: thread.subject,
          serviceType: thread.serviceType,
          clientName: client.companyName,
          clientId: client._id,
          initiatedBy: initiatedBy.role
        },
        actionUrl: buildCaAdminConversationPath(thread._id),
        actionLabel: 'View Conversation'
      });
    }
    
    return null;
  }

  /**
   * Notify when message is received in thread (bidirectional - notifies opposite party)
   * When CA-Admin sends, notify Client
   * When Client sends, notify CA-Admin
   */
  async notifyThreadMessageReceived(thread, message, client, sender) {
    if (sender.role === 'CA-Admin') {
      // CA-Admin sent message, notify Client
      if (!client.userAccountId) return null;
      
      return this.createNotification({
        type: 'thread',
        subtype: 'thread_message_received',
        priority: 'normal',
        title: 'New Message',
        message: `Your CA sent a message in "${thread.subject}"`,
        recipientId: client.userAccountId,
        firmId: thread.firmId,
        relatedEntity: {
          entityType: 'Thread',
          entityId: thread._id
        },
        metadata: {
          threadNumber: thread.threadNumber,
          subject: thread.subject,
          clientName: client.companyName,
          clientId: client._id,
          messagePreview: message.content ? message.content.substring(0, 100) : '',
          hasAttachments: (message.attachments?.length > 0) || (message.inlineFiles?.length > 0)
        },
        actionUrl: buildClientConversationPath(thread._id),
        actionLabel: 'View Message'
      });
    } else if (sender.role === 'Client') {
      // Client sent message, notify CA-Admin
      return this.createFirmNotification(thread.firmId, {
        type: 'thread',
        subtype: 'thread_message_received',
        priority: 'normal',
        title: 'New Message',
        message: `${client.companyName} sent a message in "${thread.subject}"`,
        relatedEntity: {
          entityType: 'Thread',
          entityId: thread._id
        },
        metadata: {
          threadNumber: thread.threadNumber,
          subject: thread.subject,
          clientName: client.companyName,
          clientId: client._id,
          messagePreview: message.content ? message.content.substring(0, 100) : '',
          hasAttachments: (message.attachments?.length > 0) || (message.inlineFiles?.length > 0)
        },
        actionUrl: buildCaAdminConversationPath(thread._id),
        actionLabel: 'View Message'
      });
    }
    
    return null;
  }

  /**
   * Notify when thread is resolved (only notifies Client)
   */
  async notifyThreadResolved(thread, client, resolvedBy) {
    // Only notify the Client
    if (!client.userAccountId) return null;
    
    return this.createNotification({
      type: 'thread',
      subtype: 'thread_resolved',
      priority: 'low',
      title: 'Conversation Resolved',
      message: `"${thread.subject}" has been resolved`,
      recipientId: client.userAccountId,
      firmId: thread.firmId,
      relatedEntity: {
        entityType: 'Thread',
        entityId: thread._id
      },
      metadata: {
        threadNumber: thread.threadNumber,
        subject: thread.subject,
        clientName: client.companyName,
        clientId: client._id,
        resolvedBy: resolvedBy.name
      },
      actionUrl: buildClientConversationPath(thread._id),
      actionLabel: 'View Conversation'
    });
  }

  // ==================== SYSTEM NOTIFICATIONS ====================

  /**
   * Create system alert
   */
  async createSystemAlert(firmId, recipientId, title, message, metadata = {}) {
    return this.createNotification({
      type: 'system',
      subtype: 'system_alert',
      priority: 'normal',
      title,
      message,
      recipientId,
      firmId,
      metadata
    });
  }

  /**
   * Create system warning
   */
  async createSystemWarning(firmId, recipientId, title, message, metadata = {}) {
    return this.createNotification({
      type: 'system',
      subtype: 'system_warning',
      priority: 'high',
      title,
      message,
      recipientId,
      firmId,
      metadata
    });
  }

  /**
   * Create system error
   */
  async createSystemError(firmId, recipientId, title, message, metadata = {}) {
    return this.createNotification({
      type: 'system',
      subtype: 'system_error',
      priority: 'urgent',
      title,
      message,
      recipientId,
      firmId,
      metadata
    });
  }
}

module.exports = new NotificationService();

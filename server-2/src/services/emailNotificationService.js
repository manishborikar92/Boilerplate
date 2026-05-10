/**
 * Email Notification Service
 * Sends email notifications for urgent, high, and normal priority notifications
 * Integrates with the notification system and email templates
 */

const emailService = require('./emailService');
const User = require('../models/User');
const { logger } = require('../middleware/logger');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');
const { isClientPortalActionUrl } = require('../constants/frontendRoutes');
const {
  paymentNotificationTemplate,
  threadNotificationTemplate,
  documentNotificationTemplate,
  subscriptionNotificationTemplate,
  loginNotificationTemplate
} = require('../templates/email/notificationEmail');

const frontendOrigin = getPrimaryFrontendOrigin();

class EmailNotificationService {
  /**
   * Check if email should be sent based on priority
   * @param {string} priority - Notification priority
   * @returns {boolean}
   */
  shouldSendEmail(priority) {
    return ['urgent', 'high', 'normal'].includes(priority);
  }

  /**
   * Get user email and name
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} User email and name
   */
  async getUserEmailInfo(userId) {
    try {
      const user = await User.findById(userId).select('email name');
      if (!user) {
        logger.warn('User not found for email notification', { userId });
        return null;
      }
      return {
        email: user.email,
        name: user.name || 'User'
      };
    } catch (error) {
      logger.error('Failed to get user email info', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Send email notification (non-blocking)
   * @param {string} email - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - Email HTML content
   */
  async sendEmailAsync(email, subject, html) {
    try {
      await emailService.sendEmail(email, subject, html);
      logger.info('Email notification sent', { email, subject });
    } catch (error) {
      logger.error('Failed to send email notification', {
        error: error.message,
        email,
        subject
      });
      // Don't throw - email failures should not break notification creation
    }
  }

  /**
   * Send payment notification email
   * @param {Object} notification - Notification object
   * @param {Object} userInfo - User email and name
   */
  async sendPaymentNotification(notification, userInfo) {
    if (!this.shouldSendEmail(notification.priority)) return;

    const { amount, amountInRupees, clientName } = notification.metadata;
    const status = notification.subtype.includes('received') ? 'received' : 'failed';
    
    const actionUrl = `${frontendOrigin}${notification.actionUrl}`;
    
    const html = paymentNotificationTemplate({
      recipientName: userInfo.name,
      amount: amountInRupees,
      clientName,
      status,
      actionUrl,
      priority: notification.priority
    });

    const subject = `${notification.priority === 'urgent' ? '🚨 ' : notification.priority === 'high' ? '⚠️ ' : ''}${notification.title} - CA-Workflow`;
    
    await this.sendEmailAsync(userInfo.email, subject, html);
  }

  /**
   * Send thread/conversation notification email
   * @param {Object} notification - Notification object
   * @param {Object} userInfo - User email and name
   */
  async sendThreadNotification(notification, userInfo) {
    if (!this.shouldSendEmail(notification.priority)) return;

    const { subject, clientName, messagePreview } = notification.metadata;
    const senderRole = notification.subtype.includes('created') || notification.subtype.includes('message') 
      ? (isClientPortalActionUrl(notification.actionUrl) ? 'CA-Admin' : 'Client')
      : 'CA-Admin';
    
    let notificationType = 'message';
    let message = notification.message;
    
    if (notification.subtype === 'thread_created') {
      notificationType = 'created';
    } else if (notification.subtype === 'thread_resolved') {
      notificationType = 'resolved';
    }
    
    const actionUrl = `${frontendOrigin}${notification.actionUrl}`;
    
    const html = threadNotificationTemplate({
      recipientName: userInfo.name,
      subject,
      message,
      senderName: clientName || 'Client',
      senderRole,
      actionUrl,
      priority: notification.priority,
      notificationType
    });

    const emailSubject = `${notification.priority === 'urgent' ? '🚨 ' : notification.priority === 'high' ? '⚠️ ' : ''}${notification.title} - CA-Workflow`;
    
    await this.sendEmailAsync(userInfo.email, emailSubject, html);
  }

  /**
   * Send document notification email
   * @param {Object} notification - Notification object
   * @param {Object} userInfo - User email and name
   */
  async sendDocumentNotification(notification, userInfo) {
    if (!this.shouldSendEmail(notification.priority)) return;

    const { documentCount, clientName, uploadedBy } = notification.metadata;
    const uploaderRole = isClientPortalActionUrl(notification.actionUrl) ? 'CA-Admin' : 'Client';
    
    const actionUrl = `${frontendOrigin}${notification.actionUrl}`;
    
    const html = documentNotificationTemplate({
      recipientName: userInfo.name,
      documentName: notification.message.split(' uploaded ')[1]?.split(' in')[0] || 'document',
      documentCount: documentCount || 1,
      uploaderName: clientName || uploadedBy || 'User',
      uploaderRole,
      actionUrl,
      priority: notification.priority
    });

    const subject = `${notification.priority === 'urgent' ? '🚨 ' : notification.priority === 'high' ? '⚠️ ' : ''}${notification.title} - CA-Workflow`;
    
    await this.sendEmailAsync(userInfo.email, subject, html);
  }

  /**
   * Send subscription notification email
   * @param {Object} notification - Notification object
   * @param {Object} userInfo - User email and name
   */
  async sendSubscriptionNotification(notification, userInfo) {
    if (!this.shouldSendEmail(notification.priority)) return;

    const { planName, amount, billingPeriod, nextBillingDate } = notification.metadata;
    
    let status = 'activated';
    if (notification.subtype === 'subscription_payment_failed') {
      status = 'failed';
    } else if (notification.subtype === 'subscription_cancelled') {
      status = 'cancelled';
    }
    
    const actionUrl = `${frontendOrigin}${notification.actionUrl}`;
    
    const html = subscriptionNotificationTemplate({
      recipientName: userInfo.name,
      planName,
      status,
      amount: amount ? (amount / 100).toFixed(2) : null,
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : null,
      actionUrl,
      priority: notification.priority
    });

    const subject = `${notification.priority === 'urgent' ? '🚨 ' : notification.priority === 'high' ? '⚠️ ' : ''}${notification.title} - CA-Workflow`;
    
    await this.sendEmailAsync(userInfo.email, subject, html);
  }

  /**
   * Send login notification email
   * @param {Object} notification - Notification object
   * @param {Object} userInfo - User email and name
   */
  async sendLoginNotification(notification, userInfo) {
    if (!this.shouldSendEmail(notification.priority)) return;

    const { clientName, loginTime } = notification.metadata;
    const isFirstLogin = notification.subtype === 'client_first_login';
    
    const actionUrl = `${frontendOrigin}${notification.actionUrl}`;
    
    const html = loginNotificationTemplate({
      recipientName: userInfo.name,
      clientName,
      isFirstLogin,
      loginTime: new Date(loginTime).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      actionUrl,
      priority: notification.priority
    });

    const subject = `${notification.priority === 'urgent' ? '🚨 ' : notification.priority === 'high' ? '⚠️ ' : ''}${notification.title} - CA-Workflow`;
    
    await this.sendEmailAsync(userInfo.email, subject, html);
  }

  /**
   * Send email notification based on notification type
   * @param {Object} notification - Notification object
   */
  async sendNotificationEmail(notification) {
    try {
      // Check if email should be sent
      if (!this.shouldSendEmail(notification.priority)) {
        logger.debug('Skipping email for low priority notification', {
          notificationId: notification._id,
          priority: notification.priority
        });
        return;
      }

      // Get user email info
      const userInfo = await this.getUserEmailInfo(notification.recipientId);
      if (!userInfo) {
        logger.warn('Cannot send email - user info not found', {
          notificationId: notification._id,
          recipientId: notification.recipientId
        });
        return;
      }

      // Send email based on notification type
      switch (notification.type) {
        case 'payment':
          await this.sendPaymentNotification(notification, userInfo);
          break;
        
        case 'thread':
          await this.sendThreadNotification(notification, userInfo);
          break;
        
        case 'document':
          await this.sendDocumentNotification(notification, userInfo);
          break;
        
        case 'subscription':
          await this.sendSubscriptionNotification(notification, userInfo);
          break;
        
        case 'login':
          await this.sendLoginNotification(notification, userInfo);
          break;
        
        default:
          logger.warn('Unknown notification type for email', {
            notificationId: notification._id,
            type: notification.type
          });
      }
    } catch (error) {
      logger.error('Failed to send notification email', {
        error: error.message,
        notificationId: notification._id,
        type: notification.type
      });
      // Don't throw - email failures should not break notification creation
    }
  }

  /**
   * Send batch email notifications
   * @param {Array} notifications - Array of notification objects
   */
  async sendBatchNotificationEmails(notifications) {
    const promises = notifications.map(notification => 
      this.sendNotificationEmail(notification)
    );
    
    await Promise.allSettled(promises);
  }
}

module.exports = new EmailNotificationService();

/**
 * WhatsApp Notification Service
 * Sends WhatsApp notifications for urgent, high, and normal priority notifications
 * Respects firm preferences and subscription limits
 */

const twilioService = require('./twilioService');
const subscriptionService = require('./subscriptionService');
const User = require('../models/User');
const Firm = require('../models/Firm');
const { logger } = require('../middleware/logger');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');

const frontendOrigin = getPrimaryFrontendOrigin();

class WhatsAppNotificationService {
  /**
   * Check if WhatsApp should be sent based on priority
   * @param {string} priority - Notification priority
   * @returns {boolean}
   */
  shouldSendWhatsApp(priority) {
    return ['urgent', 'high', 'normal'].includes(priority);
  }

  /**
   * Check if firm has WhatsApp enabled and subscription allows it
   * @param {ObjectId} firmId - Firm ID
   * @returns {Promise<boolean>}
   */
  async canSendWhatsApp(firmId) {
    try {
      const firm = await Firm.findById(firmId).select('whatsappNotification subscription');
      
      if (!firm) {
        logger.warn('Firm not found for WhatsApp check', { firmId });
        return false;
      }

      // Check if firm has WhatsApp notifications enabled
      if (!firm.whatsappNotification) {
        logger.debug('WhatsApp notifications disabled for firm', { firmId });
        return false;
      }

      // Check if subscription plan allows WhatsApp
      const allowed = await subscriptionService.isNotificationChannelAllowed(firmId, 'whatsapp');
      
      if (!allowed) {
        logger.debug('WhatsApp not allowed by subscription plan', { firmId });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking WhatsApp permission', { error: error.message, firmId });
      return false;
    }
  }

  /**
   * Get user phone number
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} User phone and name
   */
  async getUserPhoneInfo(userId) {
    try {
      const user = await User.findById(userId).select('phoneNumber name');
      if (!user || !user.phoneNumber) {
        logger.warn('User phone number not found', { userId });
        return null;
      }
      return {
        phoneNumber: user.phoneNumber,
        name: user.name || 'User'
      };
    } catch (error) {
      logger.error('Failed to get user phone info', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Format WhatsApp message (can be more detailed than SMS)
   * @param {Object} notification - Notification object
   * @param {string} userName - User name
   * @returns {string} Formatted WhatsApp message
   */
  formatWhatsAppMessage(notification, userName) {
    const priorityEmoji = notification.priority === 'urgent' ? '🚨' : 
                         notification.priority === 'high' ? '⚠️' : 
                         notification.priority === 'normal' ? 'ℹ️' : '📌';
    
    let message = `${priorityEmoji} *${notification.title}*\n\n`;
    message += `Hello ${userName},\n\n`;
    message += `${notification.message}\n\n`;
    
    // Add metadata based on notification type
    if (notification.metadata) {
      if (notification.type === 'payment' && notification.metadata.amountInRupees) {
        message += `💰 Amount: ₹${notification.metadata.amountInRupees}\n`;
      }
      
      if (notification.metadata.clientName) {
        message += `👤 Client: ${notification.metadata.clientName}\n`;
      }
      
      if (notification.metadata.subject) {
        message += `📋 Subject: ${notification.metadata.subject}\n`;
      }
    }
    
    // Add action button/link
    if (notification.actionUrl && notification.actionLabel) {
      const fullUrl = `${frontendOrigin}${notification.actionUrl}`;
      message += `\n🔗 ${notification.actionLabel}: ${fullUrl}\n`;
    }
    
    // Add timestamp
    const timestamp = new Date(notification.createdAt).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    message += `\n⏰ ${timestamp}`;
    
    // Add app signature
    message += `\n\n_Sent via CA-Workflow_`;
    
    return message;
  }

  /**
   * Send WhatsApp notification (non-blocking)
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - WhatsApp message content
   */
  async sendWhatsAppAsync(phoneNumber, message) {
    try {
      const result = await twilioService.sendWhatsApp(phoneNumber, message);
      
      if (result.success) {
        logger.info('WhatsApp notification sent', { phoneNumber, messageId: result.messageId });
      } else {
        logger.error('Failed to send WhatsApp notification', {
          phoneNumber,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Failed to send WhatsApp notification', {
        error: error.message,
        phoneNumber
      });
      // Don't throw - WhatsApp failures should not break notification creation
    }
  }

  async sendWhatsAppTemplateAsync(phoneNumber, contentSid, variables) {
    try {
      const result = await twilioService.sendWhatsAppTemplate(phoneNumber, contentSid, variables);

      if (result.success) {
        logger.info('WhatsApp template notification sent', { phoneNumber, messageId: result.messageId });
      } else {
        logger.error('Failed to send WhatsApp template notification', {
          phoneNumber,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Failed to send WhatsApp template notification', {
        error: error.message,
        phoneNumber
      });
    }
  }

  /**
   * Send WhatsApp notification based on notification object
   * @param {Object} notification - Notification object
   */
  async sendNotificationWhatsApp(notification) {
    try {
      // Check if WhatsApp should be sent based on priority
      if (!this.shouldSendWhatsApp(notification.priority)) {
        logger.debug('Skipping WhatsApp for low priority notification', {
          notificationId: notification._id,
          priority: notification.priority
        });
        return;
      }

      // Check if firm allows WhatsApp notifications
      const canSend = await this.canSendWhatsApp(notification.firmId);
      if (!canSend) {
        logger.debug('WhatsApp not allowed for firm', {
          notificationId: notification._id,
          firmId: notification.firmId
        });
        return;
      }

      // Get user phone info
      const userInfo = await this.getUserPhoneInfo(notification.recipientId);
      if (!userInfo) {
        logger.warn('Cannot send WhatsApp - user phone not found', {
          notificationId: notification._id,
          recipientId: notification.recipientId
        });
        return;
      }

      const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_NOTIFICATION_SID;

      if (templateSid) {
        const fullUrl = notification.actionUrl
          ? `${frontendOrigin}${notification.actionUrl}`
          : frontendOrigin;

        const variables = {
          1: userInfo.name,
          2: notification.title,
          3: notification.message,
          4: notification.actionLabel || 'Open',
          5: fullUrl
        };

        await this.sendWhatsAppTemplateAsync(userInfo.phoneNumber, templateSid, variables);
      } else {
        const message = this.formatWhatsAppMessage(notification, userInfo.name);
        await this.sendWhatsAppAsync(userInfo.phoneNumber, message);
      }
      
    } catch (error) {
      logger.error('Failed to send notification WhatsApp', {
        error: error.message,
        notificationId: notification._id,
        type: notification.type
      });
      // Don't throw - WhatsApp failures should not break notification creation
    }
  }

  /**
   * Send batch WhatsApp notifications
   * @param {Array} notifications - Array of notification objects
   */
  async sendBatchNotificationWhatsApp(notifications) {
    const promises = notifications.map(notification => 
      this.sendNotificationWhatsApp(notification)
    );
    
    await Promise.allSettled(promises);
  }
}

module.exports = new WhatsAppNotificationService();

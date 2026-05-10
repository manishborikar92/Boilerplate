/**
 * SMS Notification Service
 * Sends SMS notifications for urgent, high, and normal priority notifications
 * Respects firm preferences and subscription limits
 */

const twilioService = require('./twilioService');
const subscriptionService = require('./subscriptionService');
const User = require('../models/User');
const Firm = require('../models/Firm');
const { logger } = require('../middleware/logger');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');

const frontendOrigin = getPrimaryFrontendOrigin();

class SmsNotificationService {
  /**
   * Check if SMS should be sent based on priority
   * @param {string} priority - Notification priority
   * @returns {boolean}
   */
  shouldSendSMS(priority) {
    return ['urgent', 'high', 'normal'].includes(priority);
  }

  /**
   * Check if firm has SMS enabled and subscription allows it
   * @param {ObjectId} firmId - Firm ID
   * @returns {Promise<boolean>}
   */
  async canSendSMS(firmId) {
    try {
      const firm = await Firm.findById(firmId).select('smsNotification subscription');
      
      if (!firm) {
        logger.warn('Firm not found for SMS check', { firmId });
        return false;
      }

      // Check if firm has SMS notifications enabled
      if (!firm.smsNotification) {
        logger.debug('SMS notifications disabled for firm', { firmId });
        return false;
      }

      // Check if subscription plan allows SMS
      const allowed = await subscriptionService.isNotificationChannelAllowed(firmId, 'sms');
      
      if (!allowed) {
        logger.debug('SMS not allowed by subscription plan', { firmId });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking SMS permission', { error: error.message, firmId });
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
   * Format SMS message (keep it concise for SMS)
   * @param {Object} notification - Notification object
   * @returns {string} Formatted SMS message
   */
  formatSMSMessage(notification) {
    const priorityPrefix = notification.priority === 'urgent' ? '🚨 ' : 
                          notification.priority === 'high' ? '⚠️ ' : '';
    
    // SMS should be concise (160 characters recommended)
    let message = `${priorityPrefix}${notification.title}\n\n${notification.message}`;
    
    // Add action URL if available
    if (notification.actionUrl) {
      const fullUrl = `${frontendOrigin}${notification.actionUrl}`;
      message += `\n\nView: ${fullUrl}`;
    }
    
    // Add app signature
    message += `\n\n- CA-Workflow`;
    
    return message;
  }

  /**
   * Send SMS notification (non-blocking)
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - SMS message content
   */
  async sendSMSAsync(phoneNumber, message) {
    try {
      const result = await twilioService.sendSMS(phoneNumber, message);
      
      if (result.success) {
        logger.info('SMS notification sent', { phoneNumber, messageId: result.messageId });
      } else {
        logger.error('Failed to send SMS notification', {
          phoneNumber,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Failed to send SMS notification', {
        error: error.message,
        phoneNumber
      });
      // Don't throw - SMS failures should not break notification creation
    }
  }

  /**
   * Send SMS notification based on notification object
   * @param {Object} notification - Notification object
   */
  async sendNotificationSMS(notification) {
    try {
      // Check if SMS should be sent based on priority
      if (!this.shouldSendSMS(notification.priority)) {
        logger.debug('Skipping SMS for low priority notification', {
          notificationId: notification._id,
          priority: notification.priority
        });
        return;
      }

      // Check if firm allows SMS notifications
      const canSend = await this.canSendSMS(notification.firmId);
      if (!canSend) {
        logger.debug('SMS not allowed for firm', {
          notificationId: notification._id,
          firmId: notification.firmId
        });
        return;
      }

      // Get user phone info
      const userInfo = await this.getUserPhoneInfo(notification.recipientId);
      if (!userInfo) {
        logger.warn('Cannot send SMS - user phone not found', {
          notificationId: notification._id,
          recipientId: notification.recipientId
        });
        return;
      }

      // Format and send SMS
      const message = this.formatSMSMessage(notification);
      await this.sendSMSAsync(userInfo.phoneNumber, message);
      
    } catch (error) {
      logger.error('Failed to send notification SMS', {
        error: error.message,
        notificationId: notification._id,
        type: notification.type
      });
      // Don't throw - SMS failures should not break notification creation
    }
  }

  /**
   * Send batch SMS notifications
   * @param {Array} notifications - Array of notification objects
   */
  async sendBatchNotificationSMS(notifications) {
    const promises = notifications.map(notification => 
      this.sendNotificationSMS(notification)
    );
    
    await Promise.allSettled(promises);
  }
}

module.exports = new SmsNotificationService();

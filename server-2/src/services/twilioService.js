/**
 * Twilio Service for CA-Workflow
 * Handles SMS and WhatsApp messaging via Twilio
 */

const twilioConfig = require('../config/twilio');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');
const phoneNumberUtil = require('../utils/phoneNumber');
const { logger } = require('../middleware/logger');

class TwilioService {
  constructor() {
    this.client = null;
    this.config = {
      smsNumber: twilioConfig.getSmsNumber(),
      messagingServiceSid: twilioConfig.getMessagingServiceSid(),
      whatsappNumber: twilioConfig.getWhatsAppNumber(),
      clientUrl: getPrimaryFrontendOrigin(),
      appName: 'CA-Workflow'
    };
  }

  /**
   * Get Twilio client
   * @returns {Object|null} Twilio client or null if not configured
   */
  getClient() {
    if (this.client) {
      return this.client;
    }

    this.client = twilioConfig.getClient();
    return this.client;
  }

  /**
   * Format phone number to E.164 format using phoneNumberUtil
   * @param {string} phoneNumber - Phone number to format
   * @returns {string|null} Formatted phone number in E.164 format or null if invalid
   */
  formatPhoneNumber(phoneNumber) {
    return phoneNumberUtil.normalizePhoneNumber(phoneNumber);
  }

  /**
   * Send SMS message
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS message content
   * @returns {Promise<Object>} Twilio message response
   */
  async sendSMS(to, message) {
    const client = this.getClient();
    
    if (!client) {
      logger.warn('Twilio not configured, skipping SMS', { to });
      return { success: false, error: 'Twilio not configured' };
    }

    if (!this.config.smsNumber && !this.config.messagingServiceSid) {
      logger.warn('Twilio SMS number not configured', { to });
      return { success: false, error: 'SMS number not configured' };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      if (!formattedNumber) {
        throw new Error('Invalid phone number format');
      }

      const createOptions = {
        body: message,
        to: formattedNumber
      };

      if (this.config.messagingServiceSid) {
        createOptions.messagingServiceSid = this.config.messagingServiceSid;
      } else {
        createOptions.from = this.config.smsNumber;
      }

      const response = await client.messages.create(createOptions);

      logger.info('SMS sent successfully', {
        to: formattedNumber,
        sid: response.sid,
        status: response.status
      });

      return {
        success: true,
        messageId: response.sid,
        status: response.status
      };
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error.message,
        to,
        code: error.code
      });

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send WhatsApp message
   * @param {string} to - Recipient phone number
   * @param {string} message - WhatsApp message content
   * @returns {Promise<Object>} Twilio message response
   */
  async sendWhatsApp(to, message) {
    const client = this.getClient();
    
    if (!client) {
      logger.warn('Twilio not configured, skipping WhatsApp', { to });
      return { success: false, error: 'Twilio not configured' };
    }

    if (!this.config.whatsappNumber) {
      logger.warn('Twilio WhatsApp number not configured', { to });
      return { success: false, error: 'WhatsApp number not configured' };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      if (!formattedNumber) {
        throw new Error('Invalid phone number format');
      }

      const fromAddress = this.config.whatsappNumber.startsWith('whatsapp:')
        ? this.config.whatsappNumber
        : `whatsapp:${this.config.whatsappNumber}`;

      const response = await client.messages.create({
        body: message,
        from: fromAddress,
        to: `whatsapp:${formattedNumber}`
      });

      logger.info('WhatsApp message sent successfully', {
        to: formattedNumber,
        sid: response.sid,
        status: response.status
      });

      return {
        success: true,
        messageId: response.sid,
        status: response.status
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        error: error.message,
        to,
        code: error.code
      });

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendWhatsAppTemplate(to, contentSid, variables = {}) {
    const client = this.getClient();

    if (!client) {
      logger.warn('Twilio not configured, skipping WhatsApp template', { to });
      return { success: false, error: 'Twilio not configured' };
    }

    if (!this.config.whatsappNumber) {
      logger.warn('Twilio WhatsApp number not configured', { to });
      return { success: false, error: 'WhatsApp number not configured' };
    }

    if (!contentSid) {
      logger.warn('WhatsApp template SID not configured', { to });
      return { success: false, error: 'WhatsApp template not configured' };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);

      if (!formattedNumber) {
        throw new Error('Invalid phone number format');
      }

      const fromAddress = this.config.whatsappNumber.startsWith('whatsapp:')
        ? this.config.whatsappNumber
        : `whatsapp:${this.config.whatsappNumber}`;

      const sanitizedVariables = {};
      if (variables && typeof variables === 'object') {
        for (const [key, value] of Object.entries(variables)) {
          if (value === undefined || value === null) continue;
          sanitizedVariables[key] = String(value).replace(/\r?\n/g, ' ').trim();
        }
      }

      const response = await client.messages.create({
        from: fromAddress,
        to: `whatsapp:${formattedNumber}`,
        contentSid,
        contentVariables: JSON.stringify(sanitizedVariables)
      });

      logger.info('WhatsApp template message sent successfully', {
        to: formattedNumber,
        sid: response.sid,
        status: response.status
      });

      return {
        success: true,
        messageId: response.sid,
        status: response.status
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp template message', {
        error: error.message,
        to,
        code: error.code
      });

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Test SMS configuration
   * @param {string} testNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async testSMS(testNumber) {
    try {
      const message = `Test SMS from ${this.config.appName}. Your SMS notifications are working correctly!`;
      const result = await this.sendSMS(testNumber, message);
      
      if (result.success) {
        console.log('📱 Test SMS sent successfully!');
        console.log(`📱 Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('📱 Test SMS failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('📱 Error sending test SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test WhatsApp configuration
   * @param {string} testNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async testWhatsApp(testNumber) {
    try {
      const message = `Test WhatsApp message from ${this.config.appName}. Your WhatsApp notifications are working correctly!`;
      const result = await this.sendWhatsApp(testNumber, message);
      
      if (result.success) {
        console.log('💬 Test WhatsApp message sent successfully!');
        console.log(`💬 Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('💬 Test WhatsApp failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('💬 Error sending test WhatsApp:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const twilioService = new TwilioService();

module.exports = twilioService;

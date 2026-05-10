/**
 * Twilio Configuration
 * Setup for SMS and WhatsApp messaging
 */

const twilio = require('twilio');

class TwilioConfig {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    this.client = null;
  }

  /**
   * Initialize Twilio client
   * @returns {Object} Twilio client instance
   */
  getClient() {
    if (this.client) {
      return this.client;
    }

    if (!this.accountSid || !this.authToken) {
      console.warn('⚠️ Twilio credentials not configured. SMS/WhatsApp notifications will be disabled.');
      return null;
    }

    try {
      this.client = twilio(this.accountSid, this.authToken);
      console.log('✅ Twilio client initialized successfully');
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize Twilio client:', error.message);
      return null;
    }
  }

  /**
   * Check if Twilio is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.accountSid && this.authToken && (this.phoneNumber || this.messagingServiceSid));
  }

  /**
   * Check if WhatsApp is configured
   * @returns {boolean}
   */
  isWhatsAppConfigured() {
    return !!(this.accountSid && this.authToken && this.whatsappNumber);
  }

  /**
   * Get SMS sender number
   * @returns {string}
   */
  getSmsNumber() {
    return this.phoneNumber;
  }

  getMessagingServiceSid() {
    return this.messagingServiceSid;
  }

  /**
   * Get WhatsApp sender number
   * @returns {string}
   */
  getWhatsAppNumber() {
    return this.whatsappNumber;
  }
}

// Create and export singleton instance
const twilioConfig = new TwilioConfig();

module.exports = twilioConfig;

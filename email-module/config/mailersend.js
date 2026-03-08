/**
 * MailerSend Configuration
 *
 * Prerequisites:
 *   1. npm install mailersend
 *   2. Get API token from https://app.mailersend.com/api-tokens
 *   3. Verify sending domain at https://app.mailersend.com/domains
 *
 * Environment variables:
 *   MAILERSEND_API_KEY   - MailerSend API key
 *   MAILERSEND_FROM      - Verified sender email
 *   MAILERSEND_FROM_NAME - Sender display name (default: "MyApp")
 *
 * @module config/mailersend
 */

class MailerSendConfig {
    constructor() {
        this.apiKey = process.env.MAILERSEND_API_KEY;
        this.from = process.env.MAILERSEND_FROM || process.env.EMAIL_FROM;
        this.fromName = process.env.MAILERSEND_FROM_NAME || 'MyApp';
        this.client = null;
    }

    /**
     * Lazily initialize and return the MailerSend client.
     * @returns {Object|null}
     */
    getClient() {
        if (this.client) return this.client;
        if (!this.apiKey) {
            console.warn('⚠️ MailerSend API key not configured. MailerSend email will be disabled.');
            return null;
        }

        try {
            const { MailerSend } = require('mailersend');
            this.client = new MailerSend({ apiKey: this.apiKey });
            console.log('✅ MailerSend client initialized');
            return this.client;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.error('❌ MailerSend SDK not installed. Run: npm install mailersend');
                return null;
            }
            console.error('❌ Failed to initialize MailerSend client:', error.message);
            return null;
        }
    }

    isConfigured() {
        return !!(this.apiKey && this.from);
    }

    getFrom() {
        return this.from;
    }

    getFromName() {
        return this.fromName;
    }
}

module.exports = new MailerSendConfig();

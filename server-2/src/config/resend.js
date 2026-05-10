/**
 * Resend Configuration
 * Setup for transactional email via Resend API
 * 
 * Prerequisites:
 *  1. npm install resend
 *  2. Create API key at https://resend.com/api-keys
 *  3. Verify sending domain at https://resend.com/domains
 */

class ResendConfig {
    constructor() {
        this.apiKey = process.env.RESEND_API_KEY;
        this.from = process.env.RESEND_FROM || process.env.EMAIL_FROM;
        this.client = null;
    }

    /**
     * Initialize Resend client
     * @returns {Object|null} Resend client instance
     */
    getClient() {
        if (this.client) {
            return this.client;
        }

        if (!this.apiKey) {
            console.warn('⚠️ Resend API key not configured. Resend email will be disabled.');
            return null;
        }

        try {
            const { Resend } = require('resend');
            this.client = new Resend(this.apiKey);
            console.log('✅ Resend client initialized successfully');
            return this.client;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.error('❌ Resend SDK not installed. Run: npm install resend');
                return null;
            }
            console.error('❌ Failed to initialize Resend client:', error.message);
            return null;
        }
    }

    /**
     * Check if Resend is configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.apiKey && this.from);
    }

    /**
     * Get default sender address
     * @returns {string}
     */
    getFrom() {
        return this.from;
    }
}

// Create and export singleton instance
const resendConfig = new ResendConfig();

module.exports = resendConfig;

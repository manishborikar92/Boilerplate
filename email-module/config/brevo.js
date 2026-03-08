/**
 * Brevo Configuration (formerly Sendinblue)
 *
 * Prerequisites:
 *   1. npm install @getbrevo/brevo
 *   2. Get API key from https://app.brevo.com/settings/keys/api
 *   3. Register & verify sender at https://app.brevo.com/senders
 *
 * Environment variables:
 *   BREVO_API_KEY   - Brevo API key
 *   BREVO_FROM      - Verified sender email
 *   BREVO_FROM_NAME - Sender display name (default: "MyApp")
 *
 * @module config/brevo
 */

class BrevoConfig {
    constructor() {
        this.apiKey = process.env.BREVO_API_KEY;
        this.from = process.env.BREVO_FROM || process.env.EMAIL_FROM;
        this.fromName = process.env.BREVO_FROM_NAME || 'MyApp';
        this.transactionalApi = null;
    }

    /**
     * Lazily initialize and return the Brevo TransactionalEmailsApi.
     * @returns {Object|null}
     */
    getClient() {
        if (this.transactionalApi) return this.transactionalApi;
        if (!this.apiKey) {
            console.warn('⚠️ Brevo API key not configured. Brevo email will be disabled.');
            return null;
        }

        try {
            const brevo = require('@getbrevo/brevo');
            const apiClient = brevo.ApiClient.instance;
            apiClient.authentications['api-key'].apiKey = this.apiKey;
            this.transactionalApi = new brevo.TransactionalEmailsApi();
            console.log('✅ Brevo client initialized');
            return this.transactionalApi;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.error('❌ Brevo SDK not installed. Run: npm install @getbrevo/brevo');
                return null;
            }
            console.error('❌ Failed to initialize Brevo client:', error.message);
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

module.exports = new BrevoConfig();

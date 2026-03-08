/**
 * SMTP Configuration
 *
 * Default email provider using Nodemailer. Works with any SMTP server
 * (Gmail, Outlook, custom SMTP, etc.)
 *
 * Environment variables:
 *   EMAIL_HOST  - SMTP host (default: smtp.gmail.com)
 *   EMAIL_PORT  - SMTP port (default: 587)
 *   EMAIL_USER  - SMTP username
 *   EMAIL_PASS  - SMTP password / app-password
 *   EMAIL_FROM  - Sender address (default: "MyApp" <no-reply@myapp.local>)
 *
 * @module config/smtp
 */

class SmtpConfig {
    constructor() {
        const fromUser = process.env.EMAIL_USER || process.env.SMTP_USER;
        this.host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
        this.port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
        this.user = process.env.EMAIL_USER || process.env.SMTP_USER;
        this.pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
        this.from =
            process.env.EMAIL_FROM ||
            (fromUser ? `"MyApp" <${fromUser}>` : '"MyApp" <no-reply@myapp.local>');
    }

    /** @returns {boolean} Whether credentials are present */
    isConfigured() {
        return !!(this.user && this.pass);
    }

    /** @returns {string} Default sender string */
    getFrom() {
        return this.from;
    }
}

module.exports = new SmtpConfig();

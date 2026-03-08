/**
 * Email Module — Public API
 *
 * @example
 *   const { createEmailService, templates, NotificationEmailService } = require('./email-module');
 *   const emailService = createEmailService();            // SMTP (default)
 *   const emailService = createEmailService('resend');     // Resend
 *
 * @module email-module
 */

const SmtpProvider = require('./providers/SmtpProvider');
const ResendProvider = require('./providers/ResendProvider');
const BrevoProvider = require('./providers/BrevoProvider');
const MailerSendProvider = require('./providers/MailerSendProvider');
const NotificationEmailService = require('./NotificationEmailService');
const templates = require('./templates');
const { requireEmailVerified, createRequireEmailVerified } = require('./middleware/requireEmailVerified');

/**
 * Factory function to create a configured email service instance.
 *
 * @param {string}  [provider='smtp'] - 'smtp' | 'resend' | 'brevo' | 'mailersend'
 * @param {Object}  [options]         - Provider constructor options
 * @param {string}  [options.appName]
 * @param {string}  [options.clientUrl]
 * @returns {SmtpProvider|ResendProvider|BrevoProvider|MailerSendProvider}
 */
function createEmailService(provider = 'smtp', options = {}) {
    switch (provider.toLowerCase()) {
        case 'smtp':
        case 'nodemailer':
            return new SmtpProvider(options);
        case 'resend':
            return new ResendProvider(options);
        case 'brevo':
        case 'sendinblue':
            return new BrevoProvider(options);
        case 'mailersend':
            return new MailerSendProvider(options);
        default:
            throw new Error(`Unknown email provider: "${provider}". Use smtp, resend, brevo, or mailersend.`);
    }
}

module.exports = {
    // Factory
    createEmailService,

    // Provider classes (for direct instantiation)
    SmtpProvider,
    ResendProvider,
    BrevoProvider,
    MailerSendProvider,

    // Notification dispatcher
    NotificationEmailService,

    // Templates
    templates,

    // Middleware
    requireEmailVerified,
    createRequireEmailVerified,
};

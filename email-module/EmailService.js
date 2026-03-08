/**
 * Email Service — Convenience Wrapper
 *
 * This is a thin facade that instantiates the default provider (SMTP)
 * and re-exports it. For most projects, this is the only file you need to require.
 *
 * For a different provider, use `createEmailService('resend')` from the barrel export.
 *
 * @module EmailService
 */

const SmtpProvider = require('./providers/SmtpProvider');

// Singleton for the default SMTP provider
const defaultService = new SmtpProvider();

module.exports = defaultService;

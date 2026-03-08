/**
 * Brevo (Sendinblue) Email Provider
 *
 * Requires: npm install @getbrevo/brevo
 *
 * @module providers/BrevoProvider
 * @see https://developers.brevo.com/docs/send-a-transactional-email
 */

const brevoConfig = require('../config/brevo');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,
    credentialsEmailTemplate,
} = require('../templates');

class BrevoProvider {
    constructor(options = {}) {
        this.client = null;
        this.config = {
            from: brevoConfig.getFrom(),
            fromName: brevoConfig.getFromName(),
            clientUrl: options.clientUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
            appName: options.appName || 'MyApp',
        };
    }

    getClient() {
        if (this.client) return this.client;
        this.client = brevoConfig.getClient();
        return this.client;
    }

    _parseSender(sender) {
        if (!sender) return { name: null, email: '' };
        const match = sender.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
        if (match) return { name: match[1].trim(), email: match[2].trim() };
        return { name: null, email: sender.trim() };
    }

    // ─── Core Send ───────────────────────────────────────────────────────────────

    async sendEmail(to, subject, html, attachments = []) {
        const client = this.getClient();
        if (!client) {
            console.warn('Brevo not configured, skipping email', { to, subject });
            return { success: false, error: 'Brevo not configured' };
        }

        try {
            const { email: senderEmail } = this._parseSender(this.config.from);

            const sendSmtpEmail = {
                sender: { name: this.config.fromName, email: senderEmail || this.config.from },
                to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
                subject,
                htmlContent: html,
            };

            if (attachments && attachments.length > 0) {
                sendSmtpEmail.attachment = await this._normalizeAttachments(attachments);
            }

            const result = await client.sendTransacEmail(sendSmtpEmail);
            const messageId = result?.messageId || result?.body?.messageId;
            return { success: true, messageId };
        } catch (error) {
            const errMsg = error?.response?.body?.message || error?.body?.message || error.message;
            console.error('Failed to send email via Brevo:', errMsg);
            return { success: false, error: errMsg };
        }
    }

    // ─── High-Level Methods ──────────────────────────────────────────────────────

    async sendVerificationEmail(email, name, verificationToken) {
        const verificationUrl = `${this.config.clientUrl}/verify-email/${verificationToken}`;
        const subject = `Verify Your Email - ${this.config.appName}`;
        const html = verificationEmailTemplate({ name, verificationUrl, priority: 'normal' });
        return this.sendEmail(email, subject, html);
    }

    async sendPasswordResetEmail(email, name, resetToken) {
        const resetUrl = `${this.config.clientUrl}/reset-password/${resetToken}`;
        const subject = `Reset Your Password - ${this.config.appName}`;
        const html = passwordResetEmailTemplate({ name, resetUrl, priority: 'high' });
        return this.sendEmail(email, subject, html);
    }

    async sendWelcomeEmail(email, name, userRole = 'User') {
        const subject = `Welcome to ${this.config.appName}!`;
        const html = welcomeEmailTemplate({ name, userRole, priority: 'normal' });
        return this.sendEmail(email, subject, html);
    }

    async sendTaskNotificationEmail(email, name, taskTitle, taskStatus, message = '') {
        const subject = `Task Update: ${taskTitle} - ${this.config.appName}`;
        const html = taskNotificationEmailTemplate({ name, taskTitle, taskStatus, message, priority: 'normal' });
        return this.sendEmail(email, subject, html);
    }

    async sendDocumentRequestEmail(email, name, taskTitle, requiredDocuments = []) {
        const subject = `Document Request: ${taskTitle} - ${this.config.appName}`;
        const html = documentRequestEmailTemplate({ name, taskTitle, requiredDocuments, priority: 'high' });
        return this.sendEmail(email, subject, html);
    }

    async sendCredentialsEmail({ email, companyName, userId, password, firmName }) {
        const subject = `Welcome to ${this.config.appName} - Your Account Credentials`;
        const html = credentialsEmailTemplate({ companyName, userId, password, firmName, priority: 'high' });
        return this.sendEmail(email, subject, html);
    }

    async sendEmailWithAttachment(email, name, subject, message, attachmentPath, attachmentName) {
        const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2>${subject}</h2>
        <p>Hello ${name},</p>
        <div style="background:#f9fafb;padding:20px;border-radius:5px;margin:20px 0;">${message}</div>
        <p>Best regards,<br>The ${this.config.appName} Team</p>
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#6b7280;">&copy; ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
        </div>
      </div>
    `;
        return this.sendEmail(email, subject, htmlContent, [{ filename: attachmentName, path: attachmentPath }]);
    }

    async testConfiguration(testEmail = 'test@example.com') {
        try {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await this.sendVerificationEmail(testEmail, 'Test User', `test-token-${otp}`);
            console.log('📧 [Brevo] Test email sent!');
            return { success: true, otp };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ─── Internals ───────────────────────────────────────────────────────────────

    async _normalizeAttachments(attachments) {
        const fs = require('fs').promises;
        return Promise.all(
            attachments.map(async (att) => {
                const normalized = { name: att.filename };
                if (att.content) {
                    normalized.content = Buffer.isBuffer(att.content)
                        ? att.content.toString('base64')
                        : att.content;
                } else if (att.path) {
                    normalized.content = (await fs.readFile(att.path)).toString('base64');
                }
                return normalized;
            }),
        );
    }
}

module.exports = BrevoProvider;

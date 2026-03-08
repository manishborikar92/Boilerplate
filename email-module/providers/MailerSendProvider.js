/**
 * MailerSend Email Provider
 *
 * Requires: npm install mailersend
 *
 * @module providers/MailerSendProvider
 * @see https://developers.mailersend.com/api/v1/email.html
 */

const mailersendConfig = require('../config/mailersend');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,
    credentialsEmailTemplate,
} = require('../templates');

class MailerSendProvider {
    constructor(options = {}) {
        this.client = null;
        this.config = {
            from: mailersendConfig.getFrom(),
            fromName: mailersendConfig.getFromName(),
            clientUrl: options.clientUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
            appName: options.appName || 'MyApp',
        };
    }

    getClient() {
        if (this.client) return this.client;
        this.client = mailersendConfig.getClient();
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
            console.warn('MailerSend not configured, skipping email', { to, subject });
            return { success: false, error: 'MailerSend not configured' };
        }

        try {
            const { EmailParams, Sender, Recipient, Attachment } = require('mailersend');

            const { email: senderEmail } = this._parseSender(this.config.from);
            const sentFrom = new Sender(senderEmail || this.config.from, this.config.fromName);

            const recipients = Array.isArray(to)
                ? to.map(e => new Recipient(e))
                : [new Recipient(to)];

            const emailParams = new EmailParams()
                .setFrom(sentFrom)
                .setTo(recipients)
                .setSubject(subject)
                .setHtml(html);

            if (attachments && attachments.length > 0) {
                const normalizedAttachments = await this._normalizeAttachments(attachments, Attachment);
                emailParams.setAttachments(normalizedAttachments);
            }

            const response = await client.email.send(emailParams);

            const messageId =
                response?.headers?.get?.('x-message-id') ||
                response?.headers?.['x-message-id'] ||
                null;

            return { success: true, messageId };
        } catch (error) {
            const errMsg = error?.body?.message || error.message;
            console.error('Failed to send email via MailerSend:', errMsg);
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
            console.log('📧 [MailerSend] Test email sent!');
            return { success: true, otp };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ─── Internals ───────────────────────────────────────────────────────────────

    async _normalizeAttachments(attachments, AttachmentClass) {
        const fs = require('fs').promises;
        return Promise.all(
            attachments.map(async (att) => {
                let base64Content;
                if (att.content) {
                    base64Content = Buffer.isBuffer(att.content)
                        ? att.content.toString('base64')
                        : att.content;
                } else if (att.path) {
                    base64Content = (await fs.readFile(att.path)).toString('base64');
                }
                return new AttachmentClass(base64Content, att.filename);
            }),
        );
    }
}

module.exports = MailerSendProvider;

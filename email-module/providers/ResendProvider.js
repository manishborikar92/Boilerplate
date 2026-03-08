/**
 * Resend Email Provider
 *
 * Requires: npm install resend
 *
 * @module providers/ResendProvider
 * @see https://resend.com/docs/send-with-nodejs
 */

const resendConfig = require('../config/resend');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,
    credentialsEmailTemplate,
} = require('../templates');

class ResendProvider {
    constructor(options = {}) {
        this.client = null;
        this.config = {
            from: resendConfig.getFrom(),
            clientUrl: options.clientUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
            appName: options.appName || 'MyApp',
        };
    }

    getClient() {
        if (this.client) return this.client;
        this.client = resendConfig.getClient();
        return this.client;
    }

    // ─── Core Send ───────────────────────────────────────────────────────────────

    async sendEmail(to, subject, html, attachments = []) {
        const client = this.getClient();
        if (!client) {
            console.warn('Resend not configured, skipping email', { to, subject });
            return { success: false, error: 'Resend not configured' };
        }

        try {
            const payload = {
                from: this.config.from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
            };

            if (attachments && attachments.length > 0) {
                payload.attachments = await this._normalizeAttachments(attachments);
            }

            const { data, error } = await client.emails.send(payload);

            if (error) {
                console.error('Resend API error', { error, to, subject });
                return { success: false, error: error.message || JSON.stringify(error) };
            }

            return { success: true, messageId: data?.id };
        } catch (error) {
            console.error('Failed to send email via Resend:', error.message);
            return { success: false, error: error.message };
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
            console.log('📧 [Resend] Test email sent!');
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
                const normalized = { filename: att.filename };
                if (att.content) {
                    normalized.content = Buffer.isBuffer(att.content)
                        ? att.content
                        : Buffer.from(att.content, 'base64');
                } else if (att.path) {
                    normalized.content = await fs.readFile(att.path);
                }
                return normalized;
            }),
        );
    }
}

module.exports = ResendProvider;

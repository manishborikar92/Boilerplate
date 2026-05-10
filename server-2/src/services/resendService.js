/**
 * Resend Email Service for CA-Workflow
 * Handles transactional email sending via Resend API
 * 
 * Can be swapped with emailService.js (SMTP)
 * Both share the same method signatures for drop-in replacement.
 * 
 * @see https://resend.com/docs/send-with-nodejs
 */

const resendConfig = require('../config/resend');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');
const { logger } = require('../middleware/logger');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,
    clientWelcomeEmailTemplate
} = require('../templates/email/notificationEmail');

class ResendService {
    constructor() {
        this.client = null;
        this.config = {
            from: resendConfig.getFrom(),
            clientUrl: getPrimaryFrontendOrigin(),
            appName: 'CA-Workflow'
        };
    }

    /**
     * Get Resend client
     * @returns {Object|null} Resend client or null if not configured
     */
    getClient() {
        if (this.client) {
            return this.client;
        }

        this.client = resendConfig.getClient();
        return this.client;
    }

    /**
     * Send email
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} html - Email HTML content
     * @param {Array} attachments - Optional email attachments
     * @returns {Promise<Object>} Send result
     */
    async sendEmail(to, subject, html, attachments = []) {
        const client = this.getClient();

        if (!client) {
            logger.warn('Resend not configured, skipping email', { to, subject });
            return { success: false, error: 'Resend not configured' };
        }

        try {
            const payload = {
                from: this.config.from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html
            };

            // Resend expects { filename, content (Buffer) }
            if (attachments && attachments.length > 0) {
                payload.attachments = await this._normalizeAttachments(attachments);
            }

            const { data, error } = await client.emails.send(payload);

            if (error) {
                logger.error('Resend API error', { error, to, subject });
                return { success: false, error: error.message || JSON.stringify(error) };
            }

            logger.info('Email sent via Resend', { to, subject, messageId: data?.id });
            return { success: true, messageId: data?.id };
        } catch (error) {
            logger.error('Failed to send email via Resend', {
                error: error.message,
                to,
                subject
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send email verification with token-based URL
     */
    async sendVerificationEmail(email, name, verificationToken) {
        try {
            const verificationUrl = `${this.config.clientUrl}/verify-email/${verificationToken}`;
            const subject = 'Verify Your Email - CA-Workflow';
            const html = verificationEmailTemplate({ name, verificationUrl, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send verification email', { error: error.message });
            throw new Error('Failed to send verification email');
        }
    }

    /**
     * Send password reset email with token-based URL
     */
    async sendPasswordResetEmail(email, name, resetToken) {
        try {
            const resetUrl = `${this.config.clientUrl}/reset-password/${resetToken}`;
            const subject = 'Reset Your Password - CA-Workflow';
            const html = passwordResetEmailTemplate({ name, resetUrl, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send password reset email', { error: error.message });
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(email, name, userRole = 'Client') {
        try {
            const subject = 'Welcome to CA-Workflow!';
            const html = welcomeEmailTemplate({ name, userRole, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send welcome email', { error: error.message });
            throw new Error('Failed to send welcome email');
        }
    }

    /**
     * Send task notification email
     */
    async sendTaskNotificationEmail(email, name, taskTitle, taskStatus, message = '') {
        try {
            const subject = `Task Update: ${taskTitle} - CA-Workflow`;
            const html = taskNotificationEmailTemplate({ name, taskTitle, taskStatus, message, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send task notification email', { error: error.message });
            throw new Error('Failed to send task notification email');
        }
    }

    /**
     * Send document request notification
     */
    async sendDocumentRequestEmail(email, name, taskTitle, requiredDocuments = []) {
        try {
            const subject = `Document Request: ${taskTitle} - CA-Workflow`;
            const html = documentRequestEmailTemplate({ name, taskTitle, requiredDocuments, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send document request email', { error: error.message });
            throw new Error('Failed to send document request email');
        }
    }

    /**
     * Send client welcome email with credentials
     */
    async sendClientWelcomeEmail({ email, companyName, userId, password, firmName }) {
        try {
            const subject = 'Welcome to CA-Workflow - Your Account Credentials';
            const html = clientWelcomeEmailTemplate({ companyName, userId, password, firmName, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            logger.error('Failed to send client welcome email', { error: error.message });
            throw new Error('Failed to send client welcome email');
        }
    }

    /**
     * Send email with attachment
     */
    async sendEmailWithAttachment(email, name, subject, message, attachmentPath, attachmentName) {
        try {
            const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>Hello ${name},</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 5px; margin: 20px 0;">
            ${message}
          </div>
          <p>Best regards,<br>The CA-Workflow Team</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              &copy; ${new Date().getFullYear()} CA-Workflow. All rights reserved.
            </p>
          </div>
        </div>
      `;

            const attachments = [{ filename: attachmentName, path: attachmentPath }];
            return await this.sendEmail(email, subject, htmlContent, attachments);
        } catch (error) {
            logger.error('Failed to send email with attachment', { error: error.message });
            throw new Error('Failed to send email with attachment');
        }
    }

    /**
     * Test email configuration
     */
    async testConfiguration(testEmail = 'test@example.com') {
        try {
            const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
            await this.sendVerificationEmail(testEmail, 'Test User', `test-token-${testOTP}`);
            console.log('📧 [Resend] Test email sent successfully!');
            return { success: true, otp: testOTP };
        } catch (error) {
            console.error('📧 [Resend] Error sending test email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Normalize attachments to Resend format { filename, content: Buffer }
     * @private
     */
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
            })
        );
    }
}

// Create and export singleton instance
const resendService = new ResendService();

module.exports = resendService;

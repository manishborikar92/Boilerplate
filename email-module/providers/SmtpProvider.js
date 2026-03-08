/**
 * SMTP Email Provider (Nodemailer)
 *
 * Default provider — requires only `nodemailer` (included in package.json).
 * In development without credentials, auto-creates an Ethereal test account.
 *
 * @module providers/SmtpProvider
 */

const nodemailer = require('nodemailer');
const smtpConfig = require('../config/smtp');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,
    credentialsEmailTemplate,
} = require('../templates');

class SmtpProvider {
    /**
     * @param {Object} [options]
     * @param {string} [options.appName]   - App name used in subjects
     * @param {string} [options.clientUrl] - Frontend base URL
     */
    constructor(options = {}) {
        this.config = {
            host: smtpConfig.host,
            port: smtpConfig.port,
            user: smtpConfig.user,
            pass: smtpConfig.pass,
            from: smtpConfig.getFrom(),
            clientUrl: options.clientUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
            appName: options.appName || 'MyApp',
        };
        this.transporter = null;
    }

    // ─── Transport ───────────────────────────────────────────────────────────────

    async createTransporter() {
        if (this.transporter) return this.transporter;

        // Unit-test mode
        if (process.env.NODE_ENV === 'test') {
            this.transporter = nodemailer.createTransport({ jsonTransport: true });
            return this.transporter;
        }

        // Dev without credentials → Ethereal
        if (process.env.NODE_ENV !== 'production' && (!this.config.user || !this.config.pass)) {
            try {
                const testAccount = await nodemailer.createTestAccount();
                console.log('📧 Ethereal account:', testAccount.user);
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: { user: testAccount.user, pass: testAccount.pass },
                });
            } catch {
                // Fallback to console logging
                this.transporter = {
                    sendMail: (opts) => {
                        console.log('📧 [dev] would send:', { to: opts.to, subject: opts.subject });
                        return Promise.resolve({ messageId: 'dev-message-id' });
                    },
                };
            }
        } else {
            // Production / configured
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.port === 465,
                auth: { user: this.config.user, pass: this.config.pass },
                tls: { rejectUnauthorized: false },
            });
        }

        return this.transporter;
    }

    // ─── Core Send ───────────────────────────────────────────────────────────────

    async sendEmail(to, subject, html, attachments = []) {
        const transporter = await this.createTransporter();

        const mailOptions = { from: this.config.from, to, subject, html };
        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV !== 'production' && (!this.config.user || !this.config.pass)) {
            console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
        }

        return info;
    }

    // ─── High-Level Methods ──────────────────────────────────────────────────────

    async sendVerificationEmail(email, name, verificationToken) {
        try {
            const verificationUrl = `${this.config.clientUrl}/verify-email/${verificationToken}`;
            const subject = `Verify Your Email - ${this.config.appName}`;
            const html = verificationEmailTemplate({ name, verificationUrl, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    async sendPasswordResetEmail(email, name, resetToken) {
        try {
            const resetUrl = `${this.config.clientUrl}/reset-password/${resetToken}`;
            const subject = `Reset Your Password - ${this.config.appName}`;
            const html = passwordResetEmailTemplate({ name, resetUrl, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }

    async sendWelcomeEmail(email, name, userRole = 'User') {
        try {
            const subject = `Welcome to ${this.config.appName}!`;
            const html = welcomeEmailTemplate({ name, userRole, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            throw new Error('Failed to send welcome email');
        }
    }

    async sendTaskNotificationEmail(email, name, taskTitle, taskStatus, message = '') {
        try {
            const subject = `Task Update: ${taskTitle} - ${this.config.appName}`;
            const html = taskNotificationEmailTemplate({ name, taskTitle, taskStatus, message, priority: 'normal' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send task notification email:', error);
            throw new Error('Failed to send task notification email');
        }
    }

    async sendDocumentRequestEmail(email, name, taskTitle, requiredDocuments = []) {
        try {
            const subject = `Document Request: ${taskTitle} - ${this.config.appName}`;
            const html = documentRequestEmailTemplate({ name, taskTitle, requiredDocuments, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send document request email:', error);
            throw new Error('Failed to send document request email');
        }
    }

    async sendCredentialsEmail({ email, companyName, userId, password, firmName }) {
        try {
            const subject = `Welcome to ${this.config.appName} - Your Account Credentials`;
            const html = credentialsEmailTemplate({ companyName, userId, password, firmName, priority: 'high' });
            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send credentials email:', error);
            throw new Error('Failed to send credentials email');
        }
    }

    async sendEmailWithAttachment(email, name, subject, message, attachmentPath, attachmentName) {
        try {
            const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>Hello ${name},</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 5px; margin: 20px 0;">
            ${message}
          </div>
          <p>Best regards,<br>The ${this.config.appName} Team</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              &copy; ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.
            </p>
          </div>
        </div>
      `;

            const attachments = [{ filename: attachmentName, path: attachmentPath }];
            return await this.sendEmail(email, subject, htmlContent, attachments);
        } catch (error) {
            console.error('Failed to send email with attachment:', error);
            throw new Error('Failed to send email with attachment');
        }
    }

    async testConfiguration(testEmail = 'test@example.com') {
        try {
            const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
            await this.sendVerificationEmail(testEmail, 'Test User', `test-token-${testOTP}`);
            console.log('📧 Test email sent successfully!');
            return { success: true, otp: testOTP };
        } catch (error) {
            console.error('📧 Error sending test email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SmtpProvider;

/**
 * Email Service
 * 
 * A self-contained email service using nodemailer directly.
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        const fromUser = process.env.EMAIL_USER || process.env.SMTP_USER;
        this.config = {
            host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
            user: process.env.EMAIL_USER || process.env.SMTP_USER,
            pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
            from: process.env.EMAIL_FROM || (fromUser ? `"App Name" <${fromUser}>` : '"App Name" <no-reply@example.com>'),
            clientUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
            appName: 'App Name'
        };

        this.transporter = null;
    }

    /**
     * Create email transporter
     * @returns {Promise<Object>} Nodemailer transporter
     */
    async createTransporter() {
        if (this.transporter) {
            return this.transporter;
        }

        if (process.env.NODE_ENV === 'test') {
            this.transporter = nodemailer.createTransport({ jsonTransport: true });
            return this.transporter;
        }

        // For development/testing, use ethereal.email if no credentials provided
        if (process.env.NODE_ENV !== 'production' && (!this.config.user || !this.config.pass)) {
            try {
                const testAccount = await nodemailer.createTestAccount();
                console.log('📧 Created test email account:', testAccount.user);

                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });
            } catch (error) {
                console.error('Failed to create test account:', error);
                // Fall back to console logging for development
                this.transporter = {
                    sendMail: (mailOptions) => {
                        console.log('📧 Email would have been sent:', {
                            to: mailOptions.to,
                            subject: mailOptions.subject
                        });
                        return Promise.resolve({ messageId: 'test-message-id' });
                    }
                };
            }
        } else {
            // For production or when credentials are provided
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.port === 465, // true for 465, false for other ports
                auth: {
                    user: this.config.user,
                    pass: this.config.pass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        }

        return this.transporter;
    }

    /**
     * Send email
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} html - Email HTML content
     * @param {Array} attachments - Optional email attachments
     * @returns {Promise} Nodemailer info
     */
    async sendEmail(to, subject, html, attachments = []) {
        const transporter = await this.createTransporter();

        const mailOptions = {
            from: this.config.from,
            to,
            subject,
            html
        };

        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments;
        }

        const info = await transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV !== 'production' && (!this.config.user || !this.config.pass)) {
            console.log('📧 Email Preview URL:', nodemailer.getTestMessageUrl(info));
        }

        return info;
    }

    /**
     * Send email verification with token-based URL
     * @param {string} email - Recipient email
     * @param {string} name - Recipient name
     * @param {string} verificationToken - Verification token for URL
     */
    async sendVerificationEmail(email, name, verificationToken) {
        try {
            const verificationUrl = `${this.config.clientUrl}/verify-email/${verificationToken}`;
            const subject = 'Verify Your Email';
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome!</h2>
          <p>Hi ${name},</p>
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
        </div>
      `;

            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    /**
     * Send password reset email with token-based URL
     * @param {string} email - Recipient email
     * @param {string} name - Recipient name
     * @param {string} resetToken - Password reset token
     */
    async sendPasswordResetEmail(email, name, resetToken) {
        try {
            const resetUrl = `${this.config.clientUrl}/reset-password/${resetToken}`;
            const subject = 'Reset Your Password';
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `;

            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Send welcome email to new users
     * @param {string} email - Recipient email
     * @param {string} name - Recipient name
     */
    async sendWelcomeEmail(email, name) {
        try {
            const subject = 'Welcome!';
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome!</h2>
          <p>Hello ${name},</p>
          <p>Welcome to our platform! We're excited to have you on board.</p>
        </div>
      `;

            return await this.sendEmail(email, subject, html);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            throw new Error('Failed to send welcome email');
        }
    }

    /**
     * Test email configuration
     * @param {string} testEmail - Test recipient email
     */
    async testConfiguration(testEmail = 'test@example.com') {
        try {
            const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
            await this.sendVerificationEmail(testEmail, 'Test User', `test-token-${testOTP}`);
            return { success: true, otp: testOTP };
        } catch (error) {
            console.error('📧 Error sending test email:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create and export a singleton instance
module.exports = new EmailService();

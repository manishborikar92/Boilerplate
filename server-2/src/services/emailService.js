/**
 * Email Service for CA-Workflow
 * 
 * A self-contained email service using nodemailer directly
 * with CA-Workflow specific configurations and templates.
 * 
 * To swap to a different provider, change the require() in your consumer:
 *   const emailService = require('../services/emailService');      // SMTP (current)
 *   const emailService = require('../services/resendService');     // Resend
 * 
 * Both services export the same API (same method signatures).
 */

const nodemailer = require('nodemailer');
const {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
  taskNotificationEmailTemplate,
  documentRequestEmailTemplate,
  clientWelcomeEmailTemplate
} = require('../templates/email/notificationEmail');
const { getPrimaryFrontendOrigin } = require('../config/frontendOrigins');

class CAFlowEmailService {
  constructor() {
    const fromUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    this.config = {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
      from: process.env.EMAIL_FROM || (fromUser ? `"CA-Workflow" <${fromUser}>` : '"CA-Workflow" <no-reply@caworkflow.local>'),
      clientUrl: getPrimaryFrontendOrigin(),
      appName: 'CA-Workflow'
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
        console.log('📧 Test email password:', testAccount.pass);
        console.log('📧 View emails at: https://ethereal.email');
        
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
        // Add these options for Gmail
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

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    
    // Log email URL for development
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
   * @returns {Promise} Email sending result
   */
  async sendVerificationEmail(email, name, verificationToken) {
    try {
      // Create verification URL with token
      const verificationUrl = `${this.config.clientUrl}/verify-email/${verificationToken}`;
      
      const subject = 'Verify Your Email - CA-Workflow';
      const html = verificationEmailTemplate({
        name,
        verificationUrl,
        priority: 'normal'
      });
      
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
   * @returns {Promise} Email sending result
   */
  async sendPasswordResetEmail(email, name, resetToken) {
    try {
      // Create reset URL with token
      const resetUrl = `${this.config.clientUrl}/reset-password/${resetToken}`;
      
      const subject = 'Reset Your Password - CA-Workflow';
      const html = passwordResetEmailTemplate({
        name,
        resetUrl,
        priority: 'high'
      });
      
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
   * @param {string} userRole - User role (CA-Admin, CA-Employee, Client)
   * @returns {Promise} Email sending result
   */
  async sendWelcomeEmail(email, name, userRole = 'Client') {
    try {
      const subject = 'Welcome to CA-Workflow!';
      const html = welcomeEmailTemplate({
        name,
        userRole,
        priority: 'normal'
      });
      
      return await this.sendEmail(email, subject, html);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  /**
   * Send task notification email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} taskTitle - Task title
   * @param {string} taskStatus - Task status
   * @param {string} message - Additional message
   * @returns {Promise} Email sending result
   */
  async sendTaskNotificationEmail(email, name, taskTitle, taskStatus, message = '') {
    try {
      const subject = `Task Update: ${taskTitle} - CA-Workflow`;
      const html = taskNotificationEmailTemplate({
        name,
        taskTitle,
        taskStatus,
        message,
        priority: 'normal'
      });
      
      return await this.sendEmail(email, subject, html);
    } catch (error) {
      console.error('Failed to send task notification email:', error);
      throw new Error('Failed to send task notification email');
    }
  }

  /**
   * Send document request notification
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} taskTitle - Task title
   * @param {Array} requiredDocuments - List of required documents
   * @returns {Promise} Email sending result
   */
  async sendDocumentRequestEmail(email, name, taskTitle, requiredDocuments = []) {
    try {
      const subject = `Document Request: ${taskTitle} - CA-Workflow`;
      const html = documentRequestEmailTemplate({
        name,
        taskTitle,
        requiredDocuments,
        priority: 'high'
      });
      
      return await this.sendEmail(email, subject, html);
    } catch (error) {
      console.error('Failed to send document request email:', error);
      throw new Error('Failed to send document request email');
    }
  }

  /**
   * Test email configuration
   * @param {string} testEmail - Test recipient email
   * @returns {Promise} Test result
   */
  async testConfiguration(testEmail = 'test@example.com') {
    try {
      const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
      
      await this.sendVerificationEmail(
        testEmail,
        'Test User',
        `test-token-${testOTP}`
      );
      
      console.log('📧 Test email sent successfully!');
      console.log(`📧 Test OTP: ${testOTP}`);
      return { success: true, otp: testOTP };
    } catch (error) {
      console.error('📧 Error sending test email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send client welcome email with credentials
   * @param {Object} options - Email options
   * @param {string} options.email - Client email
   * @param {string} options.companyName - Company name
   * @param {string} options.userId - Generated user ID
   * @param {string} options.password - Generated password
   * @param {string} options.firmName - CA firm name
   * @returns {Promise} Email sending result
   */
  async sendClientWelcomeEmail({ email, companyName, userId, password, firmName }) {
    try {
      const subject = `Welcome to CA-Workflow - Your Account Credentials`;
      const html = clientWelcomeEmailTemplate({
        companyName,
        userId,
        password,
        firmName,
        priority: 'high'
      });
      
      return await this.sendEmail(email, subject, html);
    } catch (error) {
      console.error('Failed to send client welcome email:', error);
      throw new Error('Failed to send client welcome email');
    }
  }

  /**
   * Send email with attachment (for reports, invoices, etc.)
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} subject - Email subject
   * @param {string} message - Email message
   * @param {string} attachmentPath - Path to attachment
   * @param {string} attachmentName - Attachment filename
   * @returns {Promise} Email sending result
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
      
      const attachments = [
        {
          filename: attachmentName,
          path: attachmentPath
        }
      ];
      
      return await this.sendEmail(email, subject, htmlContent, attachments);
    } catch (error) {
      console.error('Failed to send email with attachment:', error);
      throw new Error('Failed to send email with attachment');
    }
  }
}

// Create and export a singleton instance
const caFlowEmailService = new CAFlowEmailService();

module.exports = caFlowEmailService;

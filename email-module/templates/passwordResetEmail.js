/**
 * Password Reset Template
 * @module templates/passwordResetEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.name       - Recipient name
 * @param {string} opts.resetUrl   - Full password-reset URL
 * @param {string} [opts.expiresIn] - Expiry description (default: "1 hour")
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const passwordResetEmailTemplate = ({ name, resetUrl, expiresIn = '1 hour', priority = 'high', brand }) => {
    const content = `
    <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">You requested to reset your password. Click the button below to create a new password.</p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        ⏰ This reset link will expire in <strong>${expiresIn}</strong>. If you didn't request a password reset, please ignore this email.
      </p>
    </div>
  `;

    return baseTemplate({
        title: 'Reset Your Password',
        content,
        actionUrl: resetUrl,
        actionLabel: 'Reset Password',
        priority,
        brand,
    });
};

module.exports = { passwordResetEmailTemplate };

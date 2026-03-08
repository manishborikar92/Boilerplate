/**
 * Email Verification Template
 * @module templates/verificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.name            - Recipient name
 * @param {string} opts.verificationUrl - Full verification URL
 * @param {string} [opts.expiresIn]     - Expiry description (default: "24 hours")
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const verificationEmailTemplate = ({ name, verificationUrl, expiresIn = '24 hours', priority = 'normal', brand }) => {
    const content = `
    <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">Thank you for registering. Please verify your email address to activate your account.</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        ⏰ This verification link will expire in <strong>${expiresIn}</strong>. If you didn't create an account, please ignore this email.
      </p>
    </div>
  `;

    return baseTemplate({
        title: 'Verify Your Email',
        content,
        actionUrl: verificationUrl,
        actionLabel: 'Verify Email',
        priority,
        brand,
    });
};

module.exports = { verificationEmailTemplate };

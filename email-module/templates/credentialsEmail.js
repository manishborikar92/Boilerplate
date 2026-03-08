/**
 * Account Credentials Delivery Template
 * @module templates/credentialsEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.companyName - Organisation / company name
 * @param {string} opts.userId     - Generated login ID
 * @param {string} opts.password   - Temporary password
 * @param {string} [opts.firmName] - Name of the firm that created the account
 * @param {string} [opts.loginUrl] - Login page URL
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const credentialsEmailTemplate = ({
    companyName,
    userId,
    password,
    firmName,
    loginUrl,
    priority = 'high',
    brand,
}) => {
    const inviterText = firmName
        ? `<strong>${firmName}</strong> has created an account for you.`
        : 'An account has been created for you.';

    const ctaUrl = loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

    const content = `
    <p style="margin:0 0 16px;">Hello,</p>
    <p style="margin:0 0 16px;">Welcome! ${inviterText}</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">🔐 Your Login Credentials:</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>User ID:</strong></td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${userId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Password:</strong></td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${password}</td>
        </tr>
      </table>
    </div>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        ⚠️ <strong>Important:</strong> Please change your password after your first login for security purposes.
      </p>
    </div>
  `;

    return baseTemplate({
        title: 'Your Account Credentials',
        content,
        actionUrl: ctaUrl,
        actionLabel: 'Login Now',
        priority,
        brand,
    });
};

module.exports = { credentialsEmailTemplate };

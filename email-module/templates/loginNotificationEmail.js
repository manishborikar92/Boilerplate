/**
 * Login Notification Template
 * @module templates/loginNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object}  opts
 * @param {string}  opts.recipientName - Recipient name
 * @param {string}  opts.clientName    - Name of the user who logged in
 * @param {boolean} [opts.isFirstLogin] - Whether this is the first login
 * @param {string}  opts.loginTime     - Formatted login timestamp
 * @param {string}  [opts.actionUrl]
 * @param {string}  [opts.priority]
 * @param {Object}  [opts.brand]
 * @returns {string} HTML
 */
const loginNotificationEmailTemplate = ({
    recipientName,
    clientName,
    isFirstLogin = false,
    loginTime,
    actionUrl,
    priority,
    brand,
}) => {
    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${isFirstLogin ? '🎉' : '👤'} ${isFirstLogin ? 'First' : ''} Login</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>User:</strong></td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${clientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Time:</strong></td>
          <td style="padding:8px 0;font-size:14px;text-align:right;">${loginTime}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0;">
      ${isFirstLogin
            ? `<strong>${clientName}</strong> has logged in for the first time! They can now access their dashboard and start using the platform.`
            : `<strong>${clientName}</strong> has logged in to their account.`
        }
    </p>
  `;

    return baseTemplate({
        title: isFirstLogin ? 'First Login' : 'Login Activity',
        content,
        actionUrl,
        actionLabel: 'View Details',
        priority,
        brand,
    });
};

module.exports = { loginNotificationEmailTemplate };

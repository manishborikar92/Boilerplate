/**
 * Subscription Notification Template
 * @module templates/subscriptionNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string}       opts.recipientName   - Recipient name
 * @param {string}       opts.planName        - Subscription plan name
 * @param {string}       opts.status          - 'activated' | 'failed' | 'cancelled'
 * @param {string|number} [opts.amount]       - Formatted amount
 * @param {string}       [opts.currencySymbol] - Currency symbol (default: "₹")
 * @param {string}       [opts.nextBillingDate] - Formatted next billing date
 * @param {string}       [opts.actionUrl]
 * @param {string}       [opts.priority]
 * @param {Object}       [opts.brand]
 * @returns {string} HTML
 */
const subscriptionNotificationEmailTemplate = ({
    recipientName,
    planName,
    status,
    amount,
    currencySymbol = '₹',
    nextBillingDate,
    actionUrl,
    priority,
    brand,
}) => {
    const statusConfig = {
        activated: { icon: '✅', color: '#10b981', bg: '#f0fdf4', text: 'Activated' },
        failed: { icon: '❌', color: '#ef4444', bg: '#fef2f2', text: 'Payment Failed' },
        cancelled: { icon: '⚠️', color: '#f59e0b', bg: '#fef3c7', text: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.activated;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:${config.bg};border-left:4px solid ${config.color};padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${config.icon} Subscription ${config.text}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Plan:</strong></td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;">${planName}</td>
        </tr>
        ${amount ? `
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Amount:</strong></td>
          <td style="padding:8px 0;font-size:14px;text-align:right;">${currencySymbol}${amount}</td>
        </tr>
        ` : ''}
        ${nextBillingDate ? `
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Next Billing:</strong></td>
          <td style="padding:8px 0;font-size:14px;text-align:right;">${nextBillingDate}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <p style="margin:0;">
      ${status === 'activated'
            ? `Your <strong>${planName}</strong> subscription has been successfully activated. You now have access to all premium features.`
            : status === 'failed'
                ? `The payment for your <strong>${planName}</strong> subscription has failed. Please update your payment method to continue using premium features.`
                : `Your <strong>${planName}</strong> subscription has been cancelled. You will continue to have access until the end of your billing period.`
        }
    </p>
  `;

    return baseTemplate({
        title: `Subscription ${config.text}`,
        content,
        actionUrl,
        actionLabel: status === 'failed' ? 'Update Payment Method' : 'View Subscription',
        priority,
        brand,
    });
};

module.exports = { subscriptionNotificationEmailTemplate };

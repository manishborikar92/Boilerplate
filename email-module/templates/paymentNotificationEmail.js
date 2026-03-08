/**
 * Payment Notification Template
 * @module templates/paymentNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object}  opts
 * @param {string}  opts.recipientName - Recipient name
 * @param {string|number} opts.amount  - Formatted amount (e.g. "5,000")
 * @param {string}  opts.clientName    - Payer / client name
 * @param {string}  opts.status        - 'received' | 'failed'
 * @param {string}  [opts.currencySymbol] - Currency symbol (default: "₹")
 * @param {string}  [opts.actionUrl]
 * @param {string}  [opts.priority]
 * @param {Object}  [opts.brand]
 * @returns {string} HTML
 */
const paymentNotificationEmailTemplate = ({
    recipientName,
    amount,
    clientName,
    status,
    currencySymbol = '₹',
    actionUrl,
    priority,
    brand,
}) => {
    const isSuccess = status === 'received';
    const icon = isSuccess ? '✅' : '❌';
    const statusText = isSuccess ? 'Received' : 'Failed';

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:${isSuccess ? '#f0fdf4' : '#fef2f2'};border-left:4px solid ${isSuccess ? '#10b981' : '#ef4444'};padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${icon} Payment ${statusText}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Amount:</strong></td>
          <td style="padding:8px 0;font-size:16px;font-weight:600;text-align:right;">${currencySymbol}${amount}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Client:</strong></td>
          <td style="padding:8px 0;font-size:14px;text-align:right;">${clientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Status:</strong></td>
          <td style="padding:8px 0;text-align:right;">
            <span style="display:inline-block;background:${isSuccess ? '#10b981' : '#ef4444'};color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${statusText}</span>
          </td>
        </tr>
      </table>
    </div>
    <p style="margin:0;">
      ${isSuccess
            ? `Great news! A payment of <strong>${currencySymbol}${amount}</strong> has been successfully received from <strong>${clientName}</strong>.`
            : `A payment of <strong>${currencySymbol}${amount}</strong> from <strong>${clientName}</strong> has failed. Please follow up with the client.`
        }
    </p>
  `;

    return baseTemplate({
        title: `Payment ${statusText}`,
        content,
        actionUrl,
        actionLabel: 'View Payment Details',
        priority,
        brand,
    });
};

module.exports = { paymentNotificationEmailTemplate };

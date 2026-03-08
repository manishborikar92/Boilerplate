/**
 * Thread / Conversation Notification Template
 * @module templates/threadNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.recipientName    - Recipient name
 * @param {string} opts.subject          - Thread subject
 * @param {string} opts.message          - Message body / preview
 * @param {string} opts.senderName       - Person who sent the message
 * @param {string} [opts.senderRole]     - e.g. 'Admin', 'Client'
 * @param {string} [opts.notificationType] - 'created' | 'message' | 'resolved'
 * @param {string} [opts.actionUrl]
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const threadNotificationEmailTemplate = ({
    recipientName,
    subject,
    message,
    senderName,
    senderRole = '',
    notificationType = 'message',
    actionUrl,
    priority,
    brand,
}) => {
    const icons = { created: '💬', message: '📨', resolved: '✅' };
    const icon = icons[notificationType] || '💬';

    const titleMap = {
        created: 'New Conversation',
        resolved: 'Conversation Resolved',
    };
    const title = titleMap[notificationType] || 'New Message';

    const senderLabel = senderRole === 'Admin' ? 'Your Admin' : senderName;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${icon} ${subject}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        <strong>${senderLabel}</strong> ${message}
      </p>
    </div>
    <p style="margin:0;">Click the button below to view the conversation and respond.</p>
  `;

    return baseTemplate({
        title,
        content,
        actionUrl,
        actionLabel: 'View Conversation',
        priority,
        brand,
    });
};

module.exports = { threadNotificationEmailTemplate };

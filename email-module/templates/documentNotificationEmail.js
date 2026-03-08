/**
 * Document Upload Notification Template
 * @module templates/documentNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string}       opts.recipientName - Recipient name
 * @param {string}       [opts.documentName] - Single document name
 * @param {number}       [opts.documentCount] - Number of documents uploaded
 * @param {string}       opts.uploaderName   - Who uploaded
 * @param {string}       [opts.uploaderRole] - e.g. 'Admin', 'Client'
 * @param {string}       [opts.actionUrl]
 * @param {string}       [opts.priority]
 * @param {Object}       [opts.brand]
 * @returns {string} HTML
 */
const documentNotificationEmailTemplate = ({
    recipientName,
    documentName = 'document',
    documentCount = 1,
    uploaderName,
    uploaderRole = '',
    actionUrl,
    priority,
    brand,
}) => {
    const isMultiple = documentCount > 1;
    const uploaderLabel = uploaderRole === 'Admin' ? 'Your Admin' : uploaderName;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">📄 ${isMultiple ? `${documentCount} Documents` : 'Document'} Uploaded</p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        <strong>${uploaderLabel}</strong> uploaded ${isMultiple ? `${documentCount} documents` : documentName} in your conversation.
      </p>
    </div>
    <p style="margin:0;">
      ${isMultiple
            ? 'Multiple documents have been shared with you. Click below to view and download them.'
            : 'A new document has been shared with you. Click below to view and download it.'
        }
    </p>
  `;

    return baseTemplate({
        title: 'New Document Available',
        content,
        actionUrl,
        actionLabel: 'View Documents',
        priority,
        brand,
    });
};

module.exports = { documentNotificationEmailTemplate };

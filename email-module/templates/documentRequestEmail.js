/**
 * Document Request Template
 * @module templates/documentRequestEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string}   opts.name              - Recipient name
 * @param {string}   opts.taskTitle         - Related task title
 * @param {string[]} [opts.requiredDocuments] - List of required document names
 * @param {string}   [opts.uploadUrl]       - URL to the upload page
 * @param {string}   [opts.priority]
 * @param {Object}   [opts.brand]
 * @returns {string} HTML
 */
const documentRequestEmailTemplate = ({
    name,
    taskTitle,
    requiredDocuments = [],
    uploadUrl,
    priority = 'high',
    brand,
}) => {
    const documentList = requiredDocuments.map(doc => `<li>${doc}</li>`).join('');

    const ctaUrl = uploadUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">We need some documents from you to proceed with: <strong>${taskTitle}</strong></p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">📋 Required Documents:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
        ${documentList}
      </ul>
    </div>
    <p style="margin:0;">Please upload these documents at your earliest convenience.</p>
  `;

    return baseTemplate({
        title: 'Documents Required',
        content,
        actionUrl: ctaUrl,
        actionLabel: 'Upload Documents',
        priority,
        brand,
    });
};

module.exports = { documentRequestEmailTemplate };

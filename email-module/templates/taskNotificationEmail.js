/**
 * Task Notification Template
 * @module templates/taskNotificationEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.name       - Recipient name
 * @param {string} opts.taskTitle  - Task title
 * @param {string} opts.taskStatus - Status key  ('pending' | 'in-progress' | 'completed' | 'cancelled')
 * @param {string} [opts.message]  - Optional additional message
 * @param {string} [opts.taskUrl]  - Link to view the task
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const taskNotificationEmailTemplate = ({
    name,
    taskTitle,
    taskStatus,
    message = '',
    taskUrl,
    priority = 'normal',
    brand,
}) => {
    const statusConfig = {
        pending: { icon: '⏳', color: '#f59e0b', bg: '#fef3c7' },
        'in-progress': { icon: '🔄', color: '#0ea5e9', bg: '#f0f9ff' },
        completed: { icon: '✅', color: '#10b981', bg: '#f0fdf4' },
        cancelled: { icon: '❌', color: '#ef4444', bg: '#fef2f2' },
    };

    const config = statusConfig[taskStatus] || statusConfig.pending;
    const statusLabel = taskStatus.charAt(0).toUpperCase() + taskStatus.slice(1);

    const ctaUrl = taskUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">There's an update on your task: <strong>${taskTitle}</strong></p>
    <div style="background:${config.bg};border-left:4px solid ${config.color};padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">
        ${config.icon} Status: ${statusLabel}
      </p>
      ${message ? `<p style="margin:0;font-size:14px;line-height:1.6;">${message}</p>` : ''}
    </div>
  `;

    return baseTemplate({
        title: 'Task Update',
        content,
        actionUrl: ctaUrl,
        actionLabel: 'View Task',
        priority,
        brand,
    });
};

module.exports = { taskNotificationEmailTemplate };

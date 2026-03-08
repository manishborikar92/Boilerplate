/**
 * Welcome / Onboarding Email Template
 * @module templates/welcomeEmail
 */

const { baseTemplate } = require('./baseTemplate');

/**
 * @param {Object} opts
 * @param {string} opts.name             - Recipient name
 * @param {string} [opts.userRole]       - Role key for contextual messaging
 * @param {Object} [opts.roleMessages]   - Map of role → description string
 * @param {string[]} [opts.gettingStarted] - Array of onboarding steps
 * @param {string} [opts.dashboardUrl]   - URL for the CTA button
 * @param {string} [opts.priority]
 * @param {Object} [opts.brand]
 * @returns {string} HTML
 */
const welcomeEmailTemplate = ({
    name,
    userRole = 'User',
    roleMessages = {},
    gettingStarted,
    dashboardUrl,
    priority = 'normal',
    brand,
}) => {
    // Default role messages — override / extend via roleMessages param
    const defaultRoleMessages = {
        Admin: 'As an Administrator, you can manage your organization, invite team members, and oversee all operations.',
        Employee: 'As a team member, you can work on assigned tasks and collaborate with your team.',
        Client: 'As a Client, you can upload documents, track progress, and download completed work.',
    };

    const mergedMessages = { ...defaultRoleMessages, ...roleMessages };
    const roleMessage = mergedMessages[userRole] || 'Welcome to our platform.';

    const steps = gettingStarted || [
        'Complete your profile setup',
        'Explore the dashboard',
        'Upload your first document',
        'Contact support if you need help',
    ];

    const stepList = steps.map(s => `<li>${s}</li>`).join('');
    const ctaUrl = dashboardUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const content = `
    <p style="margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">Welcome! We're excited to have you on board.</p>
    <p style="margin:0 0 16px;">${roleMessage}</p>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">🚀 Getting Started:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
        ${stepList}
      </ul>
    </div>
    <p style="margin:0;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
  `;

    return baseTemplate({
        title: 'Welcome!',
        content,
        actionUrl: ctaUrl,
        actionLabel: 'Go to Dashboard',
        priority,
        brand,
    });
};

module.exports = { welcomeEmailTemplate };

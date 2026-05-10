/**
 * Notification Email Templates - Template 1: Classic Professional
 * Mobile-responsive email templates for CA-Flow notifications
 * Traditional corporate design with navy blue accents
 */

const { getPrimaryFrontendOrigin } = require('../../config/frontendOrigins');
const {
  AUTH_ROUTES,
  CA_ADMIN_ROUTES,
  CLIENT_PORTAL_ROUTES,
} = require('../../constants/frontendRoutes');

const frontendOrigin = getPrimaryFrontendOrigin();

const baseStyles = `
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 10px !important; }
      .container { width: 100% !important; }
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-font-xl { font-size: 26px !important; }
      .mobile-font-lg { font-size: 20px !important; }
      .mobile-font-md { font-size: 15px !important; }
      .mobile-hide { display: none !important; }
      .mobile-show { display: block !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full { width: 100% !important; display: block !important; }
    }
  </style>
`;

/**
 * Base email template with consistent styling
 * @param {Object} options - Template options
 * @returns {string} HTML email template
 */
const baseTemplate = ({ title, content, actionUrl, actionLabel, priority }) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${baseStyles}
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;">
      <tr>
        <td class="wrapper" style="padding:20px 10px;">
          <table role="presentation" class="container" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #ddd;">
            <tr>
              <td class="mobile-padding" style="padding:32px 40px;border-bottom:3px solid #1e3a8a;background:#fff;">
                <h1 class="mobile-font-xl" style="margin:0;color:#1e3a8a;font-size:32px;font-weight:700;">CA-Workflow</h1>
                <p style="margin:4px 0 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Chartered Accountant Services</p>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:40px;">
                <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#1e293b;font-size:22px;font-weight:600;border-bottom:2px solid #e2e8f0;padding-bottom:14px;">${title}</h2>
                <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#334155;">${content}</div>
                ${actionUrl && actionLabel ? `
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
                  <tr>
                    <td style="background:#1e3a8a;border-radius:4px;text-align:center;">
                      <a href="${actionUrl}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;text-transform:uppercase;">${actionLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5;">Or visit: <a href="${actionUrl}" style="color:#1e3a8a;word-break:break-all;">${actionUrl}</a></p>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.6;">This is an automated notification from CA-Workflow. You're receiving this because you have notifications enabled.</p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} CA-Workflow. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
};

/**
 * Payment notification email template
 */
const paymentNotificationTemplate = ({ recipientName, amount, clientName, status, actionUrl, priority }) => {
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
          <td style="padding:8px 0;font-size:16px;font-weight:600;text-align:right;">₹${amount}</td>
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
        ? `Great news! A payment of <strong>₹${amount}</strong> has been successfully received from <strong>${clientName}</strong>.`
        : `A payment of <strong>₹${amount}</strong> from <strong>${clientName}</strong> has failed. Please follow up with the client.`
      }
    </p>
  `;

  return baseTemplate({
    title: `Payment ${statusText}`,
    content,
    actionUrl,
    actionLabel: 'View Payment Details',
    priority
  });
};

/**
 * Thread/Conversation notification email template
 */
const threadNotificationTemplate = ({ recipientName, subject, message, senderName, senderRole, actionUrl, priority, notificationType }) => {
  const icons = { created: '💬', message: '📨', resolved: '✅' };
  const icon = icons[notificationType] || '💬';
  
  const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${icon} ${subject}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        <strong>${senderRole === 'CA-Admin' ? 'Your CA' : senderName}</strong> ${message}
      </p>
    </div>
    <p style="margin:0;">Click the button below to view the conversation and respond.</p>
  `;

  return baseTemplate({
    title: notificationType === 'created' ? 'New Conversation' : notificationType === 'resolved' ? 'Conversation Resolved' : 'New Message',
    content,
    actionUrl,
    actionLabel: 'View Conversation',
    priority
  });
};

/**
 * Document notification email template
 */
const documentNotificationTemplate = ({ recipientName, documentName, documentCount, uploaderName, uploaderRole, actionUrl, priority }) => {
  const isMultiple = documentCount > 1;
  
  const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">📄 ${isMultiple ? `${documentCount} Documents` : 'Document'} Uploaded</p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        <strong>${uploaderRole === 'CA-Admin' ? 'Your CA' : uploaderName}</strong> uploaded ${isMultiple ? `${documentCount} documents` : documentName} in your conversation.
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
    priority
  });
};

/**
 * Subscription notification email template
 */
const subscriptionNotificationTemplate = ({ recipientName, planName, status, amount, nextBillingDate, actionUrl, priority }) => {
  const statusConfig = {
    activated: { icon: '✅', color: '#10b981', bg: '#f0fdf4', text: 'Activated' },
    failed: { icon: '❌', color: '#ef4444', bg: '#fef2f2', text: 'Payment Failed' },
    cancelled: { icon: '⚠️', color: '#f59e0b', bg: '#fef3c7', text: 'Cancelled' }
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
          <td style="padding:8px 0;font-size:14px;text-align:right;">₹${amount}</td>
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
    priority
  });
};

/**
 * Login notification email template
 */
const loginNotificationTemplate = ({ recipientName, clientName, isFirstLogin, loginTime, actionUrl, priority }) => {
  const content = `
    <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${isFirstLogin ? '🎉' : '👤'} Client ${isFirstLogin ? 'First' : ''} Login</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:8px 0;font-size:14px;"><strong>Client:</strong></td>
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
        ? `<strong>${clientName}</strong> has logged in for the first time! They can now access their dashboard and start uploading documents.`
        : `<strong>${clientName}</strong> has logged in to their account.`
      }
    </p>
  `;

  return baseTemplate({
    title: isFirstLogin ? 'Client First Login' : 'Client Login',
    content,
    actionUrl,
    actionLabel: 'View Client Details',
    priority
  });
};

/**
 * Email verification template
 */
const verificationEmailTemplate = ({ name, verificationUrl, priority = 'normal' }) => {
  const content = `
    <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">Thank you for registering with CA-Workflow. Please verify your email address to activate your account.</p>
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        ⏰ This verification link will expire in <strong>24 hours</strong>. If you didn't create an account, please ignore this email.
      </p>
    </div>
  `;

  return baseTemplate({
    title: 'Verify Your Email',
    content,
    actionUrl: verificationUrl,
    actionLabel: 'Verify Email',
    priority
  });
};

/**
 * Password reset template
 */
const passwordResetEmailTemplate = ({ name, resetUrl, priority = 'high' }) => {
  const content = `
    <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">You requested to reset your password for your CA-Workflow account. Click the button below to create a new password.</p>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        ⏰ This reset link will expire in <strong>1 hour</strong>. If you didn't request a password reset, please ignore this email.
      </p>
    </div>
  `;

  return baseTemplate({
    title: 'Reset Your Password',
    content,
    actionUrl: resetUrl,
    actionLabel: 'Reset Password',
    priority
  });
};

/**
 * Welcome email template
 */
const welcomeEmailTemplate = ({ name, userRole, priority = 'normal' }) => {
  let roleMessage = '';
  
  switch (userRole) {
    case 'CA-Admin':
      roleMessage = 'As a CA Administrator, you can manage your firm, invite employees, and oversee client work.';
      break;
    case 'CA-Employee':
      roleMessage = 'As a CA Employee, you can work on assigned tasks and collaborate with your team.';
      break;
    case 'Client':
      roleMessage = 'As a Client, you can upload documents, track task progress, and download completed work.';
      break;
    default:
      roleMessage = 'Welcome to our secure document management platform.';
  }

  const welcomeActionUrl = userRole === 'Client'
    ? `${frontendOrigin}${AUTH_ROUTES.PORTAL_LOGIN}`
    : `${frontendOrigin}${CA_ADMIN_ROUTES.DASHBOARD}`;
  const welcomeActionLabel = userRole === 'Client' ? 'Login to Portal' : 'Go to Dashboard';

  const content = `
    <p style="margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">Welcome to CA-Workflow! We're excited to have you on board.</p>
    <p style="margin:0 0 16px;">${roleMessage}</p>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">🚀 Getting Started:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
        <li>Complete your profile setup</li>
        <li>Explore the dashboard</li>
        <li>Upload your first document</li>
        <li>Contact support if you need help</li>
      </ul>
    </div>
    <p style="margin:0;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
  `;

  return baseTemplate({
    title: 'Welcome to CA-Workflow!',
    content,
    actionUrl: welcomeActionUrl,
    actionLabel: welcomeActionLabel,
    priority
  });
};

/**
 * Task notification template
 */
const taskNotificationEmailTemplate = ({ name, taskTitle, taskStatus, message, priority = 'normal' }) => {
  const statusConfig = {
    pending: { icon: '⏳', color: '#f59e0b', bg: '#fef3c7' },
    'in-progress': { icon: '🔄', color: '#0ea5e9', bg: '#f0f9ff' },
    completed: { icon: '✅', color: '#10b981', bg: '#f0fdf4' },
    cancelled: { icon: '❌', color: '#ef4444', bg: '#fef2f2' }
  };

  const config = statusConfig[taskStatus] || statusConfig.pending;

  const content = `
    <p style="margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;">There's an update on your task: <strong>${taskTitle}</strong></p>
    <div style="background:${config.bg};border-left:4px solid ${config.color};padding:20px;border-radius:6px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600;">
        ${config.icon} Status: ${taskStatus.charAt(0).toUpperCase() + taskStatus.slice(1)}
      </p>
      ${message ? `<p style="margin:0;font-size:14px;line-height:1.6;">${message}</p>` : ''}
    </div>
  `;

  return baseTemplate({
    title: 'Task Update',
    content,
    actionUrl: `${frontendOrigin}${CA_ADMIN_ROUTES.DASHBOARD}`,
    actionLabel: 'View Task',
    priority
  });
};

/**
 * Document request template
 */
const documentRequestEmailTemplate = ({ name, taskTitle, requiredDocuments, priority = 'high' }) => {
  const documentList = requiredDocuments.map(doc => `<li>${doc}</li>`).join('');

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
    actionUrl: `${frontendOrigin}${CLIENT_PORTAL_ROUTES.DOCUMENTS}`,
    actionLabel: 'Upload Documents',
    priority
  });
};

/**
 * Client welcome email template (with credentials)
 */
const clientWelcomeEmailTemplate = ({ companyName, userId, password, loginUrl, priority = 'high' }) => {
  const content = `
    <p style="margin:0 0 16px;">Hello,</p>
    <p style="margin:0 0 16px;">Welcome to CA-Workflow! <strong>${companyName}</strong> has created an account for you.</p>
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
    title: 'Welcome to CA-Workflow',
    content,
    actionUrl: loginUrl || `${frontendOrigin}${AUTH_ROUTES.PORTAL_LOGIN}`,
    actionLabel: 'Login Now',
    priority
  });
};

module.exports = {
  baseTemplate,
  paymentNotificationTemplate,
  threadNotificationTemplate,
  documentNotificationTemplate,
  subscriptionNotificationTemplate,
  loginNotificationTemplate,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
  taskNotificationEmailTemplate,
  documentRequestEmailTemplate,
  clientWelcomeEmailTemplate
};

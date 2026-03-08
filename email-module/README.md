# 📧 Reusable Email Module

A **standalone, provider-agnostic email module** for Node.js applications. Supports 4 email providers with identical APIs, 11 responsive HTML email templates, an event-driven notification system, and middleware for email verification.

> Extracted and refactored from a production Express.js application for drop-in reuse.

---

## 📁 Folder Structure

```
email-module/
├── config/                          # Provider configuration classes
│   ├── smtp.js                      # SMTP config (Nodemailer) — default
│   ├── resend.js                    # Resend API config
│   ├── brevo.js                     # Brevo (Sendinblue) API config
│   └── mailersend.js                # MailerSend API config
│
├── providers/                       # Provider service implementations
│   ├── SmtpProvider.js              # SMTP via Nodemailer
│   ├── ResendProvider.js            # Resend API
│   ├── BrevoProvider.js             # Brevo API
│   └── MailerSendProvider.js        # MailerSend API
│
├── templates/                       # Email HTML templates
│   ├── baseTemplate.js              # Shared layout wrapper
│   ├── verificationEmail.js         # Email verification
│   ├── passwordResetEmail.js        # Password reset
│   ├── welcomeEmail.js              # Welcome / onboarding
│   ├── credentialsEmail.js          # Account credentials delivery
│   ├── taskNotificationEmail.js     # Task status updates
│   ├── documentRequestEmail.js      # Document request
│   ├── paymentNotificationEmail.js  # Payment success/failure
│   ├── threadNotificationEmail.js   # Thread/conversation updates
│   ├── documentNotificationEmail.js # Document upload notifications
│   ├── subscriptionNotificationEmail.js # Subscription status
│   ├── loginNotificationEmail.js    # Login activity alerts
│   └── index.js                     # Template barrel export
│
├── middleware/                      # Express middleware
│   └── requireEmailVerified.js      # Require verified email
│
├── EmailService.js                  # Main service (high-level API)
├── NotificationEmailService.js      # Event-driven notification dispatcher
├── index.js                         # Public API barrel export
├── .env.example                     # Environment variable reference
├── test-integration.js              # Integration test script
├── package.json                     # Dependencies
└── README.md                        # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Core (SMTP — works out of the box)
npm install nodemailer dotenv

# Optional providers (install only what you need)
npm install resend            # Resend
npm install @getbrevo/brevo   # Brevo
npm install mailersend        # MailerSend
```

### 2. Configure Environment

Copy `.env.example` and fill in your provider credentials:

```bash
cp email-module/.env.example .env
```

### 3. Use in Your Project

```javascript
const { createEmailService } = require('./email-module');

// Create with SMTP (default)
const emailService = createEmailService();

// Or specify a provider
const emailService = createEmailService('resend');
const emailService = createEmailService('brevo');
const emailService = createEmailService('mailersend');
```

### 4. Send Emails

```javascript
// Verification email
await emailService.sendVerificationEmail('user@example.com', 'John', 'abc123token');

// Password reset
await emailService.sendPasswordResetEmail('user@example.com', 'John', 'resetToken');

// Welcome email
await emailService.sendWelcomeEmail('user@example.com', 'John', 'Admin');

// Task notification
await emailService.sendTaskNotificationEmail(
  'user@example.com', 'John', 'Q4 Filing', 'in-progress', 'Processing your documents.'
);

// Document request
await emailService.sendDocumentRequestEmail(
  'user@example.com', 'John', 'GST Return', ['Bank Statements', 'Invoices']
);

// Credentials delivery
await emailService.sendCredentialsEmail({
  email: 'client@example.com',
  companyName: 'Acme Corp',
  userId: 'user123',
  password: 'tempPass',
  firmName: 'Smith & Associates'
});

// Email with attachment
await emailService.sendEmailWithAttachment(
  'user@example.com', 'John', 'Invoice', 'Please find attached.', '/path/to/file.pdf', 'invoice.pdf'
);

// Raw email
await emailService.sendEmail('user@example.com', 'Subject', '<p>HTML body</p>');
```

---

## 🔄 Switching Providers

All providers share the **exact same API**. Switch by changing one argument:

```javascript
// Method 1: Factory function
const emailService = createEmailService('brevo');

// Method 2: Direct import
const SmtpProvider = require('./email-module/providers/SmtpProvider');
const emailService = new SmtpProvider();
```

---

## 📋 Shared API (All Providers)

| Method | Signature |
|--------|-----------|
| `sendEmail` | `(to, subject, html, attachments?)` |
| `sendVerificationEmail` | `(email, name, verificationToken)` |
| `sendPasswordResetEmail` | `(email, name, resetToken)` |
| `sendWelcomeEmail` | `(email, name, userRole?)` |
| `sendTaskNotificationEmail` | `(email, name, taskTitle, taskStatus, message?)` |
| `sendDocumentRequestEmail` | `(email, name, taskTitle, requiredDocuments?)` |
| `sendCredentialsEmail` | `({ email, companyName, userId, password, firmName })` |
| `sendEmailWithAttachment` | `(email, name, subject, message, attachmentPath, attachmentName)` |
| `testConfiguration` | `(testEmail?)` |

---

## 🔔 Notification Dispatcher

For event-driven systems, use `NotificationEmailService`:

```javascript
const { NotificationEmailService } = require('./email-module');

const notifier = new NotificationEmailService(emailService, {
  getUserInfo: async (userId) => {
    const user = await db.users.findById(userId);
    return { email: user.email, name: user.name };
  }
});

// Dispatch based on notification type
await notifier.send({
  type: 'payment',              // payment | thread | document | subscription | login
  subtype: 'payment_received',
  priority: 'high',
  recipientId: 'user123',
  title: 'Payment Received',
  message: 'Payment of ₹5,000 received.',
  metadata: { amount: 500000, clientName: 'Acme Corp' },
  actionUrl: '/payments/123'
});
```

---

## 🛡️ Email Verification Middleware

```javascript
const { requireEmailVerified } = require('./email-module/middleware/requireEmailVerified');

// Protect routes that require verified email
app.get('/api/documents', authMiddleware, requireEmailVerified, documentsHandler);
```

---

## 🎨 Customizing Templates

Templates are individual files in `templates/`. Each exports a function that receives data and returns HTML:

```javascript
const { templates } = require('./email-module');

// Use a template directly
const html = templates.verificationEmail({ name: 'John', verificationUrl: 'https://...' });
```

To customize branding, edit `templates/baseTemplate.js` — it controls:
- Header (logo, app name, tagline)
- Color scheme (primary color, backgrounds)
- Footer (copyright, disclaimers)
- Mobile responsiveness

---

## 🔧 Provider Comparison

| Feature | SMTP (Nodemailer) | Resend | Brevo | MailerSend |
|---------|-------------------|--------|-------|------------|
| **Free Tier** | Your SMTP server | 3K/month | 300/day | 3K/month |
| **Setup** | Low | Low | Medium | Low |
| **Deliverability** | Varies | High | High | High |
| **Attachments** | ✅ | ✅ | ✅ | ✅ |
| **Analytics** | ❌ | ✅ | ✅ | ✅ |
| **Webhooks** | ❌ | ✅ | ✅ | ✅ |
| **npm Package** | nodemailer | resend | @getbrevo/brevo | mailersend |

---

## 📝 Environment Variables

See `.env.example` for the complete reference. Only configure the provider you are using.

---

## 🧪 Testing

```bash
# Run the integration test
node email-module/test-integration.js your-email@example.com
```

---

## 📄 License

MIT — use freely in any project.

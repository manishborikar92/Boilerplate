# Email Provider Architecture

## Overview

CA-Flow supports **2 email providers**, each implemented as a standalone **config + service** pair — the same pattern used by `config/twilio.js` + `services/twilioService.js` and `config/razorpay.js` + `services/razorpayService.js`.

Both services export **identical method signatures**, so swapping is a simple `require()` change.

**Current Active Provider:** Resend (`services/resendService.js`)

---

## File Structure

```
server/src/
├── config/
│   ├── twilio.js           # (existing) Twilio client setup
│   ├── razorpay.js         # (existing) Razorpay client setup
│   └── resend.js           # Resend client setup
│
├── services/
│   ├── twilioService.js    # (existing) SMS/WhatsApp service
│   ├── razorpayService.js  # (existing) Payment service
│   ├── emailService.js     # SMTP email (fallback, uses Nodemailer)
│   └── resendService.js    # Resend email (active)
│
├── utils/
│   └── email.js            # Email utility helpers (uses resendService)
│
└── templates/
    └── email/
        └── notificationEmail.js  # Shared HTML templates
```

---

## How to Switch Providers

To use a different email provider, change the `require()` in the files that import the email service:

```javascript
// Current (Resend — active provider)
const emailService = require('../services/resendService');

// Alternative: SMTP via Nodemailer (fallback)
const emailService = require('../services/emailService');
```

### Files that import emailService:
| File | Current Provider |
|------|------------------|
| `src/utils/email.js` | `require('../services/resendService')` |
| `src/services/emailNotificationService.js` | `require('./resendService')` |
| `src/controllers/clientController.js` | `require('../services/resendService')` |

---

## Environment Variables

### Resend (Active)
```bash
npm install resend
```
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM=CA-Flow <no-reply@your-verified-domain.com>
```

### SMTP (Fallback — no extra install needed)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="CA-Flow" <no-reply@ca-flow.com>
```

---

## Shared API (both services)

Every service exports a **singleton instance** with these methods:

| Method | Signature |
|--------|-----------|
| `sendEmail` | `(to, subject, html, attachments?)` |
| `sendVerificationEmail` | `(email, name, verificationToken)` |
| `sendPasswordResetEmail` | `(email, name, resetToken)` |
| `sendWelcomeEmail` | `(email, name, userRole?)` |
| `sendTaskNotificationEmail` | `(email, name, taskTitle, taskStatus, message?)` |
| `sendDocumentRequestEmail` | `(email, name, taskTitle, requiredDocuments?)` |
| `sendClientWelcomeEmail` | `({ email, companyName, userId, password, firmName })` |
| `sendEmailWithAttachment` | `(email, name, subject, message, attachmentPath, attachmentName)` |
| `testConfiguration` | `(testEmail?)` |

---

## Provider Comparison

| Feature | SMTP (Nodemailer) | Resend |
|---------|-------------------|--------|
| **Pricing** | Free (your SMTP) | 3K free/month |
| **Setup** | Low | Low |
| **Deliverability** | Varies | High |
| **Attachments** | ✅ | ✅ |
| **Analytics** | ❌ | ✅ |
| **Webhooks** | ❌ | ✅ |
| **npm Package** | nodemailer (included) | resend |
| **Domain Verification** | Not required | Required |

---

## Pattern Reference

The config + service pattern is the same used across the project:

| Config | Service | External SDK |
|--------|---------|-------------|
| `config/twilio.js` | `services/twilioService.js` | `twilio` |
| `config/razorpay.js` | `services/razorpayService.js` | `razorpay` |
| `config/resend.js` | `services/resendService.js` | `resend` |
| N/A | `services/emailService.js` | `nodemailer` |

---

## Why Resend?

- **Better deliverability** - Professional email infrastructure
- **Simple API** - No SMTP configuration needed
- **Built-in analytics** - Track opens, clicks, bounces
- **Better error handling** - Clear error messages and logging
- **Verified domain** - Professional sender reputation
- **Generous free tier** - 3,000 emails/month free

## Fallback to SMTP

SMTP via Nodemailer is kept as a fallback option for:
- Development/testing without API keys
- Self-hosted email servers
- Situations where external email services are not available

# Server Scripts Directory

This directory contains essential utility scripts for CA-Flow server setup, maintenance, and testing.

---

## 📋 Production Scripts (Critical)

### 1. create_razorpay_plans.js ⭐
**Purpose:** Creates subscription plans in Razorpay and updates .env file

**When to use:**
- Initial setup (first time)
- Switching from Test to Live mode
- Creating new Razorpay account

**Usage:**
```bash
node scripts/create_razorpay_plans.js
```

**What it does:**
1. Creates 3 subscription plans in Razorpay (Monthly, Quarterly, Half-Yearly)
2. Automatically updates `.env` file with plan IDs
3. Displays plan IDs for verification

**Output:**
- Updates `RAZORPAY_PLAN_MONTHLY_ID`
- Updates `RAZORPAY_PLAN_QUARTERLY_ID`
- Updates `RAZORPAY_PLAN_HALFYEARLY_ID`

---

### 2. seed-subscription-plans.js ⭐
**Purpose:** Seeds database with subscription plans

**When to use:**
- After creating Razorpay plans
- After database reset
- Initial setup

**Usage:**
```bash
node scripts/seed-subscription-plans.js
```

**What it does:**
1. Clears existing plans from database
2. Creates 3 subscription plan records
3. Links them to Razorpay plan IDs from .env

**Requirements:**
- Run `create_razorpay_plans.js` first
- Valid MongoDB connection

---

### 3. fix-customer-ids.js ⭐
**Purpose:** Fixes invalid Razorpay customer IDs in database

**When to use:**
- After switching Razorpay accounts
- When getting "The id provided does not exist" errors
- After clearing Razorpay test data

**Usage:**
```bash
node scripts/fix-customer-ids.js
```

**What it does:**
1. Finds all firms with stored customer IDs
2. Verifies each customer exists in Razorpay
3. Clears invalid customer IDs
4. Reports summary of fixes

**Safe to run:** Yes, only clears invalid IDs

---

### 4. generate-jwt-secrets.js ⭐
**Purpose:** Generates secure JWT secrets for authentication

**When to use:**
- Initial setup
- Security breach (regenerate secrets)
- Moving to production

**Usage:**
```bash
node scripts/generate-jwt-secrets.js
```

**What it does:**
1. Generates cryptographically secure random secrets
2. Updates `.env` file with new secrets
3. Asks for confirmation before updating

**Warning:** Regenerating secrets will invalidate all existing tokens

---

### 5. migrate-to-production.js ⭐
**Purpose:** Migrates data from test database to production database

**When to use:**
- Moving from test to production
- Database consolidation

**Usage:**
```bash
node scripts/migrate-to-production.js
```

**What it does:**
1. Connects to MongoDB cluster
2. Copies all collections from `test` to `caflow_db`
3. Uses server-side aggregation for speed

**Warning:** Review data before migration. Indexes are not copied.

---

## 🧪 Testing & Verification Scripts

### 6. test-subscription-flow.js
**Purpose:** Comprehensive verification of subscription configuration

**When to use:**
- After setup
- Troubleshooting subscription issues
- Before deployment

**Usage:**
```bash
node scripts/test-subscription-flow.js
```

**What it checks:**
- ✅ Plans exist in database
- ✅ Plans have valid Razorpay plan IDs
- ✅ Environment variables are set
- ✅ Razorpay credentials configured

**Exit codes:**
- 0: All checks passed
- 1: Some checks failed

---

### 7. test-razorpay-integration.js
**Purpose:** Tests Razorpay API integration

**When to use:**
- After configuring Razorpay credentials
- Troubleshooting payment issues
- Verifying API connectivity

**Usage:**
```bash
node scripts/test-razorpay-integration.js
```

**What it tests:**
- ✅ Environment variables
- ✅ Razorpay SDK initialization
- ✅ Order creation
- ✅ Plan creation
- ✅ Signature verification

---

### 8. test-email-integration.js
**Purpose:** Tests email service integration

**When to use:**
- After configuring email settings
- Troubleshooting email delivery
- Testing email templates

**Usage:**
```bash
node scripts/test-email-integration.js [email@example.com]
```

**What it tests:**
- ✅ Email configuration
- ✅ Verification emails
- ✅ Password reset emails
- ✅ Welcome emails
- ✅ Task notification emails
- ✅ Document request emails

**Note:** Provide test email as argument or it uses default

---

### 9. test-twilio-integration.js
**Purpose:** Tests Twilio SMS and WhatsApp notification functionality

**When to use:**
- After configuring Twilio credentials
- Troubleshooting SMS/WhatsApp delivery
- Testing notification formatting
- Verifying subscription enforcement

**Usage:**
```bash
npm run test-twilio
# or
node scripts/test-twilio-integration.js
```

**What it tests:**
- ✅ Twilio configuration (Account SID, Auth Token)
- ✅ SMS sending functionality
- ✅ WhatsApp sending functionality
- ✅ Message formatting (SMS vs WhatsApp)
- ✅ Subscription service integration
- ✅ Notification channel permissions

**Prerequisites:**
- Twilio account credentials in `.env`
- Test phone number configured (`TEST_PHONE_NUMBER`)
- For WhatsApp: Joined sandbox (development)

**Environment Variables Required:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
TEST_PHONE_NUMBER=+919876543210
```

---

## 🧹 Maintenance Scripts

### 10. cleanup-razorpay-plans.js
**Purpose:** Identifies old/test plans in Razorpay

**When to use:**
- After multiple test runs
- Cleaning up Razorpay dashboard
- Identifying unused plans

**Usage:**
```bash
node scripts/cleanup-razorpay-plans.js
```

**What it does:**
1. Fetches all plans from Razorpay
2. Compares with active plan IDs in .env
3. Lists plans that can be deactivated

**Note:** Razorpay doesn't allow deletion, only deactivation via dashboard

---

## 📖 Quick Reference

### Initial Setup Workflow
```bash
# 1. Create Razorpay plans
node scripts/create_razorpay_plans.js

# 2. Seed database
node scripts/seed-subscription-plans.js

# 3. Verify setup
node scripts/test-subscription-flow.js

# 4. Test Razorpay integration
node scripts/test-razorpay-integration.js
```

### Troubleshooting Workflow
```bash
# 1. Check subscription configuration
node scripts/test-subscription-flow.js

# 2. Fix invalid customer IDs
node scripts/fix-customer-ids.js

# 3. Verify Razorpay connection
node scripts/test-razorpay-integration.js
```

### Production Deployment Workflow
```bash
# 1. Generate production JWT secrets
node scripts/generate-jwt-secrets.js

# 2. Create Live mode Razorpay plans
# (Update .env with Live keys first)
node scripts/create_razorpay_plans.js

# 3. Seed production database
node scripts/seed-subscription-plans.js

# 4. Migrate data if needed
node scripts/migrate-to-production.js

# 5. Verify everything
node scripts/test-subscription-flow.js
```

---

## 🔧 Environment Variables Required

Most scripts require these environment variables in `.env`:

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Razorpay Plan IDs (auto-updated by create_razorpay_plans.js)
RAZORPAY_PLAN_MONTHLY_ID=plan_...
RAZORPAY_PLAN_QUARTERLY_ID=plan_...
RAZORPAY_PLAN_HALFYEARLY_ID=plan_...

# JWT (auto-updated by generate-jwt-secrets.js)
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Email (for test-email-integration.js)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=...
EMAIL_PASS=...

# Twilio (for test-twilio-integration.js)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
TEST_PHONE_NUMBER=+919876543210
```

---

## 📝 Notes

### Test vs Live Mode
- **Test Mode:** Use `rzp_test_...` keys for development
- **Live Mode:** Use `rzp_live_...` keys for production
- Plans must be created separately for each mode

### Database Safety
- All scripts are safe to run multiple times
- `seed-subscription-plans.js` clears existing plans before seeding
- `fix-customer-ids.js` only clears invalid IDs
- `migrate-to-production.js` copies data (doesn't delete source)

### Error Handling
- Scripts exit with code 0 on success
- Scripts exit with code 1 on failure
- Detailed error messages are logged to console

---

## 🆘 Common Issues

### "The id provided does not exist"
**Solution:** Run `fix-customer-ids.js`

### "Plan not found or inactive"
**Solution:** Run `seed-subscription-plans.js`

### "Razorpay not configured"
**Solution:** Check `.env` has valid Razorpay keys

### "No plans found in database"
**Solution:** Run `create_razorpay_plans.js` then `seed-subscription-plans.js`

---

**Last Updated:** February 4, 2026  
**Scripts Count:** 10 essential scripts

# Cloudflare DNS Setup for Vaelix.in

## Overview

This guide configures your Cloudflare DNS to work with Coolify on Oracle Cloud.

**Prerequisites:**
- ✅ Completed [ORACLE-SETUP.md](ORACLE-SETUP.md)
- ✅ ARM instance running with Coolify
- ✅ ARM instance public IP address

**Time:** 30 minutes (testing) + 10 minutes (production switch)

---

## Your Current Cloudflare Setup

```
vaelix.in
├── A record: vaelix.in → 216.198.79.1 (Vercel)
├── CNAME: www → Vercel
├── MX records: Zoho Mail (keep these!)
└── TXT records: Resend, SPF, DKIM (keep these!)
```

## Your Target Setup

```
vaelix.in
├── A record: vaelix.in → <ARM_IP> (Oracle Cloud)
├── A record: * → <ARM_IP> (wildcard for all subdomains)
├── MX records: Zoho Mail (unchanged)
└── TXT records: Resend, SPF, DKIM (unchanged)
```

**Result:**
- `vaelix.in` → Your main website on Coolify
- `app.vaelix.in` → Your app on Coolify
- `api.vaelix.in` → Your API on Coolify
- Any subdomain → Coolify
- Email continues to work

---

#### Phase 3: Full Migration (After Testing)

**Update DNS records in Cloudflare:**

1. **Update root domain A record:**
   - Click **Edit** on `vaelix.in` A record
   - Change IPv4 address to: `<ARM_PUBLIC_IP>`
   - Change Proxy status to: **DNS only** (gray cloud)
   - Click **Save**

2. **Update www CNAME record:**
   - Click **Edit** on `www` CNAME record
   - Change Target to: `vaelix.in`
   - Change Proxy status to: **DNS only** (gray cloud)
   - Click **Save**

3. **Add wildcard A record:**
   - Click **Add record**
   - Type: `A`
   - Name: `*`
   - IPv4 address: `<ARM_PUBLIC_IP>`
   - Proxy status: **DNS only** (gray cloud)
   - TTL: Auto
   - Click **Save**

4. **Keep all MX and TXT records unchanged** (email will continue working)

**Result:**
- `vaelix.in` → Coolify (your main website)
- `www.vaelix.in` → Coolify (your main website)
- `app.vaelix.in` → Coolify (your app frontend)
- `dashboard.vaelix.in` → Coolify (your dashboard frontend)
- `auth.vaelix.in` → Coolify (your auth frontend)
- `api.vaelix.in` → Coolify (your API backend)
- `backend.vaelix.in` → Coolify (your backend services)
- `*.vaelix.in` → Coolify (any subdomain)
- Email continues to work (Zoho Mail + Resend)

**Pros:**
- ✅ Clean URLs (no extra subdomain levels)
- ✅ Full control over domain
- ✅ Unlimited subdomains
- ✅ Email continues to work
- ✅ All on Oracle Cloud ($0/month)

**Cons:**
- ⚠️ Requires migrating Vercel site to Coolify first
- ⚠️ Brief downtime during DNS switch (5-10 minutes)

## Detailed Migration Steps

### Step 1: Wait for ARM Instance Creation

Hunter Bot is currently creating your ARM instance. Wait for:
```
[########################] SUCCESS!!!! [########################]
```

Then get your ARM instance public IP from OCI Console.

### Step 2: Setup ARM Instance with Coolify

Run the setup script:

```powershell
.\scripts\setup-arm-instance.ps1 -ArmIP <ARM_PUBLIC_IP>
```

This will:
- Configure iptables firewall
- Install Docker
- Install Coolify
- Start Coolify on port 8000

### Step 3: Add Test DNS Record

In Cloudflare, add a test record:

1. Click **Add record**
2. Type: `A`
3. Name: `test`
4. IPv4 address: `<ARM_PUBLIC_IP>`
5. Proxy status: **DNS only** (gray cloud)
6. TTL: Auto
7. Click **Save**

Wait 2-5 minutes for DNS propagation.

### Step 4: Configure Coolify

1. Open: `http://<ARM_PUBLIC_IP>:8000`
2. Create admin account
3. Go to **Servers** → **localhost**
4. Set **Wildcard Domain**: `vaelix.in`
5. Click **Save**

### Step 5: Test Deployment

Deploy a test application:

1. Go to **Projects** → **+ New Project**
2. Name: `Test Project`
3. Click **+ New Resource** → **Public Repository**
4. Enter a simple repository (or use Coolify's example)
5. Configure:
   - Name: `test-app`
   - Domain: `https://test.vaelix.in`
   - Build Pack: Nixpacks
6. Click **Deploy**

Wait 3-5 minutes. Then visit `https://test.vaelix.in` - it should work with SSL!

### Step 6: Deploy Your Main Website

**Option A: Deploy from GitHub**

1. Push your current Vercel site to GitHub (if not already)
2. In Coolify, click **+ New Resource** → **Private Repository**
3. Select your GitHub repository
4. Configure:
   - Name: `vaelix-main`
   - Domains: `https://vaelix-staging.in` (use staging first!)
   - Build Pack: Nixpacks (auto-detects Next.js, React, etc.)
   - Environment Variables: Add any needed variables
5. Click **Deploy**

**Option B: Deploy Static Site**

If your site is static HTML/CSS/JS:

1. Click **+ New Resource** → **Public Repository**
2. Enter your repository URL
3. Configure:
   - Name: `vaelix-main`
   - Domain: `https://vaelix-staging.in`
   - Build Pack: Static
4. Click **Deploy**

### Step 7: Deploy Backend Services

Deploy your API and backend services:

**API Backend:**
1. Click **+ New Resource** → **Private Repository**
2. Select your API repository
3. Configure:
   - Name: `vaelix-api`
   - Domain: `https://api-staging.vaelix.in` (staging first!)
   - Build Pack: Nixpacks
   - Environment Variables: Database URLs, API keys, etc.
4. Click **Deploy**

**Other Services:**
- Deploy each service with staging domains first
- Test thoroughly
- Verify all services communicate correctly

### Step 8: Deploy Databases (If Needed)

If you need databases:

1. Go to **Databases** → **+ New Database**
2. Select database type (PostgreSQL, MySQL, MongoDB, Redis)
3. Configure:
   - Name: `vaelix-db`
   - Version: Latest
   - Username: `vaelix`
   - Password: Auto-generated (save this!)
4. Click **Deploy**

Get connection string and add to your application's environment variables.

### Step 9: Test Everything on Staging

Before switching DNS:

1. Test all staging URLs work:
   - `https://vaelix-staging.in`
   - `https://api-staging.vaelix.in`
   - etc.

2. Test all functionality:
   - User authentication
   - API calls
   - Database connections
   - File uploads
   - Email sending (if applicable)

3. Check performance:
   - Page load times
   - API response times
   - Database queries

### Step 10: Update Production Domains

Once everything works on staging, update to production domains:

1. In Coolify, go to each application
2. Click **Domains** tab
3. Add production domains:
   - Main site: `https://vaelix.in` and `https://www.vaelix.in`
   - App: `https://app.vaelix.in`
   - Dashboard: `https://dashboard.vaelix.in`
   - Auth: `https://auth.vaelix.in`
   - API: `https://api.vaelix.in`
4. Click **Save**

Coolify will generate SSL certificates for all domains (takes 2-3 minutes).

### Step 11: Switch DNS to Coolify

**⚠️ This is the critical step - brief downtime expected**

In Cloudflare:

1. **Update root domain:**
   - Edit `vaelix.in` A record
   - Change IP to: `<ARM_PUBLIC_IP>`
   - Proxy status: **DNS only** (gray cloud)
   - Save

2. **Update www:**
   - Edit `www` CNAME
   - Target: `vaelix.in`
   - Proxy status: **DNS only** (gray cloud)
   - Save

3. **Add wildcard:**
   - Add new A record
   - Name: `*`
   - IP: `<ARM_PUBLIC_IP>`
   - Proxy status: **DNS only** (gray cloud)
   - Save

4. **Delete test record:**
   - Delete `test.vaelix.in` A record

### Step 12: Verify Everything Works

Wait 5-10 minutes for DNS propagation, then test:

```powershell
# Test DNS resolution
nslookup vaelix.in
nslookup www.vaelix.in
nslookup app.vaelix.in
nslookup api.vaelix.in
```

All should return your ARM instance IP.

**Test in browser:**
- `https://vaelix.in` - Main website
- `https://www.vaelix.in` - Main website
- `https://app.vaelix.in` - App frontend
- `https://dashboard.vaelix.in` - Dashboard
- `https://auth.vaelix.in` - Auth
- `https://api.vaelix.in` - API

All should work with SSL certificates!

### Step 13: Test Email Still Works

Send a test email to verify Zoho Mail still works:

```bash
# Send test email to your Zoho email
echo "Test email" | mail -s "Test" your-email@vaelix.in
```

Or use your email client to send/receive emails.

### Step 14: Clean Up

1. **Delete staging applications** in Coolify (optional)
2. **Cancel Vercel subscription** (if paid)
3. **Update DNS TTL** to longer values (optional, for stability)
4. **Set up monitoring** in Coolify
5. **Configure backups** for databases

## Your Deployment Architecture

### Final URL Structure

**Frontend Applications (Clean URLs):**
```
https://vaelix.in              → Main website
https://www.vaelix.in          → Main website (same as above)
https://app.vaelix.in          → App frontend
https://dashboard.vaelix.in    → Dashboard frontend
https://auth.vaelix.in         → Auth frontend
```

**Backend Services (Any pattern):**
```
https://api.vaelix.in          → API backend
https://backend.vaelix.in      → Backend services
https://api-v2.vaelix.in       → API v2 (if needed)
https://webhooks.vaelix.in     → Webhook handlers
```

**Databases (Internal only):**
```
postgresql://localhost:5432    → PostgreSQL
redis://localhost:6379         → Redis
mongodb://localhost:27017      → MongoDB
```

**Email Services (Unchanged):**
```
SMTP: smtp.zoho.in             → Zoho Mail (outgoing)
IMAP: imap.zoho.in             → Zoho Mail (incoming)
API: api.resend.com            → Resend (transactional)
```

### Example Full-Stack Deployment

**Scenario:** You have a SaaS application with:
- Marketing website (Next.js)
- Web app (React)
- Dashboard (React)
- Auth service (Node.js)
- API backend (Node.js/Express)
- PostgreSQL database
- Redis cache

**Coolify Configuration:**

1. **Main Website** (`vaelix.in`)
   - Repository: `github.com/yourusername/vaelix-website`
   - Build Pack: Nixpacks (auto-detects Next.js)
   - Domains: `https://vaelix.in`, `https://www.vaelix.in`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=https://api.vaelix.in
     NEXT_PUBLIC_APP_URL=https://app.vaelix.in
     ```

2. **Web App** (`app.vaelix.in`)
   - Repository: `github.com/yourusername/vaelix-app`
   - Build Pack: Nixpacks (auto-detects React)
   - Domain: `https://app.vaelix.in`
   - Environment Variables:
     ```
     REACT_APP_API_URL=https://api.vaelix.in
     REACT_APP_AUTH_URL=https://auth.vaelix.in
     ```

3. **Dashboard** (`dashboard.vaelix.in`)
   - Repository: `github.com/yourusername/vaelix-dashboard`
   - Build Pack: Nixpacks (auto-detects React)
   - Domain: `https://dashboard.vaelix.in`
   - Environment Variables:
     ```
     REACT_APP_API_URL=https://api.vaelix.in
     ```

4. **Auth Service** (`auth.vaelix.in`)
   - Repository: `github.com/yourusername/vaelix-auth`
   - Build Pack: Nixpacks (auto-detects Node.js)
   - Domain: `https://auth.vaelix.in`
   - Environment Variables:
     ```
     DATABASE_URL=postgresql://vaelix:password@localhost:5432/vaelix
     REDIS_URL=redis://localhost:6379
     JWT_SECRET=your-secret-key
     ```

5. **API Backend** (`api.vaelix.in`)
   - Repository: `github.com/yourusername/vaelix-api`
   - Build Pack: Nixpacks (auto-detects Node.js/Express)
   - Domain: `https://api.vaelix.in`
   - Environment Variables:
     ```
     DATABASE_URL=postgresql://vaelix:password@localhost:5432/vaelix
     REDIS_URL=redis://localhost:6379
     AUTH_SERVICE_URL=https://auth.vaelix.in
     RESEND_API_KEY=your-resend-key
     ```

6. **PostgreSQL Database**
   - Type: PostgreSQL
   - Version: Latest
   - Name: `vaelix-db`
   - Connection: `postgresql://vaelix:password@localhost:5432/vaelix`

7. **Redis Cache**
   - Type: Redis
   - Version: Latest
   - Name: `vaelix-redis`
   - Connection: `redis://localhost:6379`

### Resource Allocation

With your ARM instance (4 OCPU, 24 GB RAM, 147 GB storage):

```
Main Website (Next.js):     ~500 MB RAM, ~1 GB storage
Web App (React):            ~300 MB RAM, ~500 MB storage
Dashboard (React):          ~300 MB RAM, ~500 MB storage
Auth Service (Node.js):     ~200 MB RAM, ~500 MB storage
API Backend (Node.js):      ~500 MB RAM, ~1 GB storage
PostgreSQL:                 ~1 GB RAM, ~10 GB storage
Redis:                      ~100 MB RAM, ~500 MB storage
Coolify Platform:           ~500 MB RAM, ~2 GB storage

Total Used:                 ~3.4 GB RAM, ~16.5 GB storage
Remaining:                  ~20.6 GB RAM, ~130.5 GB storage

Capacity for more apps:     ✅ Plenty!
```

### SSL/TLS Mode

**Important:** Cloudflare proxy (orange cloud) requires specific SSL/TLS settings.

1. Go to Cloudflare Dashboard → SSL/TLS
2. Set SSL/TLS encryption mode:
   - **Full (strict)** - Recommended (Coolify provides valid SSL)
   - **Full** - Also works
   - **Flexible** - NOT recommended (insecure)

### Proxy Status

**For Coolify to work properly:**
- Set proxy status to **DNS only** (gray cloud) for Coolify records
- This allows Coolify to manage SSL certificates directly via Let's Encrypt

**Why DNS only?**
- Coolify needs to verify domain ownership for Let's Encrypt
- Cloudflare proxy can interfere with SSL certificate generation
- Direct connection allows Coolify's reverse proxy to work correctly

**If you want Cloudflare proxy benefits:**
- Use Cloudflare Origin Certificates instead of Let's Encrypt
- Configure Coolify to use Cloudflare's origin certificate
- More complex setup, not recommended for beginners

## Quick Setup Summary

### When ARM Instance is Created

```powershell
# 1. Setup ARM instance with Coolify
.\scripts\setup-arm-instance.ps1 -ArmIP <ARM_PUBLIC_IP>

# 2. Add test DNS record in Cloudflare
# test.vaelix.in → <ARM_IP> (DNS only, gray cloud)

# 3. Access Coolify
# http://<ARM_IP>:8000

# 4. Configure Coolify
# Set wildcard domain: vaelix.in

# 5. Deploy test app to test.vaelix.in
# Verify SSL works

# 6. Deploy all your applications with staging domains
# vaelix-staging.in, api-staging.vaelix.in, etc.

# 7. Test everything thoroughly

# 8. Update production domains in Coolify
# vaelix.in, app.vaelix.in, api.vaelix.in, etc.

# 9. Switch DNS in Cloudflare
# vaelix.in → <ARM_IP> (DNS only)
# *.vaelix.in → <ARM_IP> (DNS only)

# 10. Verify everything works!
```

### Timeline

- ARM instance setup: 10 minutes
- Test deployment: 10 minutes
- Deploy all applications: 30-60 minutes
- Testing: 30-60 minutes
- DNS switch: 10 minutes
- **Total: 2-3 hours for complete migration**

### Cost Comparison

**Before (Vercel + Zoho + Resend):**
```
Vercel Pro: $20/month (if needed)
Zoho Mail: $0/month (free tier)
Resend: $0/month (free tier)
Total: $0-20/month
```

**After (Oracle Cloud + Zoho + Resend):**
```
Oracle ARM Instance: $0/month (Always Free)
Coolify: $0/month (Open source)
Zoho Mail: $0/month (unchanged)
Resend: $0/month (unchanged)
Total: $0/month ✅
```

**Annual Savings:** $0-240/year (if you were on Vercel Pro)

## Email Considerations

### Keep Email Working

**Important:** Do NOT modify these records:
- MX records (mx3.zoho.in, mx2.zoho.in, mx.zoho.in)
- TXT records for SPF, DKIM, DMARC
- TXT records for Resend verification

Email will continue to work regardless of which option you choose.

### If You Need to Send Email from Coolify Apps

**Option 1: Use Resend (Already configured)**
```javascript
// In your Coolify app
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({
  from: 'noreply@vaelix.in',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Email content</p>'
});
```

**Option 2: Use Zoho SMTP**
```javascript
// SMTP configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true,
  auth: {
    user: 'your-email@vaelix.in',
    pass: 'your-password'
  }
});
```

## Troubleshooting

### SSL Certificate Generation Fails

**Problem:** Coolify can't generate Let's Encrypt certificate

**Solution:**
1. Verify DNS points to ARM instance: `nslookup your-domain.com`
2. Ensure Cloudflare proxy is **disabled** (gray cloud)
3. Check ports 80 and 443 are open in OCI Security List
4. Check iptables allows ports 80 and 443
5. Wait 5-10 minutes for DNS propagation
6. Retry SSL generation in Coolify

### Cloudflare Shows "Error 521"

**Problem:** Cloudflare can't connect to origin server

**Solution:**
1. Disable Cloudflare proxy (gray cloud)
2. Or ensure ARM instance is accessible on ports 80/443
3. Check OCI Security List and iptables

### Email Stops Working

**Problem:** Email not being received

**Solution:**
1. Verify MX records are unchanged
2. Check TXT records for SPF, DKIM, DMARC
3. Test email: https://mxtoolbox.com/
4. Contact Zoho support if needed

## Summary

**Your Goal:**
- Clean frontend URLs: `vaelix.in`, `app.vaelix.in`, `dashboard.vaelix.in`
- Backend URLs: `api.vaelix.in`, `backend.vaelix.in` (any pattern)
- Keep email working: Zoho Mail + Resend

**Solution:**
- Full migration to Coolify on Oracle Cloud ARM instance
- Gradual deployment with staging → production
- Zero cost: $0/month forever

**Timeline:**
- Wait for ARM instance creation (Hunter Bot handles this)
- Setup and testing: 2-3 hours
- Full migration complete

**Next Steps:**
1. Wait for ARM instance creation
2. Follow the 14-step migration process above
3. Test thoroughly on staging domains
4. Switch DNS to production
5. Enjoy your self-hosted platform!

---

**Need Help?** See [ARM-SETUP.md](ARM-SETUP.md) for complete Coolify setup guide.

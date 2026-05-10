# Coolify Setup - Deploy Your Websites and Apps

## Overview

This guide shows you how to deploy your websites, apps, and backends using Coolify.

**Prerequisites:**
- ✅ Completed [ORACLE-SETUP.md](ORACLE-SETUP.md)
- ✅ Completed [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md)
- ✅ Coolify dashboard accessible
- ✅ DNS configured and working

**Time:** 10-30 minutes per application

---

## Part 1: Connect GitHub

### Step 1.1: Add GitHub Source

**In Coolify:**

1. Go to **Sources** (left sidebar)
2. Click **+ Add**
3. Select **GitHub**
4. Choose **System Wide** (recommended)
5. Click **Save**

### Step 1.2: Authorize Coolify

1. Click **Register Now**
2. You'll be redirected to GitHub
3. Click **Authorize Coolify**
4. Select repositories to grant access (or select all)
5. Click **Install**

**You're redirected back to Coolify.**

**Time:** 3 minutes

---

## Part 2: Deploy Your Main Website

### Step 2.1: Create Project

**In Coolify:**

1. Go to **Projects** (left sidebar)
2. Click **+ New Project**
3. Name: `Vaelix Main`
4. Description: `Main website` (optional)
5. Click **Create**

### Step 2.2: Add Application

1. Click **+ New Resource**
2. Select **Private Repository** (or Public if your repo is public)
3. Select your website repository from the dropdown
4. Click **Continue**

### Step 2.3: Configure Application

**Basic Settings:**
- **Name:** `vaelix-main`
- **Branch:** `main` (or your default branch)
- **Build Pack:** Nixpacks (auto-detects Next.js, React, Vue, etc.)

**Domains:**
- Add: `https://vaelix.in`
- Add: `https://www.vaelix.in`
- Click **+** to add multiple domains

**Port:** (usually auto-detected)
- Next.js: 3000
- React/Vue: 3000
- Static: 80

**Environment Variables:** (if needed)
```
NEXT_PUBLIC_API_URL=https://api.vaelix.in
NODE_ENV=production
```

Click **Deploy**

### Step 2.4: Wait for Deployment

**What happens:**
1. Coolify clones your repository
2. Detects your framework (Next.js, React, etc.)
3. Installs dependencies
4. Builds your application
5. Creates Docker container
6. Generates SSL certificates
7. Starts your application

**Time:** 5-10 minutes (first deployment)

**Watch the logs in real-time.**

### Step 2.5: Verify Deployment

**When deployment completes:**

1. Visit `https://vaelix.in`
2. Visit `https://www.vaelix.in`

**You should see:** Your website with SSL certificate! ✅

---

## Part 3: Deploy App Frontend

### Step 3.1: Add New Resource

**In your project:**

1. Click **+ New Resource**
2. Select **Private Repository**
3. Select your app repository
4. Click **Continue**

### Step 3.2: Configure App

**Basic Settings:**
- **Name:** `vaelix-app`
- **Branch:** `main`
- **Build Pack:** Nixpacks

**Domains:**
- Add: `https://app.vaelix.in`

**Environment Variables:**
```
REACT_APP_API_URL=https://api.vaelix.in
REACT_APP_AUTH_URL=https://auth.vaelix.in
```

Click **Deploy**

### Step 3.3: Verify

Visit `https://app.vaelix.in` ✅

---

## Part 4: Deploy API Backend

### Step 4.1: Add API Resource

1. Click **+ New Resource**
2. Select your API repository
3. Click **Continue**

### Step 4.2: Configure API

**Basic Settings:**
- **Name:** `vaelix-api`
- **Branch:** `main`
- **Build Pack:** Nixpacks

**Domains:**
- Add: `https://api.vaelix.in`

**Environment Variables:**
```
DATABASE_URL=postgresql://vaelix:password@localhost:5432/vaelix
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
RESEND_API_KEY=your-resend-key
NODE_ENV=production
```

Click **Deploy**

### Step 4.3: Verify

Test API endpoint:
```powershell
curl https://api.vaelix.in/health
```

Should return: `{"status":"ok"}` ✅

---

## Part 5: Deploy Database

### Step 5.1: Create Database

**In Coolify:**

1. Go to **Databases** (left sidebar)
2. Click **+ New Database**
3. Select database type:
   - **PostgreSQL** (recommended for most apps)
   - MySQL
   - MongoDB
   - Redis

### Step 5.2: Configure Database

**For PostgreSQL:**
- **Name:** `vaelix-db`
- **Version:** Latest (16.x)
- **Database Name:** `vaelix`
- **Username:** `vaelix`
- **Password:** Auto-generated (save this!)

Click **Deploy**

**Time:** 2-3 minutes

### Step 5.3: Get Connection String

**After deployment:**

1. Click on your database
2. Copy **Connection String**:
   ```
   postgresql://vaelix:password@localhost:5432/vaelix
   ```

### Step 5.4: Update API Environment Variables

1. Go to your API application
2. Click **Environment Variables** tab
3. Update `DATABASE_URL` with the connection string
4. Click **Save**
5. Click **Restart** to apply changes

---

## Part 6: Deploy Additional Services

### Dashboard

**Configure:**
- Name: `vaelix-dashboard`
- Domain: `https://dashboard.vaelix.in`
- Environment Variables:
  ```
  REACT_APP_API_URL=https://api.vaelix.in
  ```

### Auth Service

**Configure:**
- Name: `vaelix-auth`
- Domain: `https://auth.vaelix.in`
- Environment Variables:
  ```
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  ```

### Redis Cache

**In Databases:**
1. Click **+ New Database**
2. Select **Redis**
3. Name: `vaelix-redis`
4. Click **Deploy**

**Connection:** `redis://localhost:6379`

---

## Part 7: Setup Auto-Deploy from GitHub

### Step 7.1: Verify Webhook

Coolify automatically sets up GitHub webhooks during first deployment.

**Verify:**
1. Go to your GitHub repository
2. Settings → Webhooks
3. You should see Coolify webhook with green checkmark ✅

### Step 7.2: Test Auto-Deploy

1. Make a change to your code
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Test auto-deploy"
   git push
   ```
3. Watch Coolify automatically rebuild and redeploy

**Time:** 3-5 minutes per deployment

---

## Part 8: Manage Your Applications

### View Logs

**In Coolify:**

1. Go to your application
2. Click **Logs** tab
3. See real-time logs

**Or via SSH:**
```bash
ssh ubuntu@<ARM_IP>
docker logs <container-name> -f
```

### Restart Application

1. Go to application
2. Click **Actions** → **Restart**

### Update Environment Variables

1. Go to application
2. Click **Environment Variables** tab
3. Add/edit variables
4. Click **Save**
5. Click **Restart** to apply

### Rollback Deployment

1. Go to application
2. Click **Deployments** tab
3. Find previous successful deployment
4. Click **Redeploy**

### Scale Application

**Coolify doesn't support horizontal scaling yet**, but you can:
- Increase ARM instance resources (limited by free tier)
- Optimize your application code
- Use Redis for caching
- Use CDN for static assets

---

## Part 9: Setup Monitoring

### Built-in Monitoring

**In Coolify:**

1. Go to **Servers** → **localhost**
2. View:
   - CPU usage
   - Memory usage
   - Disk usage
   - Network usage

### Application Health Checks

**In your application:**

1. Click **Health Checks** tab
2. Enable health check
3. Set endpoint: `/health` or `/api/health`
4. Set interval: 60 seconds
5. Click **Save**

**Coolify will automatically restart if health check fails.**

### Email Notifications

**In Coolify:**

1. Go to **Settings** → **Notifications**
2. Add email address
3. Enable notifications for:
   - Deployment failures
   - Health check failures
   - Server issues

---

## Part 10: Backup and Security

### Database Backups

**In Coolify:**

1. Go to your database
2. Click **Backup** tab
3. Enable **Automatic Backups**
4. Set frequency: Daily
5. Set retention: 7 days
6. Click **Save**

**Backups are stored on the ARM instance.**

### Manual Backup

```bash
ssh ubuntu@<ARM_IP>
docker exec <postgres-container> pg_dump -U vaelix vaelix > backup.sql
```

### Secure Coolify Dashboard

**Restrict access to port 8000:**

```bash
ssh ubuntu@<ARM_IP>
sudo iptables -D INPUT -p tcp --dport 8000 -j ACCEPT
sudo iptables -I INPUT 1 -s <YOUR_IP>/32 -p tcp --dport 8000 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
```

Replace `<YOUR_IP>` with your home/office IP.

### Enable 2FA (If Available)

Check Coolify settings for 2FA options.

---

## Common Deployment Patterns

### Next.js Application

```
Build Pack: Nixpacks (auto-detects)
Port: 3000
Environment Variables:
  NEXT_PUBLIC_API_URL=https://api.vaelix.in
  NODE_ENV=production
```

### React/Vue SPA

```
Build Pack: Nixpacks (auto-detects)
Port: 3000
Environment Variables:
  REACT_APP_API_URL=https://api.vaelix.in
```

### Node.js/Express API

```
Build Pack: Nixpacks (auto-detects)
Port: 3000 or 8080
Environment Variables:
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  NODE_ENV=production
```

### Static HTML Site

```
Build Pack: Static
Port: 80
No environment variables needed
```

### Docker Compose App

```
Build Pack: Docker Compose
Upload your docker-compose.yml
Configure environment variables
```

---

## Troubleshooting

### Deployment Failed

**Problem:** Build fails with error

**Solution:**
1. Check build logs in Coolify
2. Verify environment variables are set
3. Test build locally:
   ```bash
   npm install
   npm run build
   ```
4. Check Coolify documentation for your framework

### Application Not Accessible

**Problem:** Domain doesn't load

**Solution:**
1. Check DNS: `nslookup your-domain.com`
2. Check application is running in Coolify
3. Check application logs for errors
4. Verify SSL certificate is valid

### SSL Certificate Failed

**Problem:** "SSL certificate generation failed"

**Solution:**
1. Verify DNS points to ARM IP
2. Ensure Cloudflare proxy is **DNS only** (gray cloud)
3. Wait 10 minutes for DNS propagation
4. In Coolify: Application → Actions → Retry SSL

### Database Connection Failed

**Problem:** Application can't connect to database

**Solution:**
1. Verify database is running in Coolify
2. Check connection string is correct
3. Verify database credentials
4. Check application logs for specific error

### Out of Memory

**Problem:** Application crashes with OOM error

**Solution:**
1. Check memory usage in Coolify
2. Optimize your application code
3. Use Redis for caching
4. Consider deleting Hunter Bot for more RAM

### Out of Disk Space

**Problem:** "No space left on device"

**Solution:**
```bash
ssh ubuntu@<ARM_IP>
docker system prune -a --volumes
```

**Warning:** This removes unused containers and images. Backup first!

---

## Resource Usage

### Current Usage

**Check in Coolify:**
- Go to **Servers** → **localhost**
- View resource usage

**Or via SSH:**
```bash
ssh ubuntu@<ARM_IP>
htop  # CPU and RAM
df -h  # Disk space
```

### Estimated Capacity

```
ARM Instance: 4 CPU, 24 GB RAM, 147 GB storage

Typical Usage:
├── Main Website (Next.js): 500 MB RAM, 1 GB storage
├── App Frontend (React): 300 MB RAM, 500 MB storage
├── Dashboard (React): 300 MB RAM, 500 MB storage
├── Auth Service (Node.js): 200 MB RAM, 500 MB storage
├── API Backend (Node.js): 500 MB RAM, 1 GB storage
├── PostgreSQL: 1 GB RAM, 10 GB storage
├── Redis: 100 MB RAM, 500 MB storage
├── Coolify Platform: 500 MB RAM, 2 GB storage
└── Total: ~3.4 GB RAM, ~16.5 GB storage

Remaining: ~20.6 GB RAM, ~130.5 GB storage ✅
```

**You can deploy 10-20 more small applications!**

---

## Summary

**What you accomplished:**
- ✅ Connected GitHub to Coolify
- ✅ Deployed main website to vaelix.in
- ✅ Deployed app to app.vaelix.in
- ✅ Deployed API to api.vaelix.in
- ✅ Deployed database (PostgreSQL)
- ✅ Setup auto-deploy from GitHub
- ✅ All with SSL certificates
- ✅ Cost: $0/month

**Your deployment architecture:**
```
vaelix.in → Main Website (Next.js)
www.vaelix.in → Main Website
app.vaelix.in → App Frontend (React)
dashboard.vaelix.in → Dashboard (React)
auth.vaelix.in → Auth Service (Node.js)
api.vaelix.in → API Backend (Node.js)
Database → PostgreSQL (internal)
Cache → Redis (internal)
```

**All running on Oracle Cloud ARM instance for $0/month!** 🎉

---

## Next Steps

### Optional: Delete Hunter Bot

If you want full 200 GB storage:

```powershell
.\scripts\delete-hunter-resize-arm.ps1 -ArmInstanceId <ARM_INSTANCE_OCID>
```

This gives you +53 GB storage (147 GB → 200 GB).

### Monitor Your Applications

- Check Coolify dashboard daily
- Review application logs
- Monitor resource usage
- Set up email notifications

### Keep Learning

- Coolify Documentation: https://coolify.io/docs
- Deploy more applications
- Experiment with different frameworks
- Share your setup with others!

---

**Congratulations! You now have a production-ready, self-hosted platform!** 🚀

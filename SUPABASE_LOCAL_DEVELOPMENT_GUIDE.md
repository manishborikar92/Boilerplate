# Supabase Local Development Guide
### A Complete Guide to Building Backend Applications with Supabase

> **Version 1.0 · 2024 · Backend Development Team**  
> 100% Free for Local Development · Production-Ready Architecture

---

## Introduction

Supabase is an open-source Firebase alternative that provides a complete backend stack: PostgreSQL database, auto-generated REST and GraphQL APIs, authentication, file storage, and real-time subscriptions. This guide covers everything you need to know to use Supabase effectively in local development and production.

**What makes Supabase different:**

| Traditional Stack | Supabase Stack |
|---|---|
| Express + Manual Routes | Auto-generated REST/GraphQL APIs |
| MongoDB/MySQL + ORM | PostgreSQL with built-in features |
| Custom Auth Logic | Built-in authentication system |
| AWS S3 + Custom Upload Logic | Integrated file storage |
| Socket.io for Real-time | Built-in real-time subscriptions |
| Manual API Documentation | Auto-generated API docs |

**This guide is for you if:**
- You want to build a backend without writing boilerplate code
- You need a PostgreSQL database with instant APIs
- You want authentication and file storage out of the box
- You're building a barber booking, marketplace, or service platform
- You want to prototype quickly and scale later

---

## Table of Contents

1. [Understanding Supabase Architecture](#1-understanding-supabase-architecture)
2. [Local Development Setup](#2-local-development-setup)
3. [Database Design with Supabase](#3-database-design-with-supabase)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Working with APIs](#5-working-with-apis)
6. [File Storage](#6-file-storage)
7. [Real-time Features](#7-real-time-features)
8. [Integration with Express Backend](#8-integration-with-express-backend)
9. [Migration Strategies](#9-migration-strategies)
10. [Deployment & Hosting](#10-deployment--hosting)
11. [Cost Analysis & Pricing](#11-cost-analysis--pricing)
12. [Best Practices](#12-best-practices)

---

# 1. Understanding Supabase Architecture

---

## 1.1 What Is Supabase?

Supabase is a collection of open-source tools wrapped in a unified platform:


```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE STACK                           │
├─────────────────────────────────────────────────────────────┤
│  Studio Dashboard    │  Visual database management UI       │
│  (Port 54323)        │  Table editor, SQL editor, logs      │
├──────────────────────┼──────────────────────────────────────┤
│  PostgREST           │  Auto-generated REST API             │
│  (Port 54321/rest)   │  CRUD operations from database       │
├──────────────────────┼──────────────────────────────────────┤
│  GraphQL             │  Auto-generated GraphQL API          │
│  (Port 54321/graphql)│  Query exactly what you need         │
├──────────────────────┼──────────────────────────────────────┤
│  GoTrue              │  Authentication service              │
│  (Port 54321/auth)   │  JWT tokens, OAuth, magic links      │
├──────────────────────┼──────────────────────────────────────┤
│  Storage API         │  File upload/download service        │
│  (Port 54321/storage)│  S3-compatible object storage        │
├──────────────────────┼──────────────────────────────────────┤
│  Realtime            │  WebSocket server                    │
│  (Port 54321)        │  Database changes, presence, broadcast│
├──────────────────────┼──────────────────────────────────────┤
│  PostgreSQL          │  The actual database                 │
│  (Port 54322)        │  Full Postgres with extensions       │
├──────────────────────┼──────────────────────────────────────┤
│  Mailpit             │  Email testing (dev only)            │
│  (Port 54324)        │  Catch all outgoing emails           │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 Core Components Explained

### Studio Dashboard (http://127.0.0.1:54323)
**What it does**: Visual interface for managing your database

**Use it for**:
- Creating and editing tables without writing SQL
- Viewing and editing data in spreadsheet format
- Running SQL queries with syntax highlighting
- Managing authentication users
- Setting up Row Level Security (RLS) policies
- Viewing API logs and performance metrics

**For your barber app**: Manage bookings, services, and user data visually


### REST API (http://127.0.0.1:54321/rest/v1)
**What it does**: Automatically generates REST endpoints for every table

**How it works**:
```javascript
// Create a booking
POST /rest/v1/bookings
{
  "barber_id": 123,
  "customer_id": 456,
  "service_id": 789,
  "booking_time": "2026-02-24T10:00:00Z"
}

// Get all bookings
GET /rest/v1/bookings

// Get bookings with filters
GET /rest/v1/bookings?barber_id=eq.123&status=eq.confirmed

// Update a booking
PATCH /rest/v1/bookings?id=eq.1
{ "status": "completed" }

// Delete a booking
DELETE /rest/v1/bookings?id=eq.1
```

**Built-in features**:
- Filtering: `?column=eq.value`, `?column=gt.10`, `?column=like.*search*`
- Sorting: `?order=created_at.desc`
- Pagination: `?limit=10&offset=20`
- Relationships: `?select=*,barber(*),service(*)`


### GraphQL API (http://127.0.0.1:54321/graphql/v1)
**What it does**: Query multiple related tables in one request

**Example**:
```graphql
query {
  bookingsCollection {
    edges {
      node {
        id
        booking_time
        status
        barber {
          name
          shop_name
        }
        customer {
          name
          phone
        }
        service {
          name
          price
          duration
        }
      }
    }
  }
}
```

**Use when**: You need to fetch related data and want to avoid multiple API calls

### Authentication (http://127.0.0.1:54321/auth/v1)
**What it does**: Complete user authentication system

**Features**:
- Email/password signup and login
- OAuth providers (Google, Facebook, GitHub, etc.)
- Magic links (passwordless login)
- Phone authentication with OTP
- JWT token management
- Password reset flows


### Storage API (http://127.0.0.1:54321/storage/v1)
**What it does**: File upload and management

**Use cases**:
- Barber profile photos
- Shop images
- Service photos
- Customer avatars
- Portfolio images

**Features**:
- Public and private buckets
- Image transformations (resize, crop)
- Access control with RLS
- CDN integration (production)

### PostgreSQL Database (postgresql://postgres:postgres@127.0.0.1:54322/postgres)
**What it is**: The actual database where all data lives

**Why PostgreSQL**:
- More powerful than MongoDB for complex queries
- Built-in support for relationships (foreign keys)
- ACID compliance (data integrity)
- Full-text search
- JSON support (like MongoDB documents)
- Geospatial queries (for location-based features)
- Triggers and stored procedures


### Mailpit (http://127.0.0.1:54324)
**What it does**: Catches all emails during development

**Use for**:
- Testing password reset emails
- Viewing booking confirmation emails
- Testing verification emails
- No emails sent to real addresses

### MCP Server (http://127.0.0.1:54321/mcp)
**What it does**: Allows Kiro AI to interact with your database

**Benefits**:
- Ask AI to create tables
- Generate SQL queries through conversation
- Debug database issues with AI assistance
- Faster development with AI pair programming

---

# 2. Local Development Setup

---

## 2.1 Prerequisites

Before starting, ensure you have:

```bash
# 1. Docker Desktop (required)
docker --version
# Docker version 20.10.0 or higher

# 2. Supabase CLI
supabase --version
# 2.75.0 or higher
```


## 2.2 Installation Steps

### Step 1: Install Docker Desktop
Download from: https://www.docker.com/products/docker-desktop

### Step 2: Install Supabase CLI

**Windows (Scoop)**:
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Windows (npm)**:
```bash
npm install -g supabase
```

**macOS (Homebrew)**:
```bash
brew install supabase/tap/supabase
```

### Step 3: Initialize Supabase in Your Project

```bash
# Navigate to your project directory
cd your-project

# Initialize Supabase (creates supabase/ folder)
supabase init --yes

# Start Supabase services
supabase start
```

**First run takes 5-10 minutes** (downloads Docker images)


## 2.3 Project Structure

After initialization, you'll have:

```
your-project/
├── supabase/
│   ├── config.toml          # Supabase configuration
│   ├── seed.sql             # Initial data (optional)
│   ├── migrations/          # Database schema versions
│   │   └── 20240101000000_initial_schema.sql
│   └── functions/           # Edge Functions (serverless)
├── .env.local               # Local environment variables
└── your existing files...
```

## 2.4 Environment Variables

Create `.env.local` in your project root:

```env
# Supabase Local Development
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_secret_key_here

# Database Connection (if using direct SQL)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Get your keys**:
```bash
supabase status
```


## 2.5 Common Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Check status and get credentials
supabase status

# Reset database (WARNING: deletes all data)
supabase db reset

# View logs
supabase logs

# Generate TypeScript types from database
supabase gen types typescript --local > types/supabase.ts

# Create a new migration
supabase migration new create_bookings_table

# Apply migrations
supabase db push --local
```

---

# 3. Database Design with Supabase

---

## 3.1 Creating Tables

### Option A: Using Studio Dashboard (Easiest)

1. Open http://127.0.0.1:54323
2. Click "Table Editor" in sidebar
3. Click "New Table"
4. Fill in table details
5. Add columns with types and constraints


### Option B: Using SQL Editor

1. Open Studio → SQL Editor
2. Write your SQL:

```sql
-- Create barbers table
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  bio TEXT,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_bookings INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  booking_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_barber ON bookings(barber_id);
CREATE INDEX idx_bookings_time ON bookings(booking_time);
CREATE INDEX idx_bookings_status ON bookings(status);
```


### Option C: Using Migrations (Recommended for Production)

```bash
# Create a new migration file
supabase migration new create_barber_tables

# Edit the file in supabase/migrations/
# Add your SQL there

# Apply the migration
supabase db reset  # Applies all migrations from scratch
```

## 3.2 Row Level Security (RLS)

RLS ensures users can only access their own data.

```sql
-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view own bookings"
ON bookings FOR SELECT
USING (auth.uid() = customer_id);

-- Policy: Users can create their own bookings
CREATE POLICY "Users can create bookings"
ON bookings FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Policy: Barbers can view their bookings
CREATE POLICY "Barbers can view their bookings"
ON bookings FOR SELECT
USING (
  barber_id IN (
    SELECT id FROM barbers WHERE user_id = auth.uid()
  )
);
```


---

# 4. Authentication & Authorization

---

## 4.1 User Signup

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Sign up a new user
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
  options: {
    data: {
      role: 'customer',  // Custom metadata
      name: 'John Doe'
    }
  }
});
```

## 4.2 User Login

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure_password'
});

// Access token
const token = data.session.access_token;
```

## 4.3 Getting Current User

```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log(user.id, user.email, user.user_metadata);
```


---

# 5. Working with APIs

---

## 5.1 Using Supabase Client (Recommended)

```javascript
// Insert data
const { data, error } = await supabase
  .from('bookings')
  .insert({
    customer_id: user.id,
    barber_id: 'barber-uuid',
    service_id: 'service-uuid',
    booking_time: '2026-02-24T10:00:00Z'
  });

// Query data
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    barber:barbers(*),
    service:services(*)
  `)
  .eq('customer_id', user.id)
  .order('booking_time', { ascending: false });

// Update data
const { data, error } = await supabase
  .from('bookings')
  .update({ status: 'confirmed' })
  .eq('id', bookingId);

// Delete data
const { data, error } = await supabase
  .from('bookings')
  .delete()
  .eq('id', bookingId);
```


---

# 8. Integration with Express Backend

---

## 8.1 Hybrid Architecture (Recommended)

Keep Express for business logic, use Supabase for data:

```javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Use service role for backend
);

// Custom booking logic in Express
app.post('/api/bookings', async (req, res) => {
  try {
    // Your custom validation
    if (!isValidBookingTime(req.body.time)) {
      return res.status(400).json({ error: 'Invalid time' });
    }

    // Check barber availability (custom logic)
    const isAvailable = await checkBarberAvailability(
      req.body.barber_id,
      req.body.time
    );

    if (!isAvailable) {
      return res.status(409).json({ error: 'Barber not available' });
    }

    // Use Supabase for database operation
    const { data, error } = await supabase
      .from('bookings')
      .insert(req.body)
      .select();

    if (error) throw error;

    // Send confirmation email (custom logic)
    await sendBookingConfirmation(data[0]);

    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```


---

# 10. Deployment & Hosting

---

## 10.1 Local Development (100% Free)

Everything runs on your computer:
- ✅ No cost
- ✅ No internet required (after setup)
- ✅ Unlimited database size
- ✅ Unlimited API requests
- ✅ Perfect for development and testing

## 10.2 Production Options

### Option A: Supabase Cloud (Easiest)

**Free Tier**:
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth/month
- 50,000 monthly active users
- Perfect for starting out

**Paid Plans**:
- Pro: $25/month (8 GB database, 100 GB bandwidth)
- Team: $599/month
- Enterprise: Custom

**Deployment**:
```bash
# Link to Supabase Cloud project
supabase link --project-ref your-project-id

# Push your local schema to cloud
supabase db push
```


### Option B: Self-Hosted (Advanced)

Deploy Supabase to your own server:
- ✅ Full control
- ✅ Potentially cheaper at scale
- ❌ You manage everything (updates, backups, security)
- ❌ Requires DevOps knowledge

**Platforms**:
- DigitalOcean ($6/month VPS)
- AWS, Google Cloud, Azure
- Your own VPS

### Option C: Keep MongoDB (No Change)

Use Supabase only for local development:
- Keep your existing MongoDB + Express setup for production
- Use Supabase locally for faster development
- No production costs

---

# 11. Cost Analysis & Pricing

---

## 11.1 Cost Comparison

| Scenario | Supabase Free | Supabase Pro | Self-Hosted | MongoDB Atlas |
|---|---|---|---|---|
| Database | 500 MB | 8 GB | Unlimited | 512 MB free |
| Bandwidth | 2 GB/month | 100 GB/month | Unlimited | 10 GB/month |
| Users | 50K MAU | Unlimited | Unlimited | Unlimited |
| Cost | $0 | $25/month | $6-50/month | $0-57/month |
| Management | Managed | Managed | You manage | Managed |


## 11.2 When to Upgrade

Stay on free tier if:
- < 500 MB database
- < 50K monthly active users
- < 2 GB bandwidth/month
- Testing or small projects

Upgrade to Pro ($25/month) when:
- Database > 500 MB
- Need more bandwidth
- Want daily backups
- Need email support

---

# 12. Best Practices

---

## 12.1 Security

✅ **DO**:
- Always enable RLS on tables
- Use service role key only in backend
- Use anon key in frontend
- Validate all inputs
- Use HTTPS in production

❌ **DON'T**:
- Expose service role key in frontend
- Disable RLS without good reason
- Store sensitive data in user_metadata
- Trust client-side validation alone

## 12.2 Performance

✅ **DO**:
- Add indexes on frequently queried columns
- Use select() to fetch only needed columns
- Implement pagination for large datasets
- Cache frequently accessed data

❌ **DON'T**:
- Fetch all columns with `select('*')` unnecessarily
- Query without indexes on large tables
- Make N+1 queries (use joins instead)


## 12.3 Development Workflow

```bash
# 1. Start Supabase
supabase start

# 2. Make schema changes in Studio or SQL editor

# 3. Generate a migration
supabase db diff --local | supabase migration new my_changes

# 4. Test your changes

# 5. Commit migration files to git
git add supabase/migrations/
git commit -m "Add bookings table"

# 6. Deploy to production
supabase db push
```

## 12.4 Backup Strategy

**Local Development**:
```bash
# Dump database
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres > backup.sql

# Restore database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < backup.sql
```

**Production**:
- Supabase Cloud: Automatic daily backups (Pro plan)
- Self-hosted: Set up pg_dump cron jobs

---

# Quick Reference

---

## Essential URLs (Local)

```
Studio:     http://127.0.0.1:54323
REST API:   http://127.0.0.1:54321/rest/v1
GraphQL:    http://127.0.0.1:54321/graphql/v1
Auth:       http://127.0.0.1:54321/auth/v1
Storage:    http://127.0.0.1:54321/storage/v1
Database:   postgresql://postgres:postgres@127.0.0.1:54322/postgres
Mailpit:    http://127.0.0.1:54324
```


## Essential Commands

```bash
# Start/Stop
supabase start
supabase stop

# Status & Credentials
supabase status

# Database
supabase db reset                    # Reset database
supabase db diff --local             # Show schema changes
supabase migration new <name>        # Create migration
supabase db push                     # Apply migrations

# Types
supabase gen types typescript --local > types/supabase.ts

# Logs
supabase logs
```

## Common Patterns

### Create + Read + Update + Delete

```javascript
// CREATE
const { data } = await supabase.from('table').insert({ ... });

// READ
const { data } = await supabase.from('table').select('*');

// UPDATE
const { data } = await supabase.from('table').update({ ... }).eq('id', id);

// DELETE
const { data } = await supabase.from('table').delete().eq('id', id);
```

### Filtering

```javascript
.eq('column', value)           // Equal
.neq('column', value)          // Not equal
.gt('column', value)           // Greater than
.gte('column', value)          // Greater than or equal
.lt('column', value)           // Less than
.lte('column', value)          // Less than or equal
.like('column', '%pattern%')   // Pattern matching
.in('column', [val1, val2])    // In array
.is('column', null)            // Is null
```


### Relationships

```javascript
// One-to-many
const { data } = await supabase
  .from('bookings')
  .select(`
    *,
    barber:barbers(name, shop_name),
    service:services(name, price)
  `);

// Many-to-many (through junction table)
const { data } = await supabase
  .from('products')
  .select(`
    *,
    product_tags(
      tag:tags(name)
    )
  `);
```

---

## Decision Framework

### Should I Use Supabase?

**YES, if you want**:
- ✅ Rapid prototyping
- ✅ Auto-generated APIs
- ✅ Built-in authentication
- ✅ PostgreSQL database
- ✅ Real-time features
- ✅ Less boilerplate code

**MAYBE, if you need**:
- ⚠️ Complex business logic (use Express + Supabase)
- ⚠️ Third-party integrations (use Express + Supabase)
- ⚠️ Custom middleware (use Express + Supabase)

**NO, if you require**:
- ❌ Complete control over every aspect
- ❌ Non-PostgreSQL database (MongoDB, etc.)
- ❌ Existing large codebase migration


### Supabase vs Traditional Stack

| Feature | Traditional | Supabase |
|---|---|---|
| Database Setup | Manual | Automatic |
| API Creation | Write routes manually | Auto-generated |
| Authentication | Custom implementation | Built-in |
| File Upload | Custom S3 integration | Built-in storage |
| Real-time | Socket.io setup | Built-in |
| API Documentation | Manual (Swagger) | Auto-generated |
| Development Speed | Slower | Faster |
| Learning Curve | Lower (familiar) | Medium (new concepts) |
| Flexibility | High | Medium-High |
| Cost (Local) | $0 | $0 |
| Cost (Production) | Variable | $0-25/month |

---

## Troubleshooting

### Supabase won't start

```bash
# Check Docker is running
docker ps

# Stop all containers and restart
supabase stop --all
supabase start
```

### Can't connect to database

```bash
# Check status
supabase status

# Verify port 54322 is not in use
netstat -an | findstr 54322
```

### Migration errors

```bash
# Reset database (WARNING: deletes data)
supabase db reset

# Or fix migration file and reapply
```

---

## Additional Resources

- Official Docs: https://supabase.com/docs
- GitHub: https://github.com/supabase/supabase
- Discord Community: https://discord.supabase.com
- Examples: https://github.com/supabase/supabase/tree/master/examples

---

**End of Guide**

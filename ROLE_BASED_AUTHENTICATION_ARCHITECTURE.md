# Role-Based Authentication Architecture
### A Deep-Dive Guide to Multi-Role Systems, Schema Design, and Scalable Access Control

> **Version 1.0 · 2024 · Senior Backend Architecture Team**  
> Covers simple admin/user systems through complex multi-persona platforms

---

## Introduction

Most tutorials teach role-based authentication as a binary: you are either a `user` or an `admin`. This works for a blog dashboard. It fails completely for a hospital platform where doctors, patients, nurses, receptionists, and billing staff all log into the same system with entirely different interfaces, permissions, and data visibility rules.

This guide covers the full spectrum — from simple two-role systems to complex multi-persona platforms where different types of users occupy fundamentally different roles in the same product ecosystem.

**Real-world systems this guide addresses:**

| Platform Type | Role A | Role B | Role C |
|---|---|---|---|
| Healthcare | Patient | Doctor | Nurse / Receptionist |
| Legal / Finance | Company / Client | CA / Lawyer | Internal Staff |
| Marketplace | Buyer | Seller | Moderator |
| Salon / Booking | Customer | Stylist / Provider | Salon Owner |
| Education | Student | Teacher | Institution Admin |
| Real Estate | Buyer/Tenant | Agent | Property Manager |
| Logistics | Shipper | Driver | Dispatcher |

The challenge in these systems is not just "what can this user do" but "who is this user, in what context, and what version of the application are they even using?"

---

## Table of Contents

1. [The Role Architecture Spectrum](#1-the-role-architecture-spectrum)
2. [Database Schema Design](#2-database-schema-design)
3. [Route Structure for Multi-Role Systems](#3-route-structure-for-multi-role-systems)
4. [Authentication Flow by Role Type](#4-authentication-flow-by-role-type)
5. [Middleware Architecture](#5-middleware-architecture)
6. [Real-World Case Studies](#6-real-world-case-studies)
7. [Scalability & Future-Proofing](#7-scalability--future-proofing)
8. [Decision Framework](#8-decision-framework)

---

# 1. The Role Architecture Spectrum

Before designing anything, you must identify which type of role system your application requires. These are fundamentally different architectures — not just different configurations of the same pattern.

---

## 1.1 The Five Role Architecture Types

### Type 1 — Single Role Flag

One user type, one optional elevated flag. The simplest possible system.

```
┌──────────────────────────────┐
│           USERS              │
│                              │
│  regular user ─── is_admin   │
│                    (boolean) │
└──────────────────────────────┘
```

**Use when:** Admin panel for a content site, internal tool with occasional superusers.  
**Breaks when:** You need more than two distinct permission profiles.

---

### Type 2 — Enum Role Column

One user type with a role field that can hold one of several values.

```
┌──────────────────────────────────────┐
│                USERS                 │
│                                      │
│  role: ENUM('user','editor','admin') │
└──────────────────────────────────────┘
```

**Use when:** A single application with 2–5 clearly distinct access levels that share the same identity model.  
**Breaks when:** Roles need different profile data (a doctor needs `specialty`, a patient needs `medical_record_number` — these do not belong in the same table).

---

### Type 3 — Roles Table (RBAC)

Users are assigned one or more roles from a separate roles table. Roles carry permissions.

```
┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────────┐
│  USERS   │───►│  USER_ROLES  │◄───│  ROLES   │───►│ ROLE_PERMS  │
│          │    │  user_id     │    │  id      │    │ role_id     │
│  id      │    │  role_id     │    │  name    │    │ permission  │
│  email   │    └──────────────┘    │  slug    │    └─────────────┘
│  password│                        └──────────┘
└──────────┘
```

**Use when:** SaaS platforms where users can have multiple roles, or where roles need to be created/modified at runtime by administrators.  
**Breaks when:** Different roles have fundamentally different identity profiles (different personal data, different relationships to other entities).

---

### Type 4 — Persona-Based (Separate Profile Tables)

The core identity (credentials) is shared, but each role type has its own profile table with role-specific data. This is the correct model for patient–doctor, buyer–seller, and similar systems.

```
                    ┌─────────────────┐
                    │  USERS (core)   │
                    │  id             │
                    │  email          │
                    │  password_hash  │
                    │  role_type      │
                    └────────┬────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
    ┌────────▼──────┐  ┌────▼────────┐  ┌──▼────────────┐
    │ PATIENT_PROFS │  │ DOCTOR_PROFS│  │  STAFF_PROFS  │
    │ user_id (FK)  │  │ user_id(FK) │  │  user_id (FK) │
    │ date_of_birth │  │ license_no  │  │  department   │
    │ blood_type    │  │ specialty   │  │  access_level │
    │ insurance_id  │  │ clinic_id   │  │               │
    └───────────────┘  └─────────────┘  └───────────────┘
```

**Use when:** Different user types have genuinely different data structures, different relationships to other entities, or different UI experiences.  
**Use for:** Healthcare, legal platforms, marketplaces, service booking apps.

---

### Type 5 — Multi-Tenant with Per-Tenant Roles

Users belong to organizations (tenants), and their roles are scoped to that organization. A user can be an `ADMIN` in Company A and a `MEMBER` in Company B simultaneously.

```
┌──────────┐    ┌─────────────────────┐    ┌─────────────┐
│  USERS   │    │  ORGANIZATION_USERS │    │    ORGS     │
│  id      │───►│  user_id            │◄───│  id         │
│  email   │    │  org_id             │    │  name       │
│  password│    │  role (scoped here) │    │  plan       │
└──────────┘    └─────────────────────┘    └─────────────┘
```

**Use when:** B2B SaaS products (Slack, Notion, GitHub Teams model).  
**Use for:** Any platform where users can be members of multiple organizations with different roles in each.

---

## 1.2 Choosing the Right Type

```
Does your system have organizations/tenants?
├── YES ──────────────────────────────────────► Type 5 (Multi-Tenant)
└── NO
    │
    Do different roles have different profile data?
    ├── YES ──────────────────────────────────► Type 4 (Persona-Based)
    └── NO
        │
        Do roles need to be created/modified at runtime?
        ├── YES ──────────────────────────────► Type 3 (RBAC with Roles Table)
        └── NO
            │
            More than 2 roles?
            ├── YES ──────────────────────────► Type 2 (Enum Role Column)
            └── NO ───────────────────────────► Type 1 (Single Flag)
```

> **CRITICAL INSIGHT:** The most common architectural mistake is starting with Type 1 or Type 2 when the system actually requires Type 4. Adding role-specific profile data to a single-table design later is expensive and painful. Choose your type based on the most complex role in your system, not the simplest.

---

# 2. Database Schema Design

---

## 2.1 Schema Design: Type 2 — Enum Role Column

The simplest viable schema for multi-role systems. Appropriate for systems where all users share the same profile data structure.

```sql
-- Core users table
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'USER'
                CHECK (role IN ('USER', 'EDITOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')),
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_users_email   ON users(email);
CREATE INDEX idx_users_role    ON users(role);
CREATE INDEX idx_users_active  ON users(is_active) WHERE deleted_at IS NULL;
```

**Limitations:** Adding a new role requires a schema migration. All roles share the same profile fields. Roles cannot be assigned dynamically.

---

## 2.2 Schema Design: Type 3 — Full RBAC

Roles and permissions are entities in the database. Role assignment is a relationship, not a column value.

```sql
-- Core users table (no role column — role is a relationship)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(100),
    last_name     VARCHAR(100),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- Roles are defined in the database, not in code enums
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,   -- e.g. 'Content Editor'
    slug        VARCHAR(100) UNIQUE NOT NULL,   -- e.g. 'content_editor'
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE, -- system roles cannot be deleted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular permissions
CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(200) UNIQUE NOT NULL,   -- e.g. 'articles:publish'
    description TEXT,
    category    VARCHAR(100)                   -- e.g. 'content', 'users', 'billing'
);

-- Many-to-many: roles have permissions
CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Many-to-many: users have roles
CREATE TABLE user_roles (
    user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,    -- optional: temporary role assignments
    PRIMARY KEY (user_id, role_id)
);

-- Seed data: system roles
INSERT INTO roles (name, slug, is_system) VALUES
    ('Super Admin',  'super_admin',  TRUE),
    ('Admin',        'admin',        TRUE),
    ('Manager',      'manager',      TRUE),
    ('User',         'user',         TRUE);

-- Seed data: permissions
INSERT INTO permissions (key, category) VALUES
    ('users:read',         'users'),
    ('users:write',        'users'),
    ('users:delete',       'users'),
    ('roles:assign',       'users'),
    ('content:read',       'content'),
    ('content:write',      'content'),
    ('content:publish',    'content'),
    ('content:delete',     'content'),
    ('reports:read',       'reports'),
    ('billing:read',       'billing'),
    ('billing:manage',     'billing');
```

**How to query a user's full permissions:**

```sql
SELECT DISTINCT p.key
FROM users u
JOIN user_roles ur        ON u.id = ur.user_id
JOIN role_permissions rp  ON ur.role_id = rp.role_id
JOIN permissions p        ON rp.permission_id = p.id
WHERE u.id = $1
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  AND u.deleted_at IS NULL;
```

> **PERFORMANCE NOTE:** Cache this permission set in Redis (keyed by `user:{id}:permissions`, TTL 5–15 minutes). Recomputing it on every request is expensive and unnecessary.

---

## 2.3 Schema Design: Type 4 — Persona-Based (The Most Important Pattern)

This is the correct schema for systems where different user types are fundamentally different actors in the business domain. Do not fight the domain model by cramming all roles into one table.

### The Core Principle: Shared Identity, Separate Profiles

```sql
-- ─────────────────────────────────────────────────────────
-- CORE IDENTITY TABLE (authentication only)
-- Knows nothing about what kind of user this is
-- ─────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_type     VARCHAR(50) NOT NULL
                  CHECK (role_type IN ('PATIENT', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMIN')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────
-- PATIENT PROFILE (only exists for role_type = 'PATIENT')
-- ─────────────────────────────────────────────────────────
CREATE TABLE patient_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    date_of_birth       DATE NOT NULL,
    gender              VARCHAR(20),
    blood_type          VARCHAR(5),
    medical_record_no   VARCHAR(50) UNIQUE,
    insurance_provider  VARCHAR(100),
    insurance_policy_no VARCHAR(100),
    emergency_contact   JSONB,
    allergies           TEXT[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- DOCTOR PROFILE (only exists for role_type = 'DOCTOR')
-- ─────────────────────────────────────────────────────────
CREATE TABLE doctor_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    license_number  VARCHAR(100) UNIQUE NOT NULL,
    specialty       VARCHAR(100) NOT NULL,
    department_id   UUID REFERENCES departments(id),
    qualifications  TEXT[],
    accepting_patients BOOLEAN NOT NULL DEFAULT TRUE,
    consultation_fee   NUMERIC(10,2),
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- STAFF PROFILE (nurses, receptionists — shared structure)
-- ─────────────────────────────────────────────────────────
CREATE TABLE staff_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    employee_id     VARCHAR(50) UNIQUE NOT NULL,
    department_id   UUID REFERENCES departments(id),
    shift           VARCHAR(20) CHECK (shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- APPOINTMENTS (the core domain relationship)
-- Both sides use their user_id (foreign key to users table)
-- ─────────────────────────────────────────────────────────
CREATE TABLE appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id UUID NOT NULL REFERENCES users(id),
    doctor_user_id  UUID NOT NULL REFERENCES users(id),
    scheduled_at    TIMESTAMPTZ NOT NULL,
    duration_mins   INTEGER NOT NULL DEFAULT 30,
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments(patient_user_id);
CREATE INDEX idx_appointments_doctor  ON appointments(doctor_user_id);
CREATE INDEX idx_appointments_status  ON appointments(status);
CREATE INDEX idx_appointments_date    ON appointments(scheduled_at);
```

---

## 2.4 Schema Design: Type 5 — Multi-Tenant with Scoped Roles

Used when users belong to organizations and their role is defined within that membership context.

```sql
-- Core users (no role column — role is always scoped to an org)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(200),
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations (tenants)
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    plan        VARCHAR(50) NOT NULL DEFAULT 'FREE'
                CHECK (plan IN ('FREE','STARTER','PRO','ENTERPRISE')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization membership with scoped role
-- A user can be ADMIN in Org A and MEMBER in Org B simultaneously
CREATE TABLE organization_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL DEFAULT 'MEMBER'
                CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER', 'BILLING')),
    invited_by  UUID REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- Organization-scoped permissions (optional fine-grained layer)
CREATE TABLE org_member_permissions (
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    permission    VARCHAR(200) NOT NULL,
    granted_by    UUID REFERENCES users(id),
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, user_id, permission)
);

-- Resources are always scoped to an org
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**How authorization works in multi-tenant:** Every protected query must scope to both the authenticated user AND the active organization.

```sql
-- Check if user has ADMIN or OWNER role in org before performing an action:
SELECT role FROM organization_members
WHERE user_id = $1 AND org_id = $2;

-- All resource queries are automatically org-scoped:
SELECT * FROM projects
WHERE org_id = $1   -- from session/token context
  AND id = $2;      -- from request params
```

---

## 2.5 Refresh Tokens & Sessions Schema

Regardless of which role architecture you use, token management requires its own table.

```sql
-- Refresh token store (for JWT-based systems)
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL, -- store hashed, never raw
    family_id       UUID NOT NULL,   -- token family for rotation theft detection
    device_info     JSONB,           -- optional: user agent, IP, device name
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_rt_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_rt_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_rt_family     ON refresh_tokens(family_id);
CREATE INDEX idx_rt_expires    ON refresh_tokens(expires_at);

-- Token rotation theft detection:
-- If a refresh token is used but it's already been superseded in its family,
-- immediately revoke ALL tokens in that family (entire family was compromised)
```

---

## 2.6 Audit Log Schema

For any system with multiple roles — especially regulated ones (healthcare, finance, legal) — an immutable audit log is essential.

```sql
CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    role_type    VARCHAR(50),
    action       VARCHAR(200) NOT NULL,  -- e.g. 'appointment:create', 'user:login'
    resource     VARCHAR(100),           -- e.g. 'appointment', 'patient_profile'
    resource_id  UUID,
    ip_address   INET,
    user_agent   TEXT,
    metadata     JSONB,                  -- additional context, old/new values
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs are append-only — no UPDATE or DELETE permissions on this table
CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);
CREATE INDEX idx_audit_resource   ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
```

---

# 3. Route Structure for Multi-Role Systems

---

## 3.1 Route Architecture Patterns

There are three ways to structure routes in a multi-role system. Each is correct in different contexts.

### Pattern A: Role-Namespaced Routes (Recommended for Most Systems)

Routes are organized by role prefix. Each prefix is protected by role-specific authentication middleware.

```
/api/v1/auth/*                   ← Public: login, register, refresh, logout

/api/v1/patient/*                ← PATIENT role only
/api/v1/doctor/*                 ← DOCTOR role only
/api/v1/staff/*                  ← NURSE, RECEPTIONIST roles
/api/v1/admin/*                  ← ADMIN, SUPER_ADMIN roles

/api/v1/shared/*                 ← Any authenticated user (cross-role resources)
```

**Advantages:** Clear separation; easy to audit which routes each role can access; middleware is applied at the namespace level, not per-route.

```
Auth Middleware (applies to all /api/v1/* except /auth/*)
    │
    ├── /patient/*  ──► requireRole('PATIENT') ──► Patient Controllers
    ├── /doctor/*   ──► requireRole('DOCTOR')  ──► Doctor Controllers
    ├── /staff/*    ──► requireAnyRole(['NURSE','RECEPTIONIST']) ──► Staff Controllers
    └── /admin/*    ──► requireRole('ADMIN')   ──► Admin Controllers
```

---

### Pattern B: Shared Routes with In-Handler Role Branching

All roles use the same routes, but the handler returns different data based on the authenticated user's role.

```
GET /api/v1/appointments/:id
```

Inside the handler:
- If `req.user.role === 'PATIENT'` → verify it's their appointment → return patient view
- If `req.user.role === 'DOCTOR'` → verify it's their appointment → return clinical view (with notes)
- If `req.user.role === 'ADMIN'` → return full admin view

**Use when:** The same resource is accessed by multiple roles but with different data visibility. Common for resources that are genuinely shared (appointments, messages, documents).

**Avoid when:** The branching becomes deeply nested or the views are so different that they should really be separate endpoints.

---

### Pattern C: Feature-Based Routes with Permission Guards

Routes are not organized by role but by feature. Each route is protected by a specific permission requirement.

```
GET  /api/v1/users              ──► requires permission: 'users:read'
POST /api/v1/users              ──► requires permission: 'users:write'
DELETE /api/v1/users/:id        ──► requires permission: 'users:delete'
POST /api/v1/content/publish    ──► requires permission: 'content:publish'
```

**Use when:** Implementing Type 3 (full RBAC with permissions table). Works well when roles are configurable at runtime and you cannot hardcode which role gets which route.

---

## 3.2 Complete Route Map: Healthcare Example

```
── PUBLIC ──────────────────────────────────────────────────────────
POST   /api/v1/auth/register              Register (role in body)
POST   /api/v1/auth/login                 Login (returns role in token)
POST   /api/v1/auth/refresh               Refresh access token
POST   /api/v1/auth/logout                Logout (invalidate refresh token)
POST   /api/v1/auth/forgot-password       Request reset
POST   /api/v1/auth/reset-password        Complete reset
GET    /api/v1/auth/verify-email/:token   Email verification

── PATIENT (requireRole: PATIENT) ──────────────────────────────────
GET    /api/v1/patient/profile             Own profile
PUT    /api/v1/patient/profile             Update own profile
GET    /api/v1/patient/appointments        Own upcoming/past appointments
POST   /api/v1/patient/appointments        Book new appointment
DELETE /api/v1/patient/appointments/:id    Cancel own appointment
GET    /api/v1/patient/doctors             Browse available doctors
GET    /api/v1/patient/doctors/:id         View doctor profile + availability
GET    /api/v1/patient/medical-records     Own records (read only)
GET    /api/v1/patient/prescriptions       Own prescriptions
GET    /api/v1/patient/invoices            Own invoices

── DOCTOR (requireRole: DOCTOR) ────────────────────────────────────
GET    /api/v1/doctor/profile              Own profile
PUT    /api/v1/doctor/profile              Update bio, availability
GET    /api/v1/doctor/appointments         Own schedule
PUT    /api/v1/doctor/appointments/:id     Update status, add clinical notes
GET    /api/v1/doctor/patients             Own patient list
GET    /api/v1/doctor/patients/:id         Full patient profile (with medical history)
POST   /api/v1/doctor/patients/:id/notes   Add consultation notes
POST   /api/v1/doctor/prescriptions        Issue prescription
GET    /api/v1/doctor/availability         Own availability settings
PUT    /api/v1/doctor/availability         Update availability

── STAFF (requireAnyRole: NURSE, RECEPTIONIST) ─────────────────────
GET    /api/v1/staff/profile               Own profile
GET    /api/v1/staff/appointments          All appointments (today/upcoming)
PUT    /api/v1/staff/appointments/:id      Update status (check-in, etc.)
GET    /api/v1/staff/patients              Search/list patients
GET    /api/v1/staff/patients/:id          Patient profile (limited: no clinical notes)
POST   /api/v1/staff/appointments          Book on behalf of patient

── ADMIN (requireRole: ADMIN) ──────────────────────────────────────
GET    /api/v1/admin/users                 List all users with filters
POST   /api/v1/admin/users                 Create user (any role)
GET    /api/v1/admin/users/:id             Any user's full profile
PUT    /api/v1/admin/users/:id             Edit any user
DELETE /api/v1/admin/users/:id             Deactivate user
GET    /api/v1/admin/appointments          All appointments system-wide
GET    /api/v1/admin/doctors               Manage doctor accounts
PUT    /api/v1/admin/doctors/:id/verify    Verify doctor license
GET    /api/v1/admin/reports/appointments  Appointment analytics
GET    /api/v1/admin/reports/revenue       Revenue reports
GET    /api/v1/admin/audit-logs            System audit trail
```

---

## 3.3 Cross-Role Shared Routes

Some routes are genuinely shared across roles. These sit under `/shared` or are unnamespaced, but still require authentication.

```
── SHARED (any authenticated user) ─────────────────────────────────
GET    /api/v1/me                          Resolves own profile by role_type
PUT    /api/v1/me/password                 Change own password
PUT    /api/v1/me/email                    Request email change
GET    /api/v1/me/notifications            Own notifications
PUT    /api/v1/me/notifications/:id/read   Mark notification read
GET    /api/v1/me/sessions                 Active sessions
DELETE /api/v1/me/sessions/:id             Revoke session
```

> **KEY DESIGN:** The `GET /me` endpoint resolves a different profile object based on the authenticated user's role. A patient gets `{ role: 'PATIENT', profile: { blood_type, insurance_id, ... } }`. A doctor gets `{ role: 'DOCTOR', profile: { license_number, specialty, ... } }`. Same URL, role-aware response.

---

## 3.4 Route Versioning with Role Evolution

When roles evolve (you add a new role type, or a role's access level changes significantly), version the affected namespaces independently.

```
/api/v1/patient/*    ← stable
/api/v2/doctor/*     ← new version with expanded features
/api/v1/admin/*      ← stable
```

This prevents breaking existing clients when one role's API surface is updated.

---

# 4. Authentication Flow by Role Type

---

## 4.1 Registration Flow for Multi-Persona Systems

When different roles have different registration data requirements, there are two valid approaches.

### Approach A: Single Endpoint, Role in Body

```
POST /api/v1/auth/register
{
  "email": "jane@example.com",
  "password": "...",
  "role": "DOCTOR",
  "profile": {
    "firstName": "Jane",
    "lastName": "Smith",
    "licenseNumber": "MD-12345",
    "specialty": "Cardiology"
  }
}
```

The server validates the `profile` object against the schema for the specified `role`. A PATIENT registration would have `{ dateOfBirth, insuranceId }` instead.

**Use when:** Registration happens through a single unified flow (user selects their role).

### Approach B: Role-Specific Registration Endpoints

```
POST /api/v1/auth/register/patient
POST /api/v1/auth/register/doctor
POST /api/v1/auth/register/company
POST /api/v1/auth/register/ca
```

Each endpoint validates its own specific schema and creates the appropriate profile record.

**Use when:** The registration flows are so different that a shared endpoint would require complex conditional validation. Also useful when certain roles require admin approval before activation (e.g., doctor registration needs license verification).

---

## 4.2 Login and Token Design

The login flow is the same regardless of role, but the JWT payload must carry role information.

```
POST /api/v1/auth/login
{ "email": "jane@example.com", "password": "..." }

RESPONSE:
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "role": "DOCTOR",
    "profile": { ... doctor profile ... }
  }
}
```

### JWT Payload Design for Multi-Role Systems

```json
{
  "sub": "user-uuid",
  "email": "jane@example.com",
  "role": "DOCTOR",
  "profileId": "doctor-profile-uuid",
  "permissions": ["appointments:read", "patients:read", "prescriptions:write"],
  "iat": 1700000000,
  "exp": 1700001800
}
```

**Key fields to always include in the access token:**
- `sub` — the user's ID (primary key in users table)
- `role` — the role type string; drives middleware routing decisions
- `profileId` — the ID of the role-specific profile record (avoids a lookup)
- `permissions` — only include if using fine-grained RBAC; omit for simple role-based systems

### Multi-Tenant JWT Payload

For Type 5 systems, the token must also carry the active organization context.

```json
{
  "sub": "user-uuid",
  "email": "john@example.com",
  "activeOrgId": "org-uuid",
  "orgRole": "ADMIN",
  "iat": 1700000000,
  "exp": 1700001800
}
```

When a user switches organizations, they re-authenticate or exchange the token for one scoped to the new org.

---

## 4.3 Registration with Admin Approval

For regulated roles (doctors, lawyers, certified accountants), registration should not immediately grant access. Instead:

```
User registers (role: DOCTOR)
    │
    ▼
Account created with status: 'PENDING_VERIFICATION'
    │
    ▼
Admin reviews license, credentials
    │
    ├── Approve ──► status: 'ACTIVE' ──► user notified, can now log in
    └── Reject  ──► status: 'REJECTED' ──► user notified with reason
```

```sql
ALTER TABLE users ADD COLUMN verification_status VARCHAR(30) NOT NULL
    DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'));

-- Only ACTIVE users can log in
-- Check this in the login service, not just is_active
```

---

## 4.4 Dual-Role Users

Some systems legitimately allow a single person to hold two roles (e.g., a doctor who is also an admin, or a user who is both a buyer and a seller on a marketplace).

### Option A: Separate Accounts (Simplest)
The user creates two accounts with different emails. Completely isolated. Zero complexity. The downside is user experience friction.

### Option B: Role Switching with Same Account

```sql
-- User can have multiple role_type entries (change the column to a join table)
CREATE TABLE user_roles_v2 (
    user_id   UUID REFERENCES users(id),
    role_type VARCHAR(50) NOT NULL,
    profile_id UUID,           -- FK to the appropriate profile table
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, role_type)
);
```

The JWT includes an `activeRole` field. The client provides a `switchRole` action that exchanges the current access token for one with a different `activeRole`. Each role's routes and data are fully isolated — the system behaves as if the user logged out and back in with the other role.

```
POST /api/v1/auth/switch-role
{ "targetRole": "SELLER" }
──► Returns new access token with role: "SELLER"
```

> **RECOMMENDATION:** Unless role-switching is a core product feature (like a doctor who also manages the clinic), prefer separate accounts. Role-switching adds significant session complexity and is a common source of authorization bugs.

---

# 5. Middleware Architecture

---

## 5.1 The Full Middleware Stack for Multi-Role Systems

```
Every Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  1. GLOBAL MIDDLEWARE (all routes)                           │
│     - Request ID injection (unique UUID per request)         │
│     - Structured request logger                              │
│     - Security headers (HSTS, CSP, X-Frame-Options, etc.)   │
│     - CORS validation                                        │
│     - Body parser + size limit                               │
│     - Rate limiter (global)                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
         Public Route?          Protected Route?
         /auth/*                /patient/*, /doctor/*, etc.
                 │                     │
                 ▼                     ▼
          No auth needed    ┌─────────────────────────────┐
                            │  2. AUTHENTICATION MIDDLEWARE │
                            │     - Extract Bearer token    │
                            │     - Verify signature        │
                            │     - Check expiry            │
                            │     - Attach req.user         │
                            │     - 401 if invalid          │
                            └──────────────┬──────────────┘
                                           │
                            ┌──────────────▼──────────────┐
                            │  3. ROLE GUARD MIDDLEWARE    │
                            │     - Check req.user.role    │
                            │     - Against route's        │
                            │       required role(s)       │
                            │     - 403 if mismatch        │
                            └──────────────┬──────────────┘
                                           │
                            ┌──────────────▼──────────────┐
                            │  4. ACCOUNT STATUS CHECK     │
                            │     - is_active = true?      │
                            │     - verification_status    │
                            │       = 'ACTIVE'?            │
                            │     - 403 if suspended       │
                            └──────────────┬──────────────┘
                                           │
                            ┌──────────────▼──────────────┐
                            │  5. PERMISSION GUARD         │
                            │     (Type 3 systems only)    │
                            │     - Check specific         │
                            │       permission key         │
                            │     - 403 if missing         │
                            └──────────────┬──────────────┘
                                           │
                            ┌──────────────▼──────────────┐
                            │  6. INPUT VALIDATION         │
                            │     - Schema validation      │
                            │     - Sanitization           │
                            │     - 422 if invalid         │
                            └──────────────┬──────────────┘
                                           │
                                    Route Handler
                                    (Controller)
```

---

## 5.2 Authentication Middleware Implementation Pattern

```
FUNCTION authenticate(request, response, next):

    // Step 1: Extract token
    token = extractBearerToken(request.headers.authorization)
    IF token is null:
        RETURN 401 { error: "Authentication required" }

    // Step 2: Verify and decode
    TRY:
        payload = verifyJWT(token, JWT_SECRET)
    CATCH TokenExpiredError:
        RETURN 401 { error: "Token expired", code: "TOKEN_EXPIRED" }
    CATCH JsonWebTokenError:
        RETURN 401 { error: "Invalid token" }

    // Step 3: Attach to request context
    request.user = {
        id:          payload.sub,
        email:       payload.email,
        role:        payload.role,
        profileId:   payload.profileId,
        permissions: payload.permissions || [],
        // For multi-tenant:
        activeOrgId: payload.activeOrgId,
        orgRole:     payload.orgRole
    }

    next()
```

---

## 5.3 Role Guard Middleware Implementation Pattern

```
FUNCTION requireRole(...allowedRoles):
    RETURN FUNCTION(request, response, next):

        IF request.user is null:
            RETURN 401 { error: "Authentication required" }

        IF request.user.role NOT IN allowedRoles:
            // Log: unauthorized role access attempt
            auditLog.warn({
                userId: request.user.id,
                role: request.user.role,
                attemptedRoute: request.path,
                requiredRoles: allowedRoles
            })
            RETURN 403 { error: "Insufficient permissions" }

        next()

// Usage:
router.use('/doctor/*',  authenticate, requireRole('DOCTOR'))
router.use('/patient/*', authenticate, requireRole('PATIENT'))
router.use('/staff/*',   authenticate, requireRole('NURSE', 'RECEPTIONIST'))
router.use('/admin/*',   authenticate, requireRole('ADMIN', 'SUPER_ADMIN'))
```

---

## 5.4 Permission Guard for Type 3 RBAC

```
FUNCTION requirePermission(permissionKey):
    RETURN FUNCTION(request, response, next):

        userPermissions = request.user.permissions

        IF permissionKey NOT IN userPermissions:
            RETURN 403 {
                error: "Missing required permission",
                required: permissionKey
            }

        next()

// Usage (combined with role guard or standalone):
router.delete(
    '/users/:id',
    authenticate,
    requireRole('ADMIN'),
    requirePermission('users:delete'),
    userController.deleteUser
)
```

---

## 5.5 Resource Ownership Guard

A critical middleware pattern for persona-based systems: ensuring a user can only access their own resources, not other users' resources within the same role.

```
FUNCTION requireOwnership(resourceLoader):
    RETURN ASYNC FUNCTION(request, response, next):

        resource = await resourceLoader(request.params.id)

        IF resource is null:
            RETURN 404 { error: "Not found" }

        // A patient can only access their own appointments
        IF request.user.role === 'PATIENT'
            AND resource.patientUserId !== request.user.id:
            RETURN 403 { error: "Access denied" }

        // A doctor can only access their own appointments
        IF request.user.role === 'DOCTOR'
            AND resource.doctorUserId !== request.user.id:
            RETURN 403 { error: "Access denied" }

        // Admins bypass ownership check
        request.resource = resource
        next()

// Usage:
router.get(
    '/patient/appointments/:id',
    authenticate,
    requireRole('PATIENT'),
    requireOwnership(Appointment.findById),
    appointmentController.getOne
)
```

---

## 5.6 Multi-Tenant Organization Scope Guard

```
FUNCTION requireOrgMembership(minimumRole):
    RETURN ASYNC FUNCTION(request, response, next):

        orgId = request.params.orgId
              || request.body.orgId
              || request.user.activeOrgId

        IF orgId is null:
            RETURN 400 { error: "Organization context required" }

        membership = await OrganizationMember.findOne({
            orgId:  orgId,
            userId: request.user.id
        })

        IF membership is null:
            RETURN 403 { error: "Not a member of this organization" }

        IF minimumRole AND roleHierarchy[membership.role] < roleHierarchy[minimumRole]:
            RETURN 403 { error: "Insufficient organization role" }

        request.orgMembership = membership
        request.activeOrgId   = orgId
        next()

// Role hierarchy for comparison:
roleHierarchy = { VIEWER: 0, MEMBER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 }
```

---

# 6. Real-World Case Studies

---

## 6.1 Case Study: Patient–Doctor Platform (Healthcare)

**Business rules:**
- Patients can only see their own records and appointments.
- Doctors can see their own patients' records but not other doctors' patients.
- Nurses can see all patient check-in data but not clinical notes.
- Admins can see everything and manage all accounts.
- Doctor accounts require license verification before activation.

**Schema decision:** Type 4 (Persona-Based) — each role has fundamentally different profile data and different relationships to the appointment entity.

**Key implementation points:**

```
Registration split:
  Patient ──► instant activation (email verification only)
  Doctor  ──► PENDING state until admin verifies license number
  Nurse   ──► Invited by admin only (no public registration)

Data visibility rules (enforced at service layer, not just middleware):
  GET /doctor/patients/:id
    → Verify doctor has at least one appointment with this patient
    → If yes: return full profile including clinical notes
    → If no:  return 403 (doctor is not this patient's care provider)

  GET /staff/patients/:id
    → Return profile with: name, contact, appointment history
    → Never return: clinical notes, prescriptions, lab results
```

---

## 6.2 Case Study: Company–CA (Chartered Accountant) Platform

**Business rules:**
- Companies upload financial documents and request services.
- CAs are assigned to companies and manage their accounts.
- CAs can have multiple companies; companies can have multiple CAs.
- Documents uploaded by a company are visible only to that company and their assigned CA(s).
- An admin oversees billing, CA assignments, and dispute resolution.

**Schema decision:** Type 4 (Persona-Based) with a many-to-many assignment relationship.

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    email       VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role_type   VARCHAR(20) CHECK (role_type IN ('COMPANY', 'CA', 'ADMIN'))
);

CREATE TABLE company_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    company_name    VARCHAR(255),
    registration_no VARCHAR(100),
    gst_number      VARCHAR(50),
    fiscal_year_end VARCHAR(10),
    industry        VARCHAR(100)
);

CREATE TABLE ca_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id),
    full_name           VARCHAR(200),
    membership_number   VARCHAR(50) UNIQUE,
    firm_name           VARCHAR(255),
    specializations     TEXT[],
    max_clients         INTEGER DEFAULT 20
);

-- The core relationship: which CA manages which company
CREATE TABLE ca_company_assignments (
    ca_user_id      UUID REFERENCES users(id),
    company_user_id UUID REFERENCES users(id),
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    is_primary      BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (ca_user_id, company_user_id)
);

-- Documents are scoped to the company but visible to their assigned CAs
CREATE TABLE documents (
    id              UUID PRIMARY KEY,
    company_user_id UUID REFERENCES users(id),  -- owner
    uploaded_by     UUID REFERENCES users(id),  -- could be company or CA
    document_type   VARCHAR(50),
    file_path       VARCHAR(500),
    fiscal_year     INTEGER,
    is_confidential BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Authorization at the data layer:**

```
GET /ca/documents?companyId=X
  → Verify: is the CA assigned to company X?
  → If yes: return company X's documents
  → If no:  403

GET /company/documents
  → Automatically scope to req.user.id (their own documents only)
  → No company ID parameter needed (it's their identity)
```

---

## 6.3 Case Study: Salon–Customer Booking Platform

**Business rules:**
- Customers browse salons, book appointments with specific stylists.
- Stylists manage their own schedule and view their bookings.
- Salon owners manage their salon's profile, stylists, and see all bookings for their salon.
- The platform admin manages all salons.

**Schema decision:** Type 4 (Persona-Based) with a salon-ownership layer making it partially Type 5.

```sql
CREATE TABLE users (
    id        UUID PRIMARY KEY,
    email     VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role_type VARCHAR(20) CHECK (role_type IN ('CUSTOMER', 'STYLIST', 'SALON_OWNER', 'ADMIN'))
);

CREATE TABLE salons (
    id          UUID PRIMARY KEY,
    owner_id    UUID REFERENCES users(id),  -- must be role_type: SALON_OWNER
    name        VARCHAR(255),
    address     JSONB,
    is_verified BOOLEAN DEFAULT FALSE
);

-- Stylists belong to a salon
CREATE TABLE stylist_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id),
    salon_id    UUID REFERENCES salons(id),
    display_name VARCHAR(200),
    specialties  TEXT[],
    is_accepting_bookings BOOLEAN DEFAULT TRUE
);

CREATE TABLE customer_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id),
    display_name VARCHAR(200),
    phone        VARCHAR(20)
);

CREATE TABLE bookings (
    id               UUID PRIMARY KEY,
    customer_user_id UUID REFERENCES users(id),
    stylist_user_id  UUID REFERENCES users(id),
    salon_id         UUID REFERENCES salons(id),  -- denormalized for query efficiency
    service_type     VARCHAR(100),
    scheduled_at     TIMESTAMPTZ,
    status           VARCHAR(20),
    price            NUMERIC(10,2)
);
```

**Route map:**

```
/customer/*     ── browse salons, book appointments, view own history
/stylist/*      ── view own schedule, manage own bookings
/salon/*        ── salon owner: manage salon, stylists, view all salon bookings
/admin/*        ── platform admin: manage all salons

Authorization rules:
  Stylist accessing their bookings → WHERE stylist_user_id = req.user.id
  Salon owner accessing bookings  → WHERE salon_id IN (SELECT id FROM salons WHERE owner_id = req.user.id)
  Customer accessing their bookings → WHERE customer_user_id = req.user.id
```

---

# 7. Scalability & Future-Proofing

---

## 7.1 Designing for Role Expansion

The most painful architectural changes happen when a system designed for 2 roles needs to support 5. Protect yourself from the start.

**Rules for future-proof role architecture:**

Never hardcode role-specific logic in shared data models. If your `appointments` table has a `patient_notes` column and a `doctor_notes` column, you are hardcoding role assumptions into the data layer. Use separate tables or JSONB with a clear schema contract instead.

Never return role-specific fields from shared endpoints without explicit branching. A shared `GET /appointments/:id` that silently omits `clinical_notes` for patients is a potential data leak if the conditional is ever misconfigured.

Use feature flags or role configuration files to define what each role can see, not inline conditionals. A centralized role capability definition is easy to audit and extend.

```
ROLE_CAPABILITIES = {
  PATIENT: {
    canViewClinicalNotes: false,
    canBookAppointments:  true,
    canViewOwnInvoices:   true,
    canAccessAdminPanel:  false
  },
  DOCTOR: {
    canViewClinicalNotes: true,
    canBookAppointments:  false,
    canViewOwnInvoices:   false,
    canAccessAdminPanel:  false
  },
  ADMIN: {
    canViewClinicalNotes: true,
    canBookAppointments:  true,
    canViewOwnInvoices:   true,
    canAccessAdminPanel:  true
  }
}
```

---

## 7.2 Caching Strategy for Role-Based Systems

```
What to cache:
  user:{id}:permissions        ── computed permission set (TTL: 5–15 min)
  user:{id}:profile            ── resolved profile by role (TTL: 5 min)
  user:{id}:active             ── is_active + verification_status (TTL: 2 min)
  org:{id}:member:{userId}     ── org membership + role (TTL: 5 min)

When to invalidate:
  Role change          → DELETE user:{id}:permissions
  Profile update       → DELETE user:{id}:profile
  Account suspension   → DELETE user:{id}:active (or set to 'false' with short TTL)
  Org role change      → DELETE org:{id}:member:{userId}
  Password change      → Invalidate all refresh tokens for user (force re-login)
```

---

## 7.3 Adding a New Role: The Checklist

When you need to add a new role (e.g., adding `PHARMACIST` to the healthcare platform):

```
Schema changes:
  [ ] Add 'PHARMACIST' to users.role_type CHECK constraint (migration)
  [ ] Create pharmacist_profiles table (migration)

Authentication:
  [ ] Add registration endpoint or admin-invite flow for new role
  [ ] Define verification requirements (instant / admin-approval / invite-only)
  [ ] Update JWT payload if role-specific claims are needed

Routes:
  [ ] Create /pharmacist/* namespace
  [ ] Apply requireRole('PHARMACIST') to the namespace
  [ ] Define all pharmacist-specific endpoints

Authorization rules:
  [ ] Define what pharmacists can see of patient data
  [ ] Define what pharmacists can see of doctor prescriptions
  [ ] Update ownership/access guards for shared resources (appointments, etc.)

Middleware:
  [ ] Add PHARMACIST to ROLE_CAPABILITIES config
  [ ] Update any shared endpoints that branch on role to include new case

Testing:
  [ ] Unit tests for new middleware guards
  [ ] Integration tests for new routes
  [ ] Verify pharmacist cannot access patient, doctor, or admin namespaces
  [ ] Verify data visibility rules are correctly enforced
```

---

## 7.4 Common Pitfalls and How to Avoid Them

**Pitfall: Authorization at the route level only**

Passing the route guard is not enough. A `DOCTOR` role might correctly access `GET /doctor/patients`, but inside that endpoint, the query must be scoped to only their patients — not all patients in the system. Always enforce ownership/scope at the data access layer, not just at the route level.

```
WRONG:
  Route guard passes (DOCTOR role) → Query: SELECT * FROM patients
  ─── Returns ALL patients in the system ─── Critical security bug

CORRECT:
  Route guard passes (DOCTOR role) → Query: SELECT p.* FROM patient_profiles p
  JOIN appointments a ON a.patient_user_id = p.user_id
  WHERE a.doctor_user_id = {req.user.id}
  ─── Returns only this doctor's patients
```

**Pitfall: Role stored only in JWT, not validated against database**

A user's role can change (suspension, role revocation) after their JWT was issued. For long-lived access tokens, this creates a window where a revoked user still has access.

```
Mitigation strategies (pick one based on your security requirements):
  1. Very short access token TTL (5 minutes): most users won't notice the re-auth
  2. Database lookup on sensitive operations: check is_active before destructive actions
  3. Token versioning: store a token_version on the user; include in JWT; reject if mismatch
  4. Redis blacklist: on role change/revocation, add user ID to a blacklist (TTL = token TTL)
```

**Pitfall: Leaking role-specific data through shared endpoints**

```
WRONG:
  GET /appointments/:id
  Returns: { id, patientId, doctorId, clinicalNotes, prescriptions }
  ── clinicalNotes and prescriptions are returned to ALL roles including PATIENT

CORRECT:
  Serialize response based on requesting role:
  PATIENT view:  { id, scheduledAt, doctorName, status }
  DOCTOR view:   { id, scheduledAt, patient, clinicalNotes, prescriptions }
  ADMIN view:    { id, scheduledAt, patient, doctor, clinicalNotes, billingInfo }
```

**Pitfall: Not scoping admin queries**

Even admin users should not be able to read ALL data with a single unfiltered query in production. Implement pagination, filtering, and (in regulated systems) access logging on all admin data queries.

---

# 8. Decision Framework

---

## 8.1 Schema Design Decision Tree

```
Step 1: How many distinct role types does your system have?
  ─ 1–2 roles with identical data structure  ──────► Type 1/2: Enum column
  ─ 3+ roles with identical data structure   ──────► Type 3: RBAC table
  ─ Any roles with different profile data    ──────► Type 4: Persona-based
  ─ Roles are scoped to organizations        ──────► Type 5: Multi-tenant

Step 2: Do any roles need runtime role management (create/edit roles via UI)?
  ─ YES ──────────────────────────────────────────► Add permissions table (Type 3 or hybrid)
  ─ NO  ──────────────────────────────────────────► Hardcode role slugs in application code

Step 3: Can users hold multiple roles simultaneously?
  ─ YES ──────────────────────────────────────────► user_roles join table (Type 3)
  ─ NO  ──────────────────────────────────────────► Single role_type column on users table

Step 4: Does registration differ by role?
  ─ Significantly different  ─────────────────────► Separate registration endpoints
  ─ Slightly different       ─────────────────────► Single endpoint with role-specific validation
  ─ Some roles require approval ──────────────────► Add verification_status to users table
```

---

## 8.2 Route Design Decision Tree

```
Step 1: Are role namespaces fundamentally different applications?
  ─ YES ──────────────────────────────────────────► Pattern A: Separate namespaces (/patient/*, /doctor/*)
  ─ NO  ──────────────────────────────────────────► Pattern B or C

Step 2: Are permissions configurable at runtime?
  ─ YES ──────────────────────────────────────────► Pattern C: Permission-guarded routes
  ─ NO  ──────────────────────────────────────────► Pattern A or B

Step 3: Do multiple roles access the same resources?
  ─ YES, with different data visibility ──────────► Pattern B: Shared routes + role branching
  ─ NO  ─────────────────────────────────────────► Pattern A: Separate routes per role
```

---

## 8.3 Summary: Architecture by System Type

| System Type | Schema | Route Pattern | Auth Flow |
|---|---|---|---|
| Blog / CMS | Type 2 (enum role) | Pattern A (simple) | Single registration |
| SaaS Dashboard | Type 3 (RBAC table) | Pattern C (permissions) | Invite-based |
| Healthcare Platform | Type 4 (persona-based) | Pattern A (namespaced) | Approval for doctors |
| Legal / CA Platform | Type 4 (persona-based) | Pattern A (namespaced) | Approval for CAs |
| Marketplace | Type 4 (persona-based) | Pattern A + B | Single reg, role selection |
| Salon Booking | Type 4 (persona-based) | Pattern A (namespaced) | Invite stylists, public customers |
| B2B SaaS (Slack-like) | Type 5 (multi-tenant) | Pattern A + org scope | Org-invite based |
| E-commerce | Type 2 or 3 | Pattern A | Single registration |
| Education Platform | Type 4 (persona-based) | Pattern A (namespaced) | Institution-issued for teachers |

---

> **CLOSING PRINCIPLE:** In multi-role systems, the most important question is not "what can this user do" but "who is this user in the context of this business domain?" Your schema and route design should reflect the domain model first. The roles are not access levels — they are distinct actors in your system, each with their own identity, data, and set of relationships to other actors. Design your architecture to respect those distinctions, and authorization becomes a natural expression of your data model rather than a maze of conditionals.

---

*Role-Based Authentication Architecture Guide · Version 1.0 · Framework-Agnostic · Language-Agnostic · Reusable*

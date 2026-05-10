# Production-Grade Node.js + Express.js Backend Architecture
### The Definitive Reference Guide for Small Teams (1–3 Developers)

> **Stack:** Node.js (LTS ≥ 18) · Express.js · JavaScript (CommonJS)  
> **Team Size:** 1–3 Developers · **Pattern:** Feature-Based Modular Monolith  
> **Purpose:** Long-term reference — architecture, structure, security, auth, testing, scaling

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Final Recommended Architecture](#3-final-recommended-architecture)
4. [Project Root Structure](#4-project-root-structure)
5. [Src Structure](#5-src-structure)
6. [Feature Module Structure](#6-feature-module-structure)
7. [Authentication & Authorization Architecture](#7-authentication--authorization-architecture)
8. [Request / Response Flow](#8-request--response-flow)
9. [Layer Responsibilities](#9-layer-responsibilities)
10. [Dependency Flow & Import Rules](#10-dependency-flow--import-rules)
11. [Naming Conventions](#11-naming-conventions)
12. [Validation / Security / Error Handling](#12-validation--security--error-handling)
13. [Configuration & Environment Management](#13-configuration--environment-management)
14. [Logging / Monitoring / Observability](#14-logging--monitoring--observability)
15. [Testing Strategy](#15-testing-strategy)
16. [API Design & Versioning](#16-api-design--versioning)
17. [Scaling Guidelines](#17-scaling-guidelines)
18. [Project Evolution Strategy](#18-project-evolution-strategy)
19. [Anti-Patterns to Avoid](#19-anti-patterns-to-avoid)
20. [Final Recommendation](#20-final-recommendation)
21. [Starter Template Tree](#21-starter-template-tree)

---

## 1. Executive Summary

This document defines the definitive backend architecture standard for a Node.js + Express.js + JavaScript backend maintained by a small team (1–3 developers). It is written as a long-term engineering reference — not a tutorial, not a framework overview, and not a theoretical exercise.

**Core assumptions:**
- Node.js LTS (≥ 18), JavaScript (CommonJS), Express.js 4.x / 5.x.
- REST/JSON API, typically backed by a relational database (PostgreSQL preferred).
- 1–3 developers; fast iteration without accumulating structural debt.
- Containerized deployments (Docker); secrets managed via environment variables or a secret manager in production.
- CI/CD pipeline in place (GitHub Actions or equivalent).

**The recommended pattern:** Feature-based modular monolith with clean internal layering (routes → controller → service → repository) per feature. Shared cross-cutting concerns live in `lib/` and `middleware/`. Nothing more. Nothing less.

**Why this works for small teams:**
- One folder per feature means all context is local. No hunting across layered top-level folders.
- Clear layer responsibilities prevent "god files" without adding enterprise ceremony.
- Stateless and horizontally scalable from day one.
- Easy to extract a feature into a microservice later if the need ever arises.

---

## 2. Architecture Philosophy

### 2.1 The Core Principle: Discipline Over Abstraction

For small teams, the greatest risk is not under-architecting — it is over-engineering too early. Every abstraction layer added before it is needed slows development, complicates debugging, and creates maintenance burden without a corresponding benefit.

The architecture in this guide establishes discipline (clear responsibility boundaries, dependency rules, consistent naming) without adding abstraction for its own sake.

**The five non-negotiable rules:**

| Rule | Enforcement |
|---|---|
| Dependencies point inward and downward only | Routes → Controller → Service → Repository → DB |
| `req` and `res` objects never leave the controller | Services and repositories are framework-agnostic |
| One feature owns its own files | No cross-feature imports of internal files |
| Shared code is opt-in after second use | Never extract to `lib/` until something is used in 2+ features |
| Private by default | Every route requires auth unless explicitly marked public |

### 2.2 Architecture Pattern Selection

| Scale | Pattern | Reason |
|---|---|---|
| Small (1–3 devs, <15 endpoints) | Flat layered (controllers/, services/, routes/ at top level) | Minimal ceremony, fine for trivial APIs |
| **Medium (1–3 devs, 15+ endpoints, multiple domains)** | **Feature-based modular monolith ← This guide** | Best balance for small teams |
| Large (5+ devs, bounded contexts) | Feature-based + Clean Architecture (ports/adapters) | Strong boundaries needed for parallel teams |

**This guide targets: Medium scale, feature-based modular monolith.**

### 2.3 Why Feature-Based Over Pure Layered

A pure layered structure (top-level `controllers/`, `services/`, `routes/`) forces developers to jump between three different directories to understand one feature. At 10 features, this creates significant cognitive load and merge conflicts.

A feature-based structure keeps everything about one domain in one folder. Adding, modifying, or deleting a feature becomes a single-folder operation. The internal layers still exist — they are just scoped to the feature.

**Do not adopt full Clean Architecture (use cases, ports, adapters, domain entities) for a small team.** It is valuable at scale but imposes significant overhead that slows a 1–3 person team disproportionately. If your team grows past 5 developers or you extract microservices, migrate then.

---

## 3. Final Recommended Architecture

```
feature-based modular monolith
  │
  ├── features/<name>/          ← Everything about one domain
  │     routes.js               ← HTTP wiring only
  │     controller.js           ← HTTP adapter (req → service → res)
  │     service.js              ← Business logic
  │     repository.js           ← Database access
  │     schema.js               ← Validation schemas (Joi)
  │     index.js                ← Public export (the Express router)
  │     __tests__/              ← Unit + integration tests
  │
  ├── lib/                      ← Shared cross-cutting code (used 2+ features)
  │     logger.js               ← Pino logger
  │     db.js                   ← DB client / pool / transaction helper
  │     errors.js               ← AppError + subclasses
  │
  ├── middleware/                ← Express middleware (one function per file)
  │     request-id.js           ← Attach request ID
  │     http-logger.js          ← pino-http request logging
  │     security.js             ← helmet + cors + rate-limit
  │     parse-body.js           ← JSON body parser with size limit
  │     authenticate.js         ← JWT verification → attach req.user
  │     authorize.js            ← Role/permission guards
  │     validate.js             ← Schema validation factory
  │     not-found.js            ← 404 handler
  │     error-handler.js        ← Global error handler (last middleware)
  │
  ├── config/
  │     index.js                ← Validated, frozen config object
  │
  ├── app.js                    ← createApp() factory — no listen()
  └── server.js                 ← Imports app, calls listen(), graceful shutdown
```

**The complete dependency direction:**

```
routes.js
  └─► controller.js
        └─► service.js
              └─► repository.js
                    └─► lib/db.js
```

No layer reaches upward. No layer skips a level (controllers never call repositories directly). No HTTP objects (`req`, `res`) escape the controller.

---

## 4. Project Root Structure

```
project-root/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── features/
│   ├── lib/
│   ├── middleware/
│   └── docs/
│       └── openapi.yaml
│
├── tests/
│   ├── integration/
│   │   └── users.test.js
│   └── fixtures/
│       └── user.factory.js
│
├── scripts/
│   ├── migrate.js
│   └── seed.js
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── .env.example              ← Committed; shows required keys, no values
├── .env                      ← Git-ignored; actual local secrets
├── .eslintrc.cjs
├── .prettierrc
├── jest.config.js
├── package.json
└── README.md
```

**Root folder rules:**
- `src/` contains all application source code. Nothing outside `src/` is imported by the app at runtime.
- `tests/` contains integration and E2E tests only. Unit tests live next to their feature in `__tests__/`.
- `scripts/` contains one-off runnable scripts (migrations, seeds, data fixes). They use the app's `lib/db.js` directly.
- `docker/` contains all container configuration. Keep Dockerfiles simple and deterministic.
- `.env.example` must always be updated when adding a new required environment variable.

---

## 5. Src Structure

```
src/
├── app.js                    ← Express app factory
├── server.js                 ← Process lifecycle and HTTP listener
│
├── config/
│   └── index.js              ← Validated config; single source of truth
│
├── lib/
│   ├── logger.js             ← Pino logger singleton
│   ├── db.js                 ← DB client, query helper, transaction utility
│   └── errors.js             ← AppError base + operational error subclasses
│
├── middleware/
│   ├── request-id.js         ← Generates and attaches req.id
│   ├── http-logger.js        ← pino-http; logs every request/response
│   ├── security.js           ← helmet, cors, express-rate-limit wired together
│   ├── parse-body.js         ← express.json() with size limit
│   ├── authenticate.js       ← Verify JWT → attach req.user (id, role, permissions)
│   ├── authorize.js          ← requireRole() and requirePermission() factories
│   ├── validate.js           ← validate(schema) middleware factory
│   ├── not-found.js          ← Catch-all 404 handler
│   └── error-handler.js      ← Global error handler; must be last
│
├── features/
│   ├── auth/                 ← Login, register, refresh, logout
│   ├── users/                ← User profile management
│   └── <feature>/            ← One folder per domain
│
└── docs/
    └── openapi.yaml          ← OpenAPI spec; served at /docs in non-production
```

### 5.1 app.js — The Express Factory

`app.js` exports a `createApp()` function. It never calls `listen()`. This separation is the single most important structural decision for testability.

```js
// src/app.js
const express = require('express');
const { requestId }    = require('./middleware/request-id');
const { httpLogger }   = require('./middleware/http-logger');
const { security }     = require('./middleware/security');
const { parseBody }    = require('./middleware/parse-body');
const { notFound }     = require('./middleware/not-found');
const { errorHandler } = require('./middleware/error-handler');
const routes           = require('./routes');

function createApp() {
  const app = express();

  // ── Global middleware (order matters) ──────────────────────
  app.use(requestId);       // 1. Attach req.id
  app.use(httpLogger);      // 2. Log every request
  app.use(security);        // 3. helmet + cors + rate-limit
  app.use(parseBody);       // 4. Parse JSON body

  // ── Application routes ─────────────────────────────────────
  app.use('/api/v1', routes);

  // ── Health / readiness (outside /api/v1 for simplicity) ───
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz',  require('./middleware/readiness'));

  // ── Error handling (always last) ───────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
```

### 5.2 server.js — Process Lifecycle

```js
// src/server.js
const { createApp } = require('./app');
const config        = require('./config');
const { db }        = require('./lib/db');
const logger        = require('./lib/logger');

async function start() {
  await db.connect();

  const app    = createApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'Server started');
  });

  // ── Graceful shutdown ───────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down...');
    server.close(async () => {
      await db.disconnect();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

### 5.3 routes/index.js — Central Route Composition

Mount every feature router in one file. This is the only place where features are wired to the Express app.

```js
// src/routes/index.js
const { Router } = require('express');
const authRoutes  = require('../features/auth');
const usersRoutes = require('../features/users');

const router = Router();

router.use('/auth',  authRoutes);
router.use('/users', usersRoutes);
// Add new features here — one line per feature

module.exports = router;
```

---

## 6. Feature Module Structure

Every feature is a self-contained vertical slice. It owns its routes, controller, service, repository, validation schemas, and tests.

```
features/users/
├── routes.js         ← HTTP verb + path + middleware wiring
├── controller.js     ← Request parsing + response shaping
├── service.js        ← Business logic (framework-agnostic)
├── repository.js     ← Database queries (no business rules)
├── schema.js         ← Joi validation schemas for this feature
├── index.js          ← Public entry point: exports the router
└── __tests__/
    ├── service.test.js
    └── controller.test.js
```

### 6.1 routes.js

```js
// features/users/routes.js
const { Router }    = require('express');
const controller    = require('./controller');
const schema        = require('./schema');
const authenticate  = require('../../middleware/authenticate');
const { requireRole } = require('../../middleware/authorize');
const validate      = require('../../middleware/validate');

const router = Router();

// Public
router.post('/', validate(schema.createUser), controller.createUser);

// Protected
router.use(authenticate); // all routes below require a valid JWT

router.get('/',     requireRole('ADMIN'), controller.listUsers);
router.get('/me',   controller.getMe);
router.get('/:id',  requireRole('ADMIN'), controller.getUserById);
router.patch('/me', validate(schema.updateMe), controller.updateMe);

module.exports = router;
```

**Routes.js rules:**
- Declare verbs, paths, and middleware only. Zero logic.
- Apply `authenticate` as a router-level middleware for all protected routes in one block.
- Apply `validate(schema.xxx)` per-route, not globally.
- Never access `req.body`, `req.params`, or `req.user` in this file.

### 6.2 controller.js

```js
// features/users/controller.js
const userService = require('./service');

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};

// ... other handlers

module.exports = { createUser, getMe, getUserById, listUsers, updateMe };
```

**Controller rules:**
- One handler per exported function.
- Read from `req` (body, params, query, user). Write to `res`. Call `next(err)` on failure.
- Call exactly one service method per handler. Never two.
- Never call the repository directly.
- Never contain business logic (if/else on domain rules belongs in the service).
- Always wrap async handlers in try/catch and forward to `next(err)`. With Express 5, async errors propagate automatically — remove try/catch if running Express 5.

### 6.3 service.js

```js
// features/users/service.js
const userRepo   = require('./repository');
const { ConflictError, NotFoundError } = require('../../lib/errors');
const { hashPassword } = require('../../lib/crypto');

const createUser = async ({ email, password, role = 'USER' }) => {
  const existing = await userRepo.findByEmail(email);
  if (existing) throw new ConflictError('users.email_taken', 'Email already in use');

  const passwordHash = await hashPassword(password);
  return userRepo.create({ email, passwordHash, role });
};

const getUserById = async (id) => {
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError('users.not_found', 'User not found');
  return user;
};

// ... other business operations

module.exports = { createUser, getUserById };
```

**Service rules:**
- Contains all business logic and orchestration.
- Never touches `req` or `res`. Completely framework-agnostic.
- Throws typed `AppError` subclasses (e.g., `NotFoundError`, `ConflictError`) — never raw HTTP status codes.
- Manages transaction boundaries: when multiple repository calls must be atomic, initiate a transaction here and pass it down.
- May call other services for cross-feature orchestration (import the other feature's service — not its repository).
- Pure async functions; testable with mocked repositories.

### 6.4 repository.js

```js
// features/users/repository.js
const { db } = require('../../lib/db');

const findById = async (id, trx) => {
  const client = trx || db;
  const { rows } = await client.query(
    'SELECT id, email, role, is_active, created_at FROM users WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const { rows } = await db.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
};

const create = async ({ email, passwordHash, role }) => {
  const { rows } = await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
    [email, passwordHash, role]
  );
  return rows[0];
};

// ... other DB operations

module.exports = { findById, findByEmail, create };
```

**Repository rules:**
- Only database queries. No business logic whatsoever.
- Returns plain JavaScript objects — not ORM model instances (if using an ORM, map to plain objects before returning).
- Accept an optional `trx` (transaction client) as the last argument to support service-initiated transactions.
- Map database constraint violations (unique violation, FK error) to typed `AppError` subclasses in this layer only. The service should not parse DB errors.
- Never throw HTTP-shaped errors.

### 6.5 schema.js

```js
// features/users/schema.js
const Joi = require('joi');

const createUser = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128).required(),
  role:     Joi.string().valid('USER', 'ADMIN').default('USER'),
}).options({ stripUnknown: true });

const updateMe = Joi.object({
  firstName: Joi.string().max(100).trim(),
  lastName:  Joi.string().max(100).trim(),
}).min(1).options({ stripUnknown: true });

module.exports = { createUser, updateMe };
```

**Schema rules:**
- Use Joi. Strip unknown fields (`stripUnknown: true`). Coerce and sanitize.
- Validate `body`, `params`, and `query` — schema names must be explicit about which target they validate.
- Schemas live here, not in routes.js or controller.js.

### 6.6 index.js — Public Export

```js
// features/users/index.js
const router = require('./routes');
module.exports = router;
```

This is the only file that `routes/index.js` imports from a feature. Internal files (service, repository, controller) are not imported from outside the feature — except when one feature's service needs another feature's service (cross-feature service dependency, acceptable).

---

## 7. Authentication & Authorization Architecture

### 7.1 Choosing Your Role Architecture Type

Before writing a line of code, determine which role architecture type your system requires. This is irreversible once production data exists.

```
Does your system have organizations / tenants (B2B)?
├── YES ─────────────────────────────────────────────► Type 5: Multi-Tenant
└── NO
    │
    Do different roles have fundamentally different profile data?
    ├── YES ─────────────────────────────────────────► Type 4: Persona-Based
    │         (e.g., patient has blood_type, doctor has license_no)
    └── NO
        │
        Do roles need to be created or modified by admins at runtime?
        ├── YES ─────────────────────────────────────► Type 3: Full RBAC (roles + permissions tables)
        └── NO
            │
            Do you have 3+ roles?
            ├── YES ─────────────────────────────────► Type 2: Enum Role Column (default for most apps)
            └── NO ──────────────────────────────────► Type 1: Boolean is_admin flag
```

**Critical rule:** Choose based on the most complex role in your system, not the simplest. Migrating from Type 2 to Type 4 on live production data is expensive and risky. If any role has unique profile fields, use Type 4 from day one.

### 7.2 Default: Type 2 — Enum Role Column

The right choice for most applications. Simple, maintainable, fast.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'USER'
                CHECK (role IN ('USER', 'EDITOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  token_version INTEGER NOT NULL DEFAULT 0,  -- increment on logout, role change
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);
```

### 7.3 When to Use Type 4 — Persona-Based

If roles have structurally different data (doctor has `license_number` and `specialty`, patient has `blood_type` and `insurance_id`), use a shared users table for credentials and separate profile tables per role.

```
users (id, email, password_hash, role_type, is_active, is_verified)
    │
    ├── patient_profiles (user_id FK, date_of_birth, blood_type, insurance_id, ...)
    ├── doctor_profiles  (user_id FK, license_number, specialty, clinic_id, ...)
    └── staff_profiles   (user_id FK, employee_id, department_id, shift, ...)
```

### 7.4 Authentication Flow

```
POST /api/v1/auth/login
       │
       ▼
[1] Validate body (email, password) → 400 if invalid
       │
       ▼
[2] Look up user by email
       │
       ├── Not found → 401 (do NOT reveal "email not found")
       ▼
[3] Compare bcrypt/argon2 hash → 401 if mismatch
       │
       ▼
[4] Check is_active, is_verified → 403 with specific code if not
       │
       ▼
[5] Sign access token (15 min TTL)
    Sign refresh token (7 day TTL) → hash and store in refresh_tokens table
       │
       ▼
[6] Set refresh token as HttpOnly Secure SameSite=Strict cookie
    Return access token in response body
    Return { data: { accessToken, user: { id, email, role } } }
```

**Token design decisions:**

| Property | Access Token | Refresh Token |
|---|---|---|
| TTL | 15 minutes | 7–30 days |
| Storage (client) | Memory (preferred) or localStorage | HttpOnly cookie only |
| Transmission | `Authorization: Bearer <token>` header | Cookie (automatic) |
| Revocability | Not revocable; rely on short TTL | Revocable via DB/Redis delete |
| Payload | `{ userId, role, tokenVersion, iat, exp }` | Opaque random token (stored hashed in DB) |

**Never store sensitive data in the JWT payload.** The payload is base64-encoded, not encrypted.

### 7.5 Refresh Token Rotation

Every use of a refresh token issues a new refresh token and invalidates the previous one. If a stolen token is detected (reuse of an already-used token), all sessions for that user are immediately revoked.

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,  -- store SHA-256 hash; never plaintext
  family_id   UUID NOT NULL,                 -- token rotation family (for theft detection)
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.6 The authenticate Middleware

```js
// middleware/authenticate.js
const jwt    = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../lib/errors');

const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('auth.missing_token', 'Authentication required'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    req.user = { id: payload.userId, role: payload.role, tokenVersion: payload.tokenVersion };
    next();
  } catch (err) {
    next(new UnauthorizedError('auth.invalid_token', 'Invalid or expired token'));
  }
};

module.exports = authenticate;
```

### 7.7 Authorization Middleware

```js
// middleware/authorize.js
const { ForbiddenError } = require('../lib/errors');

// Role-based: requireRole('ADMIN') or requireRole(['ADMIN', 'MANAGER'])
const requireRole = (roles) => (req, _res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user?.role)) {
    return next(new ForbiddenError('auth.forbidden', 'Insufficient permissions'));
  }
  next();
};

// Permission-based: requirePermission('users:delete')
// Use when implementing Type 3 RBAC (permissions table)
const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user?.permissions?.includes(permission)) {
    return next(new ForbiddenError('auth.forbidden', 'Insufficient permissions'));
  }
  next();
};

module.exports = { requireRole, requirePermission };
```

### 7.8 Route Namespacing for Multi-Role Systems

When different roles represent fundamentally different user types (marketplace, healthcare, legal), namespace routes by role:

```
/api/v1/auth/*           ← Public: login, register, refresh, logout
/api/v1/me/*             ← Any authenticated user (own profile, password, sessions)

/api/v1/customer/*       ← requireRole('CUSTOMER')
/api/v1/provider/*       ← requireRole('PROVIDER')
/api/v1/admin/*          ← requireRole('ADMIN')
```

Mount role namespaces with a router-level `authenticate` + `requireRole`:

```js
// In routes/index.js
const adminRouter = require('../features/admin');
router.use('/admin', authenticate, requireRole('ADMIN'), adminRouter);
```

### 7.9 Security Pitfalls to Avoid

**1. Authorization at route level only:**
A route guard confirms role, but the query inside the handler must also be scoped. Passing `DOCTOR` guard and then running `SELECT * FROM patients` is a critical security bug.

```
WRONG:  DOCTOR guard passes → SELECT * FROM patients  (returns ALL patients)
CORRECT: DOCTOR guard passes → SELECT * FROM patients WHERE doctor_id = $1 (req.user.id)
```

**2. Role stored only in JWT, not re-validated:**
Roles can be revoked after a token is issued. For sensitive operations (admin actions, deletions), re-validate `is_active` and `token_version` against the database. Include `tokenVersion` in the JWT payload and increment it on role change or logout.

**3. Leaking role-specific data via shared endpoints:**
When a resource is accessed by multiple roles, serialize the response differently per role. A `GET /appointments/:id` handler must return different fields for a PATIENT vs DOCTOR vs ADMIN.

---

## 8. Request / Response Flow

### 8.1 Complete Request Flow

```
HTTP Client
    │
    ▼
[1] request-id           Generate UUID → attach to req.id and X-Request-Id header
    │
    ▼
[2] http-logger          Log: method, path, IP, request-id (request start)
    │
    ▼
[3] security             helmet (headers), cors (allowlist), rate-limit (IP/global)
    │
    ▼
[4] parse-body           express.json() with 1MB size limit
    │
    ▼
[5] Router               /api/v1 → feature router → route match
    │
    ▼
[6] validate(schema)     Joi validation on body/params/query → 400 on failure
    │
    ▼
[7] authenticate         Verify JWT → attach req.user → 401 on failure
    │
    ▼
[8] requireRole()        Check req.user.role → 403 on mismatch
    │
    ▼
[9] Controller           Read req → call service → shape response → res.json()
    │
    ▼
[10] Service             Business logic → call repository or throw AppError
    │
    ▼
[11] Repository          SQL query → return plain object or null
    │
    ▼
(response bubbles back up through the controller)
    │
    ▼
[12] http-logger         Log: status code, duration (request end)
    │
    ▼
[E] error-handler        If next(err) was called from any layer:
                           AppError → structured JSON + appropriate status code
                           Unknown error → 500, hide internals, log full stack
```

Note: Middleware order is fixed in `app.js`. The order of steps 6–8 (validate → authenticate → authorize) may be rearranged per route if needed (e.g., apply auth before validate on sensitive endpoints), but the global pre-route middleware order is always 1–4.

### 8.2 Canonical Response Formats

**Success:**
```json
// Single resource
{ "data": { "id": "uuid", "email": "user@example.com", "role": "USER" } }

// Collection
{ "data": [ {...}, {...} ], "meta": { "total": 120, "page": 2, "limit": 20 } }

// Created
// HTTP 201 + { "data": { ... } }

// No content (delete)
// HTTP 204 + no body
```

**Error:**
```json
{ "error": { "code": "users.not_found", "message": "User not found", "details": null } }

// Validation error
{ "error": { "code": "validation.failed", "message": "Validation failed", "details": [
  { "field": "email", "message": "must be a valid email address" }
]}}
```

**Response envelope rules:**
- Always use `{ data: ... }` for success. This leaves room to add `meta` (pagination) without breaking existing clients.
- Always use `{ error: { code, message, details } }` for failures. The `code` is a dot-namespaced string (`feature.error_name`) that clients can safely switch on.
- Never return different response shapes for the same status code.
- Never return the stack trace in production responses.

---

## 9. Layer Responsibilities

| Layer | File | Owns | Never |
|---|---|---|---|
| Routes | `routes.js` | HTTP verb, path, middleware wiring | Business logic, DB access, req parsing |
| Controller | `controller.js` | Parse `req`, call one service, shape `res` | Domain logic, direct DB, two service calls |
| Service | `service.js` | Business logic, orchestration, transactions | `req`/`res`, HTTP status codes, SQL |
| Repository | `repository.js` | SQL queries, DB persistence | Business rules, HTTP concerns, validation |
| Schema | `schema.js` | Input shape validation and coercion | Business invariants (email not already taken is service logic) |
| Middleware | `middleware/*.js` | Cross-cutting concerns (auth, logging, security) | Business logic, direct DB access |
| Lib | `lib/*.js` | Shared utilities (logger, db client, errors) | Express imports, feature-specific logic |
| Config | `config/index.js` | Validated env-to-config mapping | Default fallbacks that hide missing required vars |

**Transaction responsibility:**
Services own transaction boundaries. When two repository calls must be atomic, the service initiates the transaction and passes the transaction client (`trx`) to each repository call.

```js
// service.js
const createOrderWithPayment = async (data) => {
  return db.transaction(async (trx) => {
    const order   = await orderRepo.create(data.order, trx);
    const payment = await paymentRepo.create({ ...data.payment, orderId: order.id }, trx);
    return { order, payment };
  });
};
```

---

## 10. Dependency Flow & Import Rules

### 10.1 Allowed Import Directions

```
routes.js        → controller.js, schema.js, middleware/*
controller.js    → service.js
service.js       → repository.js, lib/errors.js, lib/db.js, other feature's service.js
repository.js    → lib/db.js, lib/errors.js
middleware/*     → lib/logger.js, lib/errors.js, config/index.js
lib/*            → (no feature imports — lib is the foundation layer)
config/index.js  → (no imports from src — reads only process.env)
```

### 10.2 Forbidden Import Directions

| Rule | Reason |
|---|---|
| `lib/` must not import from `features/` | Creates circular dependencies and defeats isolation |
| `repository.js` must not import `service.js` | Dependency inversion violation |
| `service.js` must not import `controller.js` | Services are framework-agnostic |
| `service.js` must not import another feature's `repository.js` | Cross-feature DB access creates hidden coupling; use the other feature's service instead |
| Any file must not import directly from another feature's `controller.js` or `routes.js` | Controllers are the feature's HTTP boundary |

### 10.3 Cross-Feature Communication

When Feature A needs data owned by Feature B:

```
WRONG:  orderService.js imports userRepository.js  (cross-feature repo access)
CORRECT: orderService.js imports userService.js     (cross-feature service call)
```

If Feature A and Feature B have genuine circular dependencies on each other, this is a signal the feature boundaries are wrong. Either merge them into one feature or extract the shared concept into a `lib/` utility.

### 10.4 The index.js Public Contract

Each feature exposes exactly one public file: `index.js`. This exports the Express router. All other files inside the feature are private implementation details.

```js
// features/users/index.js
const router = require('./routes');
module.exports = router;
// Nothing else is exported from this feature.
```

---

## 11. Naming Conventions

### 11.1 Files and Folders

| Item | Convention | Example |
|---|---|---|
| Feature folders | `kebab-case`, plural | `features/users/`, `features/auth/` |
| Files inside features | Single role-revealing name | `routes.js`, `controller.js`, `service.js` |
| Lib files | `kebab-case` noun | `logger.js`, `db.js`, `errors.js` |
| Middleware files | `kebab-case` action noun | `authenticate.js`, `validate.js`, `error-handler.js` |
| Test files | `<file>.test.js` | `service.test.js`, `controller.test.js` |
| Integration tests | `<feature>.test.js` | `tests/integration/users.test.js` |

**Rule:** Every filename must reveal its layer or purpose without opening it. `user.js` is prohibited; `service.js` inside `features/users/` is correct.

### 11.2 Code Identifiers

| Item | Convention | Example |
|---|---|---|
| Functions and variables | `camelCase` | `createUser`, `getUserById` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_LOGIN_ATTEMPTS`, `JWT_TTL` |
| Error codes | `dot.lower_snake_case` | `users.not_found`, `auth.invalid_token` |
| Classes (AppError subclasses) | `PascalCase` | `NotFoundError`, `ConflictError` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET` |

### 11.3 Route Conventions

| Rule | Example |
|---|---|
| Collections use plural nouns | `GET /api/v1/users` |
| Single resources use `:id` | `GET /api/v1/users/:id` |
| Nested resources use subpath | `GET /api/v1/users/:id/orders` |
| Non-CRUD actions use a verb suffix (POST only) | `POST /api/v1/users/:id/activate` |
| Kebab-case for multi-word paths | `/api/v1/reset-password`, `/api/v1/refresh-token` |

### 11.4 Database Conventions

| Item | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `users`, `refresh_tokens`, `audit_logs` |
| Column names | `snake_case` | `created_at`, `password_hash`, `is_active` |
| Primary keys | `id UUID` | Always UUID, never auto-increment integer |
| Timestamps | Mandatory on all tables | `created_at`, `updated_at`, and `deleted_at` for soft deletes |
| Foreign keys | `<table_singular>_id` | `user_id`, `order_id` |

---

## 12. Validation / Security / Error Handling

### 12.1 Validation Strategy

- Use **Joi** for schema validation. Collocate schemas with features in `schema.js`.
- Apply validation via a generic `validate(schema)` middleware factory on each route.
- Validate `body`, `params`, and `query` — never rely on the service or repository to catch shape errors.
- Always `stripUnknown: true` to reject unexpected fields.
- Coerce types at the schema level (lowercase emails, trim strings).

```js
// middleware/validate.js
const Joi = require('joi');
const { ValidationError } = require('../lib/errors');

const validate = (schema, target = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[target], { abortEarly: false });
  if (error) {
    const details = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
    return next(new ValidationError('validation.failed', 'Validation failed', details));
  }
  req[target] = value; // replace with coerced/sanitized value
  next();
};

module.exports = validate;
```

**Validation vs business rules distinction:**

| Concern | Layer | Example |
|---|---|---|
| Shape validation | Schema (Joi) | `email` must be valid email format |
| Type coercion | Schema (Joi) | Lowercase the email before processing |
| Business invariants | Service | Email must not already be registered |
| DB constraint violations | Repository (mapped to AppError) | Unique constraint → ConflictError |

### 12.2 Error Architecture

Define a base `AppError` and subclass per HTTP concern. Never throw raw `Error` objects from business code.

```js
// lib/errors.js
class AppError extends Error {
  constructor(code, message, details = null, statusCode = 500, isOperational = true) {
    super(message);
    this.name  = this.constructor.name;
    this.code  = code;       // dot-namespaced: 'users.not_found'
    this.statusCode = statusCode;
    this.details    = details;
    this.isOperational = isOperational; // false = programmer error, always log + alert
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError  extends AppError {
  constructor(code, message, details) { super(code, message, details, 400); }
}
class UnauthorizedError extends AppError {
  constructor(code, message) { super(code, message, null, 401); }
}
class ForbiddenError   extends AppError {
  constructor(code, message) { super(code, message, null, 403); }
}
class NotFoundError    extends AppError {
  constructor(code, message) { super(code, message, null, 404); }
}
class ConflictError    extends AppError {
  constructor(code, message) { super(code, message, null, 409); }
}
class RateLimitError   extends AppError {
  constructor(code, message) { super(code, message, null, 429); }
}

module.exports = { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, RateLimitError };
```

### 12.3 Global Error Handler

```js
// middleware/error-handler.js
const logger = require('../lib/logger');
const { AppError } = require('../lib/errors');
const config = require('../config');

const errorHandler = (err, req, _res, res) => {
  const isOperational = err instanceof AppError && err.isOperational;

  // Log all errors with request context
  logger.error({
    requestId: req.id,
    err: { code: err.code, message: err.message, stack: err.stack },
    isOperational,
  });

  // Operational (expected) errors: return safe structured response
  if (isOperational) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }

  // Programmer errors: never leak internals in production
  return res.status(500).json({
    error: {
      code:    'internal.server_error',
      message: config.isProduction ? 'An unexpected error occurred' : err.message,
      details: null,
    },
  });
};

module.exports = errorHandler;
```

### 12.4 Security Baseline (Non-Negotiable)

Every production Express backend must have all of the following applied unconditionally:

| Measure | Implementation |
|---|---|
| Security headers | `helmet()` — applied globally before routes |
| CORS | Explicit `origin` allowlist in config; never `*` in production |
| Rate limiting | `express-rate-limit` on all routes; stricter limits on `/auth/*` |
| Body size limit | `express.json({ limit: '1mb' })` — prevents payload attacks |
| Password hashing | `bcrypt` (cost factor 12) or `argon2` — never MD5 / SHA variants |
| Parameterized queries | All SQL uses `$1, $2` placeholders — never string concatenation |
| Secrets in env only | No secrets in source code; validated at boot |
| HTTPS only | TLS termination at load balancer or reverse proxy |
| Refresh token storage | Store SHA-256 hash of token — never the plaintext token |
| HttpOnly cookies | Refresh tokens in `HttpOnly Secure SameSite=Strict` cookies |
| Account lockout | Track failed login attempts; lock for N minutes after threshold |
| Soft deletes | `deleted_at` column; never hard-delete users or audit records |

```js
// middleware/security.js
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const config       = require('../config');

const security = [
  helmet(),
  cors({
    origin:      config.cors.allowedOrigins,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      200,              // per IP
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: { code: 'rate_limit.exceeded', message: 'Too many requests' } },
  }),
];

module.exports = { security };
```

Apply a tighter rate limiter on auth routes:

```js
// Inside features/auth/routes.js
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }); // 10/15min per IP
router.post('/login',    authLimiter, validate(schema.login),    controller.login);
router.post('/register', authLimiter, validate(schema.register), controller.register);
```

---

## 13. Configuration & Environment Management

### 13.1 The Golden Rule

`process.env` is read **exactly once**, at boot, in `config/index.js`. No other file in the application reads `process.env` directly. All configuration is accessed by importing the config object.

### 13.2 Config Structure

```js
// config/index.js
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV:            Joi.string().valid('development', 'production', 'test').required(),
  PORT:                Joi.number().integer().default(3000),
  DATABASE_URL:        Joi.string().uri().required(),
  JWT_ACCESS_SECRET:   Joi.string().min(32).required(),
  JWT_REFRESH_SECRET:  Joi.string().min(32).required(),
  JWT_ACCESS_TTL:      Joi.string().default('15m'),
  JWT_REFRESH_TTL:     Joi.string().default('7d'),
  CORS_ORIGINS:        Joi.string().required(),  // comma-separated list
  LOG_LEVEL:           Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  REDIS_URL:           Joi.string().uri().optional(),
}).unknown(false);  // Reject unknown env vars in strict mode (optional)

const { error, value: env } = schema.validate(process.env, { allowUnknown: true });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = Object.freeze({
  env:          env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest:       env.NODE_ENV === 'test',
  port:         env.PORT,
  db:           { url: env.DATABASE_URL },
  jwt: {
    accessSecret:  env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl:     env.JWT_ACCESS_TTL,
    refreshTtl:    env.JWT_REFRESH_TTL,
  },
  cors:   { allowedOrigins: env.CORS_ORIGINS.split(',').map(o => o.trim()) },
  log:    { level: env.LOG_LEVEL },
  redis:  { url: env.REDIS_URL || null },
});

module.exports = config;
```

**Config rules:**
- `Object.freeze()` prevents accidental mutation.
- Validation at boot: missing or invalid required env vars crash the app immediately — not silently at runtime when the feature is first used.
- Never use `||` fallbacks for security-critical values like secrets (Joi `required()` enforces this).
- `.env.example` must list every key with a comment explaining what it is. Commit this file; never commit `.env`.

### 13.3 Environment Files

```
.env.example         ← Committed; template with keys and comments, no real values
.env                 ← Git-ignored; local development secrets
.env.test            ← Git-ignored; test database and mocked service URLs
```

In production: inject environment variables through your cloud provider, Docker secrets, or a secrets manager (AWS Secrets Manager, HashiCorp Vault). Never bake secrets into Docker images.

---

## 14. Logging / Monitoring / Observability

### 14.1 Structured Logging with Pino

Use `pino` for all logging. It is the fastest Node.js logger, produces structured JSON by default, and integrates natively with Express via `pino-http`.

```js
// lib/logger.js
const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.log.level,
  redact: ['req.headers.authorization', 'body.password', 'body.token'],
  serializers: { err: pino.stdSerializers.err },
  ...(config.isProduction ? {} : { transport: { target: 'pino-pretty' } }),
});

module.exports = logger;
```

**Logging rules:**
- Never use `console.log` in production code. Use `logger.info`, `logger.error`, etc.
- Attach `req.id` (request ID) to every log line that relates to a request.
- Redact sensitive fields (passwords, tokens, PII) in the logger config — do not filter them manually.
- Log at the right level: `error` (failures requiring action), `warn` (recoverable issues), `info` (normal operations, request summaries), `debug` (verbose detail, dev only).

### 14.2 What to Log

| Event | Level | Required Fields |
|---|---|---|
| Request received / completed | `info` (via pino-http) | requestId, method, path, statusCode, duration |
| AppError thrown | `warn` | requestId, error.code, error.message |
| Programmer error (non-operational) | `error` | requestId, err.stack |
| Third-party service failure | `error` | requestId, service, duration, statusCode |
| Authentication failure | `warn` | requestId, email (if available), ip |
| Role/permission denied | `warn` | requestId, userId, requiredRole, userRole |
| Application startup / shutdown | `info` | port, env |

**Never log:** passwords, JWT tokens, credit card numbers, full Social Security Numbers, or any field listed in your data classification policy as sensitive.

### 14.3 Health and Readiness Endpoints

```
GET /healthz    ← Liveness: is the process alive? Returns 200 immediately.
GET /readyz     ← Readiness: can the process serve traffic? Checks DB + Redis.
GET /metrics    ← Prometheus metrics (prom-client). Exclude from public access.
```

```js
// middleware/readiness.js
const { db }    = require('../lib/db');
const redis     = require('../lib/redis');   // optional

const readiness = async (_req, res) => {
  try {
    await db.query('SELECT 1');
    // await redis.ping(); // uncomment if Redis is required
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
};

module.exports = readiness;
```

### 14.4 Metrics with prom-client

Expose Prometheus-compatible metrics at `/metrics`. At minimum, track:

- HTTP request count by method, path, and status code.
- HTTP request duration (histogram, p50/p95/p99).
- Active database pool connections vs. pool size.
- Node.js default metrics (heap, GC, event loop lag) — auto-collected by prom-client.

Protect `/metrics` with a network policy or a simple token check. Do not expose it publicly.

---

## 15. Testing Strategy

### 15.1 Test Pyramid

| Type | What to test | Tool | Target share |
|---|---|---|---|
| Unit | Services and lib utilities in isolation (mocked repos) | Jest | ~70% |
| Integration | Full request-to-DB flow via `createApp()` + test DB | Jest + Supertest | ~25% |
| E2E | Critical user flows end-to-end | Supertest (or Playwright for browser) | ~5% |

**Test philosophy:** Test behaviors, not implementation. A test should verify: given this input, produce this output. A test that breaks every time you rename an internal variable is noise, not signal.

### 15.2 Unit Test Structure

```
features/users/__tests__/
    service.test.js       ← Unit: mock repository, test business logic
    controller.test.js    ← Unit: mock service, test HTTP parsing (rare)
```

```js
// features/users/__tests__/service.test.js
const userService = require('../service');
const userRepo    = require('../repository');
const { ConflictError } = require('../../../lib/errors');

jest.mock('../repository');

describe('userService.createUser', () => {
  it('throws ConflictError if email already exists', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 'existing-id' });

    await expect(userService.createUser({ email: 'taken@example.com', password: 'pass1234' }))
      .rejects.toThrow(ConflictError);
  });

  it('creates user and returns it without password_hash', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.create.mockResolvedValue({ id: 'new-id', email: 'new@example.com', role: 'USER' });

    const result = await userService.createUser({ email: 'new@example.com', password: 'pass1234' });
    expect(result).toMatchObject({ email: 'new@example.com', role: 'USER' });
    expect(result.password_hash).toBeUndefined();
  });
});
```

### 15.3 Integration Test Structure

```
tests/
├── integration/
│   ├── auth.test.js       ← Full auth flow: register, login, refresh, logout
│   ├── users.test.js      ← CRUD + auth on user endpoints
│   └── ...
└── fixtures/
    └── user.factory.js    ← Factory functions for test data
```

```js
// tests/integration/users.test.js
const request = require('supertest');
const { createApp } = require('../../src/app');
const { db }        = require('../../src/lib/db');
const { createUser, createAdminToken } = require('../fixtures/user.factory');

const app = createApp();

beforeEach(async () => {
  await db.query('DELETE FROM users WHERE email LIKE $1', ['%@test.example.com']);
});

afterAll(() => db.disconnect());

describe('GET /api/v1/users/me', () => {
  it('returns the authenticated user profile', async () => {
    const { token } = await createUser({ email: 'me@test.example.com' });

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.example.com');
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.missing_token');
  });
});
```

### 15.4 Test Database Strategy

- Use a real database in integration tests (not an in-memory mock). DB behavior (constraints, indexes, query plans) matters.
- Use a dedicated test database (`DATABASE_URL` pointing to `_test` suffix DB in `.env.test`).
- Clean up test data in `beforeEach` using targeted `DELETE` statements (faster than full truncation on small datasets) or wrap each test in a transaction that rolls back.
- Never run integration tests against a production or staging database.

### 15.5 CI Pipeline

```
lint → unit tests → integration tests → build check
```

- Fail fast: lint and unit tests run first (fast). Integration tests run after (slower).
- Run `jest --coverage` and fail the build if coverage drops below your minimum threshold.
- Use a matrix to test against Node LTS versions.

---

## 16. API Design & Versioning

### 16.1 Versioning Strategy

Use URL-based versioning (`/api/v1/...`). It is explicit, cache-friendly, and universally understood.

```
/api/v1/users          ← Current stable version
/api/v2/users          ← New version with breaking changes (when needed)
```

**When to increment the version:**
- Removing a field from a response.
- Changing a field's type.
- Changing route structure.
- Changing authentication requirements.

**Never increment for:** adding optional fields, adding new routes, fixing bugs.

**Version lazily:** Create v2 only when breaking changes are necessary. Prefer backward-compatible additions for as long as practical. When you do create v2, run v1 and v2 from the same codebase — do not duplicate the entire app.

### 16.2 RESTful Design Rules

| Rule | Example |
|---|---|
| Plural nouns for collections | `GET /api/v1/users` not `/api/v1/user` |
| HTTP method expresses the operation | `DELETE /api/v1/users/:id` not `POST /api/v1/users/:id/delete` |
| Nested resources for relationships | `GET /api/v1/users/:id/orders` |
| Non-CRUD actions: POST + verb suffix | `POST /api/v1/users/:id/activate` |
| Filtering via query string | `GET /api/v1/users?role=ADMIN&isActive=true` |
| Pagination via `page` and `limit` | `GET /api/v1/users?page=2&limit=20` |
| Sorting via `sort` query param | `GET /api/v1/users?sort=createdAt:desc` |

### 16.3 Pagination Response

```json
{
  "data": [...],
  "meta": {
    "total":   247,
    "page":    2,
    "limit":   20,
    "pages":   13,
    "hasNext": true,
    "hasPrev": true
  }
}
```

For large datasets (> 100k rows), prefer cursor-based pagination over offset pagination. Offset pagination becomes slow at high offsets because the database must scan and discard rows.

### 16.4 OpenAPI Documentation

Maintain an `openapi.yaml` file in `src/docs/`. This is the source of truth for your API contract. Serve it in development/staging at `/docs` using `swagger-ui-express`.

Keep the spec synchronized with your implementation. A spec that diverges from the actual behavior is worse than no spec — it actively misleads clients. Consider using `joi-to-swagger` or `zod-to-openapi` to generate spec fragments from your validation schemas.

---

## 17. Scaling Guidelines

### 17.1 Stateless Design (Required from Day One)

Design every request handler to be stateless. The request must be fully processable without any in-memory state from previous requests. This enables horizontal scaling (multiple instances) without coordination.

- Store sessions in the database or Redis, not in-process.
- Use JWT access tokens (stateless) + hashed refresh tokens in the DB.
- Do not use module-level caches that accumulate request-specific state.

### 17.2 Database Connection Pooling

Never create a new database connection per request. Use a connection pool and configure it appropriately for your deployment.

```js
// lib/db.js (pg pool example)
const { Pool } = require('pg');
const config   = require('../config');

const pool = new Pool({
  connectionString: config.db.url,
  max:             20,   // max connections per instance; tune based on DB max_connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Simple query helper
const query = (text, params) => pool.query(text, params);

// Transaction helper
const transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const connect    = () => pool.connect();
const disconnect = () => pool.end();

module.exports = { query, transaction, connect, disconnect };
```

### 17.3 Caching Strategy

Introduce caching only when you have measured that a query is slow or a resource is hit at high frequency. Do not cache preemptively.

| What to cache | TTL | Invalidation trigger |
|---|---|---|
| User permissions (Type 3 RBAC) | 5–15 min | Role change, permission update |
| User profile (frequently read) | 5 min | Profile update |
| Reference data (roles, categories) | 60 min | Admin update |
| Session / rate-limit counters | Per-feature | TTL expiry |

Use Redis. Never cache in-process (in-memory caching breaks with multiple instances).

### 17.4 Background Jobs

Offload slow operations to background job workers. Return `202 Accepted` immediately and process asynchronously.

Examples of operations that belong in background jobs:
- Sending emails or SMS.
- Generating reports or exports.
- Processing uploaded files.
- Syncing data with third-party APIs.

Use `bull` (Redis-based) or `pg-boss` (PostgreSQL-based) for job queues. Choose `pg-boss` if you want to avoid a Redis dependency. Use `bull` if you need high throughput or real-time job processing.

Place job definitions in a top-level `jobs/` folder:

```
jobs/
├── index.js               ← Queue setup and worker registration
├── email/
│   ├── send-welcome.job.js
│   └── send-reset-password.job.js
└── reports/
    └── generate-export.job.js
```

### 17.5 When to Extract a Microservice

Do not extract microservices preemptively. Stay on the modular monolith until at least one of these conditions is true:

- A specific feature has wildly different scaling requirements (e.g., video processing).
- Team grows past 5+ developers needing independent release cycles.
- A feature has strict security/compliance isolation requirements.
- Multiple different technology stacks are genuinely justified for different features.

When you do extract: each `features/<name>` folder is a natural candidate. The service boundary is already enforced by the import rules — the extraction is mostly infrastructure work, not code restructuring.

---

## 18. Project Evolution Strategy

### 18.1 Early Stage (Weeks 1–8, <10 endpoints)

- Start with the full feature-based structure from the beginning. Do not start "flat" and plan to restructure later. Restructuring under time pressure creates debt.
- Implement only what is needed: `app.js`, `server.js`, `config/`, `lib/` (logger, db, errors), 2–3 features.
- Add `middleware/` piece by piece: security and error-handler first; auth after the first protected route is needed.
- Write integration tests from the start. Adding them later is always harder.
- Do not add Redis, job queues, or caching yet unless they are explicitly required for the MVP.

### 18.2 Growth Stage (Months 2–6, 10–30 endpoints)

- Extract code to `lib/` only when it is used by a second feature.
- Add pagination to all list endpoints before they go to production.
- Add `/metrics` (prom-client) and set up basic alerting.
- Begin tracking slow queries; add missing indexes.
- Add Redis if you need distributed rate limiting or session-level caching.
- Introduce job queues when the first "slow" operation appears (email sending, file processing).

### 18.3 Mid-Scale Stage (6+ months, 30+ endpoints)

- Audit cross-feature service dependencies; refactor feature boundaries if coupling is too tight.
- Introduce stricter transaction management patterns if financial consistency is required.
- Add cursor-based pagination to high-volume list endpoints.
- Consider read replicas for heavy read loads.
- Consider extracting the most independently scalable feature into a separate service.
- Document Architecture Decision Records (ADRs) for any significant architectural changes.

### 18.4 ADR Template

Document every significant architectural decision as an Architecture Decision Record:

```
Title:        [Short descriptive title]
Date:         YYYY-MM-DD
Status:       Proposed | Accepted | Deprecated | Superseded

Context:      What situation led to this decision?
Decision:     What was decided?
Reasoning:    Why this option over the alternatives considered?
Alternatives: What else was evaluated and why it was not chosen?
Consequences: What are the positive and negative outcomes? What does this change?
```

Store ADRs in `docs/adr/` or in the repository wiki. Review them when onboarding new team members.

---

## 19. Anti-Patterns to Avoid

### 1. God Files
**Symptom:** A single `routes.js` or `controller.js` with 500+ lines mixing routing, business logic, and SQL queries.  
**Fix:** One route file per feature. One controller function per handler. Move business logic to the service. Move SQL to the repository.

### 2. Utility Dump / "Utils Graveyard"
**Symptom:** A `utils/` folder with 40 unrelated helper functions imported by everything.  
**Fix:** Keep utilities feature-local. Promote to `lib/` only when shared across 2+ features AND they form a cohesive concept (not just "miscellaneous").

### 3. Fat Controllers
**Symptom:** Controllers containing if/else domain logic, direct DB calls, or multiple service invocations.  
**Fix:** Controllers are HTTP adapters only — parse req, call one service, shape res. Move domain logic to services.

### 4. Cross-Feature Repository Access
**Symptom:** `orderService.js` imports `userRepository.js` to look up a user.  
**Fix:** `orderService.js` imports `userService.js`. Cross-feature data access always goes through the service boundary, never the repository directly.

### 5. Leaking req/res into Services
**Symptom:** Services accept `req` objects or reference `res.status()`.  
**Fix:** Services receive plain data objects only (IDs, DTOs). They return plain objects or throw AppErrors. They never know they are inside an HTTP request.

### 6. Reading process.env Everywhere
**Symptom:** `const secret = process.env.JWT_SECRET` scattered across files.  
**Fix:** `process.env` is read only in `config/index.js`. All other files import the frozen config object.

### 7. Throwing Raw Errors
**Symptom:** `throw new Error('User not found')` from services.  
**Fix:** Always throw typed `AppError` subclasses. This enables the global error handler to map them to correct HTTP status codes and response shapes automatically.

### 8. Inconsistent Response Shapes
**Symptom:** Some routes return `{ user: {...} }`, others return `{ data: {...} }`, others return a flat object.  
**Fix:** Enforce the canonical response envelope: `{ data: ... }` for success, `{ error: { code, message, details } }` for failure — always, in every controller.

### 9. Authorization at Route Level Only
**Symptom:** Route guard passes, but the query inside retrieves all records, not just those belonging to the authenticated user.  
**Fix:** Enforce ownership scoping at the data access layer. Route guards confirm role; queries must be scoped to the authenticated user's context.

### 10. No Health Checks and No Metrics
**Symptom:** You discover a degraded service from user complaints, not from dashboards.  
**Fix:** Implement `/healthz` and `/readyz` from day one. Add prom-client metrics before the first deployment. Set up alerts before your first user.

### 11. Premature Microservices
**Symptom:** Splitting into 5 microservices before the MVP is stable.  
**Fix:** Build the modular monolith. Each feature folder is already a clean unit with well-defined boundaries. Extract to a service only when you have a concrete, measured reason.

### 12. Auto-Loading Routes via Filesystem Globs
**Symptom:** `fs.readdirSync('./features').forEach(f => app.use(require(f)))`.  
**Fix:** Explicitly mount each feature router in `routes/index.js`. One line per feature, always visible, always debuggable.

### 13. console.log in Production Code
**Symptom:** Unstructured logs with no request IDs, no levels, no redaction.  
**Fix:** Always use the `pino` logger. `console.log` is banned from `src/` (enforce with ESLint: `no-console` rule).

### 14. No Soft Deletes on Critical Data
**Symptom:** A `DELETE FROM users WHERE id = $1` erases user history and makes audit trails impossible.  
**Fix:** Use `deleted_at TIMESTAMPTZ` on all business-critical tables. All queries filter `WHERE deleted_at IS NULL`. Permanent deletion is a scheduled cleanup job, not an ad-hoc query.

---

## 20. Final Recommendation

### 20.1 Definitive Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node.js LTS (≥ 18) | LTS stability; async support; large ecosystem |
| Framework | Express.js 4.x / 5.x | Minimal, flexible, well-understood |
| Language | JavaScript (CommonJS) | Avoids TypeScript toolchain overhead for small teams; ESM optional |
| Validation | Joi | Mature, expressive, excellent error messages; Zod acceptable alternative |
| Logging | pino + pino-http | Fastest Node.js logger; JSON structured by default |
| Database access | pg (node-postgres) + raw SQL or knex | Transparent, performant; Prisma acceptable if migrations are needed |
| Testing | Jest + Supertest | Industry standard; excellent async support |
| Security headers | helmet | One-line industry standard |
| Rate limiting | express-rate-limit | Simple, composable; add Redis store for horizontal scale |
| Password hashing | bcrypt (cost 12) or argon2 | Memory-hard; resistant to GPU brute-force |
| JWT | jsonwebtoken | Standard; well-audited |
| Metrics | prom-client | Prometheus-compatible; official Node.js client |
| Linting | ESLint + Prettier | Consistent code style, enforced in CI |

### 20.2 Decision Summary

| Architectural Decision | Chosen Approach | Why |
|---|---|---|
| Code organization | Feature-based modular monolith | Context locality, isolated vertical slices, easy extraction later |
| Shared utilities | `lib/` (extracted after 2nd use) | No premature generalization; no utility graveyard |
| API structure | REST + URL versioning (`/api/v1`) | Explicit, cache-friendly, universally understood |
| Auth mechanism | JWT (access) + hashed refresh token in DB | Stateless access + revocable long-lived sessions |
| Role architecture | Type 2 default; Type 4 if profiles differ | Choose based on domain, not convenience |
| Error handling | AppError hierarchy + global error handler | Consistent, typed, safe error propagation |
| Response format | `{ data }` / `{ error: { code, message, details } }` | Consistent, client-friendly, extensible |
| Config management | Validated at boot in config/index.js | Fail fast on missing secrets; single source of truth |
| Testing approach | Unit (Jest) + Integration (Supertest + real DB) | Test behaviors, not implementation details |
| Scaling approach | Stateless + horizontal + connection pool | Ready from day one; no rework required |

---

## 21. Starter Template Tree

The minimum viable starting point. Add infrastructure pieces incrementally as they are needed.

```
project-root/
│
├── src/
│   ├── app.js
│   ├── server.js
│   │
│   ├── config/
│   │   └── index.js
│   │
│   ├── lib/
│   │   ├── logger.js
│   │   ├── db.js
│   │   └── errors.js
│   │
│   ├── middleware/
│   │   ├── request-id.js
│   │   ├── http-logger.js
│   │   ├── security.js
│   │   ├── parse-body.js
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── validate.js
│   │   ├── not-found.js
│   │   └── error-handler.js
│   │
│   ├── features/
│   │   │
│   │   ├── auth/
│   │   │   ├── routes.js          ← /login, /register, /refresh, /logout
│   │   │   ├── controller.js
│   │   │   ├── service.js         ← hashPassword, signTokens, verifyRefreshToken
│   │   │   ├── repository.js      ← findByEmail, storeRefreshToken, revokeToken
│   │   │   ├── schema.js          ← login, register Joi schemas
│   │   │   ├── index.js
│   │   │   └── __tests__/
│   │   │       └── service.test.js
│   │   │
│   │   └── users/
│   │       ├── routes.js          ← /me, /:id (admin), / (admin list)
│   │       ├── controller.js
│   │       ├── service.js
│   │       ├── repository.js
│   │       ├── schema.js
│   │       ├── index.js
│   │       └── __tests__/
│   │           └── service.test.js
│   │
│   ├── routes/
│   │   └── index.js               ← Mounts /auth and /users; add new features here
│   │
│   └── docs/
│       └── openapi.yaml
│
├── tests/
│   ├── integration/
│   │   ├── auth.test.js
│   │   └── users.test.js
│   └── fixtures/
│       └── user.factory.js
│
├── scripts/
│   └── seed.js
│
├── .env.example
├── .env                           ← git-ignored
├── .eslintrc.cjs
├── .prettierrc
├── jest.config.js
├── package.json
└── README.md
```

**What to add next (in order, as needed):**

1. `lib/crypto.js` — Password hashing utilities (bcrypt/argon2 wrappers).
2. Additional features (`orders/`, `products/`, etc.) — copy the `users/` structure.
3. `lib/redis.js` — When you need distributed rate limiting, session caching, or job queues.
4. `jobs/` folder — When the first background operation appears.
5. `src/docs/openapi.yaml` — Start from day one; update with each new endpoint.
6. `middleware/readiness.js` — DB + Redis health check; needed before first production deployment.
7. `docker/Dockerfile` + `docker/docker-compose.yml` — Containerization.
8. `.github/workflows/ci.yml` — CI pipeline (lint + test + build check).

---

> **Closing Principle:** Architecture discipline is a forcing function, not a bureaucratic overhead. The patterns in this guide exist to ensure that at month 18 — when the team is under pressure to ship — the codebase is still clean, the error messages are still readable, the tests still pass, and a new developer can become productive in their first week. That is the only metric that matters.

---

*Production-Grade Node.js + Express.js Backend Architecture · JavaScript · Small Team Reference · v1.0*

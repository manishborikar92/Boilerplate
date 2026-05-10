# CA-Workflow Server

Backend API and realtime server for CA-Workflow.

This service owns authentication, firm and client workflows, document handling, payments, subscriptions, notifications, and realtime thread updates. It is an Express 5 + MongoDB application with Socket.IO running on the same HTTP server.

## What This Backend Owns

- JWT-based authentication and session lifecycle
- Firm, client, and profile management
- Document upload, storage, access control, and locking
- Razorpay payment and subscription flows
- Thread/message communication workflows
- In-app, email, SMS, and WhatsApp notifications
- Realtime thread and notification updates over Socket.IO

## Stack

| Area | Technology |
|------|------------|
| Runtime | Node.js 18+ |
| HTTP API | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT + Firebase Admin |
| File Storage | Cloudinary |
| Payments | Razorpay |
| Email | Resend active, SMTP fallback |
| Messaging | Twilio |
| Realtime | Socket.IO |
| Testing | Jest, Supertest, mongodb-memory-server |

## Quick Start

### Prerequisites

- Node.js 18 or newer
- MongoDB running locally or via Atlas
- A valid `server/.env` copied from [`.env.example`](./.env.example)
- Service credentials for the integrations you plan to exercise

### Install

```bash
cd server
npm install
```

### Configure

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

Minimum useful local development configuration:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/ca-flow
JWT_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me-too
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RESEND_API_KEY=re_xxx
RESEND_FROM=CA-Workflow <no-reply@your-domain.com>
```

### Run

```bash
npm run dev
```

The backend will start on `http://localhost:5000`.

Useful endpoints:

- API root: `http://localhost:5000/`
- Health check: `http://localhost:5000/api/health`
- REST base: `http://localhost:5000/api`
- Socket.IO: same origin as the HTTP server

## Environment Configuration

The full variable list lives in [`.env.example`](./.env.example). These are the main groups to understand when onboarding.

### Core Server

- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`

`FRONTEND_URL` is required and supports a single origin or a comma-separated list. It is used for REST CORS, Socket.IO CORS, and frontend link generation.

### Database and Auth

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRE`

### Firebase

- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`

Firebase Admin is initialized during server startup and is used for authentication-related flows.

### Cloudinary

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Required for document uploads and media storage.

### Razorpay

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_MONTHLY_ID`
- `RAZORPAY_PLAN_QUARTERLY_ID`
- `RAZORPAY_PLAN_HALFYEARLY_ID`

Subscription plan IDs are usually created and updated via the scripts in [`scripts/`](./scripts/).

### Email

Active provider:

- `RESEND_API_KEY`
- `RESEND_FROM`

Fallback SMTP provider:

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`

Provider details and switching guidance live in [Email Provider Architecture](./docs/EMAIL_PROVIDER_ARCHITECTURE.md).

### Twilio

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_WHATSAPP_NUMBER`
- `TWILIO_WHATSAPP_TEMPLATE_NOTIFICATION_SID`
- `TEST_PHONE_NUMBER`

These are only needed when testing or using SMS and WhatsApp features.

## Architecture At A Glance

High-level request flow:

```text
HTTP / Socket request
  -> middleware (helmet, cors, logging, rate limiting, auth, validation)
  -> route
  -> controller
  -> service
  -> model / external provider
  -> API response or realtime emission
```

Entrypoints:

- [`src/server.js`](./src/server.js): process startup, MongoDB connection, Firebase/Cloudinary initialization, graceful shutdown, Socket.IO bootstrap
- [`src/app.js`](./src/app.js): Express app wiring, middleware, routes, health check, error handling

The backend keeps transport concerns thin in routes/controllers and pushes business logic into services.

## Project Structure

```text
server/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/        # Provider and platform configuration
│   ├── constants/     # Shared domain constants
│   ├── controllers/   # Route handlers
│   ├── middleware/    # Auth, validation, logging, rate limiting, uploads
│   ├── models/        # Mongoose models
│   ├── routes/        # API route groups
│   ├── services/      # Business logic and provider integrations
│   ├── templates/     # Email templates
│   └── utils/         # JWT, email helpers, token blacklist, misc helpers
├── scripts/           # Setup, migration, verification, and maintenance scripts
├── tests/             # Unit and integration tests
├── docs/              # Backend-specific docs
├── .env.example
├── jest.config.js
└── package.json
```

## Domain Modules

### API Route Groups

| Route Base | Responsibility |
|-----------|----------------|
| `/api/auth` | Registration, login, refresh, password and auth flows |
| `/api/firms` | Firm profile and firm-level management |
| `/api/clients` | Client creation and client management |
| `/api/documents` | Uploads, retrieval, access control, payment-locked docs |
| `/api/payments` | Payment orders, verification, webhook-related flows |
| `/api/subscriptions` | Plan listing, subscription upgrades, firm subscription state |
| `/api/threads` | Threads, messages, statuses, collaboration flows |
| `/api/notifications` | Notification retrieval and notification state changes |

### Key Service Areas

| Area | Main Files |
|------|------------|
| Payments | `src/services/razorpayService.js`, `src/services/chatMessagePaymentService.js` |
| Subscriptions | `src/services/subscriptionService.js`, `src/constants/plans.js` |
| Documents | `src/services/cloudinaryService.js`, `src/services/documentLockService.js` |
| Notifications | `src/services/notificationService.js`, `src/services/emailNotificationService.js`, `src/services/smsNotificationService.js`, `src/services/whatsappNotificationService.js` |
| Email | `src/services/resendService.js`, `src/services/emailService.js` |
| Realtime | `src/config/socket.js`, `src/services/socketManager.js` |

### Data Model Snapshot

Core models in `src/models/`:

- `User`
- `Firm`
- `Client`
- `Document`
- `Folder`
- `Payment`
- `Subscription`
- `Thread`
- `Message`
- `Notification`
- `Session`
- `Counter`

There are also some `*.old.js` files in the models directory. Treat them as legacy references, not active models.

## Developer Workflow

### Common Commands

```bash
npm run dev
npm start
npm test
npm run test:watch
npm run test:unit
npm run test:integration
npm run generate-jwt
```

### Testing

The test suite uses Jest, Supertest, and MongoDB Memory Server.

- Test config: [`jest.config.js`](./jest.config.js)
- Test guide: [`tests/README.md`](./tests/README.md)

Coverage is collected from `src/**/*.js` while excluding `src/server.js`, legacy `*.old.js` files, and script directories.

### Useful Setup and Maintenance Scripts

Start here for operational scripts: [`scripts/README.md`](./scripts/README.md)

Commonly used scripts:

- `node scripts/create_razorpay_plans.js`
- `node scripts/seed-subscription-plans.js`
- `node scripts/fix-customer-ids.js`
- `node scripts/test-subscription-flow.js`
- `node scripts/test-razorpay-integration.js`
- `node scripts/test-email-integration.js`
- `node scripts/generate-jwt-secrets.js`

### Where To Look First

- New route or endpoint work: `src/routes/` -> `src/controllers/` -> `src/services/`
- Validation and access issues: `src/middleware/`
- Provider or credential issues: `src/config/` and `src/services/`
- Data shape questions: `src/models/`
- Realtime behavior: `src/config/socket.js` and `src/services/socketManager.js`

## Operations Notes

This README is intentionally not a full deployment runbook. Keep this section short and use the linked docs for the details.

### Health and Runtime

- Health endpoint: `/api/health`
- Includes database state, uptime, process details, and websocket metrics
- Graceful shutdown handles HTTP close, Socket.IO close, MongoDB disconnect, and token blacklist cleanup

### Realtime

- Socket.IO runs on the same server as the REST API
- Connections are authenticated with the same JWT access tokens used by the API
- Transport supports websocket and polling, with connection state recovery enabled

### Production Readiness

- Set a production `FRONTEND_URL`
- Use production MongoDB and provider credentials
- Generate strong JWT secrets
- Use Razorpay live keys and live plan IDs only after KYC and deployment prep
- Keep email and Twilio credentials environment-specific

For deployment-specific guidance, see the linked docs below.

## Related Documentation

### Backend-Specific Docs

- [Email Provider Architecture](./docs/EMAIL_PROVIDER_ARCHITECTURE.md)
- [Scripts README](./scripts/README.md)
- [Tests README](./tests/README.md)

### Project Docs

- [Documentation Hub](../docs/README.md)
- [Project Setup Guide](../docs/getting-started/setup.md)
- [API Reference](../docs/api/reference.md)
- [System Architecture](../docs/architecture/system-architecture.md)
- [Subscription Plan Specification](../docs/product/subscriptions/plan-specification.md)
- [Realtime WebSocket Implementation Guide](../docs/development/realtime/websocket-implementation-guide.md)
- [WebSocket Production Setup](../docs/deployment/realtime/websocket-production-setup.md)
- [Razorpay Plans Setup](../docs/integrations/razorpay/plans-setup.md)
- [Razorpay Live Mode Migration](../docs/integrations/razorpay/live-mode-migration.md)

## Notes For Contributors

- Keep controller files thin and push business rules into services.
- Prefer updating existing domain modules over introducing parallel abstractions.
- Follow the current CommonJS module pattern used throughout `src/`.
- If you add new backend-focused docs, link them from this README only when they help onboarding or core maintenance.

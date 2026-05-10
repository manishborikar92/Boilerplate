# Enterprise Express Backend Template

Reusable Node.js + Express backend template extracted from `server-2` and `server-3`.

## Design Choices

- ESM and Express 5 app factory from `server-3`, improved with stronger security and runtime lifecycle ideas from `server-2`.
- Generic template only: no payment, payout, Cloudinary, Firebase, business routes, uploads, or domain models live in `server/`.
- Feature routes mount through one router factory, so future projects can add modules without changing `app.js`.
- Request lifecycle is standardized: request id, Helmet, CORS, request logging, body parsers, rate limiting, routes, 404, global error handler.
- Validation uses Joi and stores sanitized data in `req.validated` without mutating `req.body`, matching the cleaner pattern from `server-3`.
- Auth is generic JWT middleware. It can attach only token claims or call a project-provided `resolveUser`.
- API responses use one envelope: `{ success, message, data, meta? }`.
- MongoDB is optional and controlled by `DATABASE_ENABLED`, so the template can boot before a project chooses persistence.

## Structure

```text
server/
  src/
    app.js                    # Express app factory
    server.js                 # Process startup and graceful shutdown
    config/                   # Env, CORS, Helmet, database
    core/                     # Base repository and lifecycle helpers
    middleware/               # Request, validation, auth, error handling
    modules/health/           # Health, liveness, readiness endpoints
    routes/                   # Router composition
    utils/                    # Logger, responses, errors, serialization
    validators/               # Reusable Joi schemas
  tests/
```

## Commands

```bash
npm install
npm test
npm run dev
npm start
```

## Endpoints

- `GET /`
- `GET /api/v1/health`
- `GET /api/v1/live`
- `GET /api/v1/ready`

## Adding A Feature Module

Create a folder such as `src/modules/users/` with route, controller, service, repository, serializer, and validator files. Then mount it through `configureRoutes` or `src/routes/index.js`.

```js
import createApp from './src/app.js';
import usersRoutes from './src/modules/users/users.routes.js';

const app = createApp({
  configureRoutes(router) {
    router.use('/users', usersRoutes);
  },
});
```

## Optional Provider Modules

Provider integrations are kept outside this template:

- `../payment-module`
- `../payout-module`
- `../storage-module`
- `../firebase-module`
- existing `../email-module`

Install or copy only the modules a future project needs.

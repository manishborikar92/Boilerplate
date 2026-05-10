# Architecture Decisions

This template was built by comparing `server-2/` and `server-3/` and keeping only reusable backend infrastructure.

## Entrypoints

- `server-2` had stronger security, detailed health data, rate limiting, and graceful shutdown, but mixed provider initialization and project features into startup.
- `server-3` had a cleaner ESM app factory and async startup, but provider cron jobs and domain pollers were coupled to `server.js`.
- Final decision: keep an ESM `createApp()` factory and `startServer()` lifecycle, with optional database connection and generic shutdown cleanup hooks.

## Middleware

- `server-2` had Helmet, CORS, production logging, rate limiting, raw body capture, and a good 404/error sequence.
- `server-3` had simpler route composition and validation into `req.validated`.
- Final decision: request id, Helmet, CORS, request logging, JSON/urlencoded body parsing with raw body capture, API rate limiting, router, 404, error handler.

## Config

- `server-2` used direct `process.env` access in many files.
- `server-3` centralized config but included business/provider settings.
- Final decision: one validated config module with only template-level settings. Provider config belongs in optional modules or consuming apps.

## Auth And Authorization

- `server-2` tied auth middleware directly to the `User` model and token blacklist.
- `server-3` had cleaner JWT token claim handling but still depended on project repositories and roles.
- Final decision: generic JWT authentication attaches `req.auth`; projects can pass `resolveUser` when they want database-backed auth. RBAC and permission middleware are provider/domain agnostic.

## Validation

- `server-2` used `express-validator` with many project-specific rules in one file.
- `server-3` used Joi validators and kept sanitized input separate.
- Final decision: Joi middleware stores sanitized data in `req.validated[source]` and does not mutate Express-owned request properties.

## Errors And Responses

- `server-2` had a useful error hierarchy and database error normalization.
- `server-3` had a cleaner response envelope and serializer.
- Final decision: combine both into `AppError`, centralized database error normalization, response serialization, and one API envelope.

## Logging

- `server-2` used Winston file transports.
- `server-3` used dependency-light JSON logging with sensitive data redaction.
- Final decision: dependency-light JSON logger with redaction. A production app can swap this behind the same logger interface.

## Health Checks

- `server-2` exposed detailed uptime/process/database health.
- `server-3` exposed a simpler health endpoint through the route index.
- Final decision: include `/health`, `/live`, and `/ready`; readiness checks the database only when `DATABASE_ENABLED=true`.

## Project-Specific Integrations

Removed from `server/` and redesigned as optional modules:

- Payments: `payment-module/` with Razorpay and PhonePe adapters.
- Payouts: `payout-module/` with Cashfree adapter.
- Storage: `storage-module/` with Cloudinary adapter.
- Firebase: `firebase-module/` with reusable Admin initialization and token verification helpers.
- Email remains in the existing `email-module/`.

## Naming

- Use kebab-case filenames with role suffixes, such as `request-logger.middleware.js`.
- Keep feature folders under `src/modules/<feature>/`.
- Keep cross-cutting infrastructure under `src/middleware`, `src/config`, `src/core`, and `src/utils`.

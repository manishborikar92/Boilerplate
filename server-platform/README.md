# server-platform

`server-platform` is now a lightweight multi-app backend platform. It uses a workspace layout with shared core infrastructure, explicitly registered apps, and a gateway host that mounts each app under a stable route prefix.

## Requirements

- Node.js 22+
- npm 10+

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the gateway:

   ```bash
   npm run dev
   ```

4. Verify the platform:

   ```bash
   curl "http://localhost:4000/health"
   curl "http://localhost:4000/api/main/health"
   curl "http://localhost:4000/api/admin/health"
   ```

## Workspace Layout

```text
server-platform/
  apps/
  hosts/
  packages/
  scripts/
  tests/
  workspace.config.js
```

## Available Scripts

- `npm run dev` - start the gateway with hot reload
- `npm start` - start the gateway in normal mode
- `npm test` - run integration tests
- `npm run lint` - run ESLint
- `npm run app:new -- <name> <mountPath>` - scaffold a new app and register it
- `npm run module:new -- <app> <name> <basePath>` - scaffold a new module in an app

## Registered Apps

- `main-api` at `/api/main`
- `admin-api` at `/api/admin`

## Core Principles

- Shared infrastructure lives in `packages/core`
- Apps are registered explicitly in `workspace.config.js`
- Modules are feature-based and local to each app
- No decorators, no DI container, no auto-discovery

## Request Flow

`client -> gateway middleware -> mounted app -> module router -> controller -> service -> shared response/error layer`

## Adding A New App

```bash
npm run app:new -- reports-api /api/reports
```

This scaffolds the app under `apps/reports-api` and updates `workspace.config.js`.

## Adding A New Module

```bash
npm run module:new -- main-api users /users
```

This scaffolds a module under `apps/main-api/src/modules/users` and updates that app's module registry.

# Multi-App Platform Design

## Goal

Evolve `server-platform` from a single Express starter into a lightweight backend platform that supports multiple explicitly registered apps within one codebase, while sharing a small reusable core.

## Scope

- Convert `server-platform` into a workspace-style monorepo layout
- Extract common infrastructure into `packages/core`
- Move the current API into `apps/main-api`
- Add a second app, `apps/admin-api`, to prove the architecture
- Add a host gateway that mounts registered apps
- Keep the system explicit and simple

## Non-Goals

- No decorators
- No dependency injection container
- No reflection or file auto-discovery
- No code generation framework runtime
- No ORM, auth vendor, or database abstraction in core

## Architecture

### Core

`packages/core` owns:

- environment loading and validation
- structured logging
- shared middlewares
- error and response primitives
- app/module definition helpers
- workspace app loading
- host app assembly
- shared health module factory

### Apps

Each app lives in `apps/<name>` and exports one explicit app definition. Apps are mounted by the host under configured mount paths and contain feature-based modules.

### Host

`hosts/gateway` is the process entrypoint. It loads `workspace.config.js`, imports the listed apps, applies shared infrastructure once, mounts apps, and exposes a host health endpoint.

## Registration Model

Apps are registered only through `workspace.config.js`. No scanning and no magic loading.

## Request Flow

`client -> gateway middleware -> mounted app router -> module router -> controller -> service -> shared response/error layer`

## Developer Experience

- `npm run dev` runs the gateway with all registered apps
- `npm run app:new -- <name> <mountPath>` scaffolds a new app
- `npm run module:new -- <app> <module> <basePath>` scaffolds a module inside an app

## Validation

The implementation is complete when:

- the gateway boots successfully
- both registered apps mount correctly
- host and app health routes respond
- a non-health admin module responds
- tests cover registration and routing behavior

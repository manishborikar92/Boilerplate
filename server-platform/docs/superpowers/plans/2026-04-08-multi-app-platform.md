# Multi-App Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `server-platform` into a lightweight multi-app backend platform with shared core, explicit app registration, a host gateway, and at least two mounted apps.

**Architecture:** A root workspace hosts a shared core package, multiple feature-based apps, and a gateway process that mounts explicitly registered apps from `workspace.config.js`. Shared middleware and infrastructure live in core; app business logic stays isolated inside app modules.

**Tech Stack:** Node.js 22+, Express 5, Joi, built-in `node:test`

---

### Task 1: Define the target structure and red tests

**Files:**
- Create: `server-platform/tests/gateway.multi-app.test.js`
- Create: `server-platform/docs/superpowers/specs/2026-04-08-multi-app-platform-design.md`
- Create: `server-platform/docs/superpowers/plans/2026-04-08-multi-app-platform.md`

- [ ] **Step 1: Write the failing integration tests**

```js
test('loads registered apps from workspace config', async () => {
  const gateway = await startGateway();
  assert.deepEqual(gateway.apps.map((app) => app.name), ['main-api', 'admin-api']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server-platform/tests/gateway.multi-app.test.js`
Expected: FAIL because `hosts/gateway/src/create-gateway.js` does not exist yet

### Task 2: Extract shared core and workspace layout

**Files:**
- Modify: `server-platform/package.json`
- Modify: `server-platform/README.md`
- Modify: `server-platform/.env.example`
- Create: `server-platform/workspace.config.js`
- Create: `server-platform/packages/core/...`

- [ ] **Step 1: Create the workspace root and shared core**

```js
export const loadEnv = (source = process.env) => { /* validate env */ };
export const createHostApp = async ({ env, logger, workspaceConfig, rootDir }) => { /* mount apps */ };
```

- [ ] **Step 2: Re-run tests**

Run: `node --test server-platform/tests/gateway.multi-app.test.js`
Expected: still FAIL until app workspaces and gateway are complete

### Task 3: Move the starter into app workspaces

**Files:**
- Create: `server-platform/apps/main-api/...`
- Create: `server-platform/apps/admin-api/...`
- Create: `server-platform/hosts/gateway/...`

- [ ] **Step 1: Build `main-api` and `admin-api` with feature modules**

```js
export default defineApp({
  name: 'main-api',
  modules: [healthModule, infoModule],
});
```

- [ ] **Step 2: Mount the apps through the gateway**

```js
app.use('/api/main', mainApiRouter);
app.use('/api/admin', adminApiRouter);
```

- [ ] **Step 3: Re-run tests**

Run: `node --test server-platform/tests/gateway.multi-app.test.js`
Expected: PASS

### Task 4: Add developer scaffolding and cleanup

**Files:**
- Create: `server-platform/scripts/create-app.mjs`
- Create: `server-platform/scripts/create-module.mjs`

- [ ] **Step 1: Add simple scaffolding scripts**

```js
node scripts/create-app.mjs reports-api /api/reports
node scripts/create-module.mjs main-api users /users
```

- [ ] **Step 2: Run the tests again**

Run: `node --test server-platform/tests/gateway.multi-app.test.js`
Expected: PASS

### Task 5: Final validation

**Files:**
- Review all files under `server-platform`

- [ ] **Step 1: Verify runtime boot**

Run: `node hosts/gateway/src/server.js`
Expected: gateway boots and logs mounted apps

- [ ] **Step 2: Verify health endpoints**

Run: `curl http://localhost:4000/health`
Expected: host health response with registered apps

Run: `curl http://localhost:4000/api/main/health`
Expected: main-api health response

Run: `curl http://localhost:4000/api/admin/health`
Expected: admin-api health response

- [ ] **Step 3: Confirm the design stays simple**

Check: no decorators, no DI container, no reflection-based discovery, no hidden registration

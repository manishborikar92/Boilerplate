# server-2

`server-2` is a clean Express starter for production APIs. It keeps the request path simple (`route -> controller -> service`) and ships with validated environment config, structured JSON logging, centralized error handling, request validation, and health endpoints out of the box.

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

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Verify the app:

   ```bash
   curl "http://localhost:4000/api/v1/health?details=true"
   ```

## Available Scripts

- `npm run dev` - start the server with hot reload
- `npm start` - start the server in normal mode
- `npm run lint` - run ESLint

## Environment Variables

- `NODE_ENV` - `development`, `test`, or `production`
- `PORT` - HTTP port
- `API_PREFIX` - API namespace prefix
- `APP_NAME` - service name shown in logs and health responses
- `APP_VERSION` - service version shown in health responses
- `LOG_LEVEL` - `debug`, `info`, `warn`, `error`, or `fatal`
- `CORS_ORIGINS` - comma-separated allowlist; leave empty to allow all origins
- `JSON_BODY_LIMIT` - maximum JSON payload size for incoming requests
- `TRUST_PROXY` - Express `trust proxy` value
- `HEALTH_DETAILS_ENABLED` - allow runtime details in health responses

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

`GET /api/v1/health` and `GET /api/v1/health/ready` support `?details=true`.

## Project Structure

```text
server-2/
  src/
    config/
    controllers/
    middlewares/
    routes/
    services/
    utils/
    validators/
```

## Extending The Starter

1. Add a validator in `src/validators`
2. Add a service in `src/services`
3. Add a controller in `src/controllers`
4. Register a route in `src/routes`
5. Mount the route from `src/routes/index.js`

This starter intentionally does not choose a database, ORM, auth provider, queue, or storage vendor. Add those only when your project needs them.

import express from 'express';
import cors from 'cors';

import { buildConfig } from './config/env.js';
import { createCorsOptions } from './config/cors.js';
import { createHelmet } from './config/security.js';
import { createRateLimiter } from './middleware/rate-limit.middleware.js';
import { requestId } from './middleware/request-id.middleware.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { notFound } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { createRouter } from './routes/index.js';
import { ApiResponse } from './utils/api-response.js';

const defaultStartedAt = new Date();

const createApp = ({
  configOverrides = {},
  configureRoutes,
  startedAt = defaultStartedAt,
} = {}) => {
  const config = buildConfig(configOverrides);
  const app = express();

  app.set('config', config);
  app.set('startedAt', startedAt);
  app.set('trust proxy', config.app.trustProxy);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(createHelmet(config));
  app.use(cors(createCorsOptions(config)));
  app.use(requestLogger);
  app.use(express.json({
    limit: config.security.jsonBodyLimit,
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  }));
  app.use(express.urlencoded({
    extended: true,
    limit: config.security.urlencodedBodyLimit,
  }));

  app.get('/', (_req, res) => {
    res.json(ApiResponse.success({
      name: config.app.name,
      environment: config.env,
      apiPrefix: config.app.apiPrefix,
      health: `${config.app.apiPrefix}/health`,
    }));
  });

  app.use(config.app.apiPrefix, createRateLimiter(config), createRouter({
    config,
    startedAt,
    configureRoutes,
  }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;

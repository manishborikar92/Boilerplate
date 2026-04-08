import cors from 'cors';
import express from 'express';
import env from './config/env.js';
import errorHandler from './middlewares/error-handler.middleware.js';
import notFoundHandler from './middlewares/not-found.middleware.js';
import requestContext from './middlewares/request-context.middleware.js';
import requestLogger from './middlewares/request-logger.middleware.js';
import securityHeaders from './middlewares/security-headers.middleware.js';
import routes from './routes/index.js';
import { BadRequestError } from './utils/app-error.js';

const buildCorsOptions = () => ({
  origin(origin, callback) {
    const allowAllOrigins = env.corsOrigins.length === 0;

    if (!origin || allowAllOrigins || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new BadRequestError('Origin not allowed by CORS', { origin }));
  },
  credentials: true,
});

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(requestContext);
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));

  app.use(env.apiPrefix, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;

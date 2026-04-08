import cors from 'cors';
import express from 'express';
import Joi from 'joi';
import { BadRequestError } from '../errors/app-error.js';
import { sendSuccess } from '../http/api-response.js';
import { buildHealthPayload } from '../health/build-health-payload.js';
import createErrorHandler from '../middlewares/create-error-handler.js';
import createNotFoundHandler from '../middlewares/create-not-found-handler.js';
import createRequestContext from '../middlewares/create-request-context.js';
import createRequestLogger from '../middlewares/create-request-logger.js';
import createSecurityHeaders from '../middlewares/create-security-headers.js';
import validate from '../middlewares/validate.js';
import { createAppRouter } from './create-app-router.js';
import { loadRegisteredApps } from './load-registered-apps.js';

const healthQuerySchema = Joi.object({
  details: Joi.boolean().default(false),
});

const buildCorsOptions = (env) => ({
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

export const createHostApp = async ({
  env,
  logger,
  workspaceConfig,
  rootDir,
} = {}) => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(createRequestContext());
  app.use(createRequestLogger(logger));
  app.use(createSecurityHeaders({ isProduction: env.isProduction }));
  app.use(cors(buildCorsOptions(env)));
  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));

  const registrations = await loadRegisteredApps({
    rootDir,
    workspaceConfig,
  });

  const apps = registrations.map((registration) => {
    const mountedApp = createAppRouter({
      env,
      logger,
      registration,
    });

    app.use(registration.mountPath, mountedApp.router);

    return {
      ...mountedApp.metadata,
      entry: registration.entry,
    };
  });

  app.get('/', (_req, res) =>
    sendSuccess(res, {
      message: 'Gateway is running',
      data: {
        host: {
          name: env.hostName,
          version: env.hostVersion,
        },
        apps,
      },
    }));

  app.get('/health', validate(healthQuerySchema, 'query'), (req, res) => {
    const detailed = env.healthDetailsEnabled && Boolean(req.validated.query.details);

    return sendSuccess(res, {
      message: 'Gateway health retrieved successfully',
      data: {
        host: buildHealthPayload({
          name: env.hostName,
          version: env.hostVersion,
          environment: env.nodeEnv,
          detailed,
          checks: [
            { name: 'workspace-config', status: 'ok' },
            { name: 'registered-apps', status: 'ok' },
          ],
        }),
        apps: apps.map((registeredApp) => ({
          name: registeredApp.name,
          version: registeredApp.version,
          mountPath: registeredApp.mountPath,
          moduleCount: registeredApp.modules.length,
          modules: registeredApp.modules,
        })),
      },
      meta: { requestId: req.id },
    });
  });

  app.use(createNotFoundHandler());
  app.use(
    createErrorHandler({
      logger,
      isDevelopment: env.isDevelopment,
    }),
  );

  return {
    app,
    apps,
  };
};

import express from 'express';
import Joi from 'joi';
import { sendSuccess } from '../http/api-response.js';
import validate from '../middlewares/validate.js';
import { defineModule } from '../platform/define-module.js';
import { asyncHandler } from '../utils/async-handler.js';
import { buildHealthPayload } from '../health/build-health-payload.js';

const healthQuerySchema = Joi.object({
  details: Joi.boolean().default(false),
});

export const createHealthModule = () =>
  defineModule({
    name: 'health',
    basePath: '/health',
    createRouter: ({ env, app }) => {
      const router = express.Router();

      router.get(
        '/',
        validate(healthQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
          const detailed = env.healthDetailsEnabled && Boolean(req.validated.query.details);

          return sendSuccess(res, {
            message: 'App health retrieved successfully',
            data: buildHealthPayload({
              name: app.name,
              version: app.version,
              environment: env.nodeEnv,
              detailed,
            }),
            meta: { requestId: req.id },
          });
        }),
      );

      router.get('/live', asyncHandler(async (req, res) =>
        sendSuccess(res, {
          message: 'App is alive',
          data: {
            status: 'alive',
            name: app.name,
            timestamp: new Date().toISOString(),
          },
          meta: { requestId: req.id },
        })));

      router.get(
        '/ready',
        validate(healthQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
          const detailed = env.healthDetailsEnabled && Boolean(req.validated.query.details);

          return sendSuccess(res, {
            message: 'App is ready',
            data: buildHealthPayload({
              name: app.name,
              version: app.version,
              environment: env.nodeEnv,
              detailed,
              status: 'ready',
              checks: [
                { name: 'app-router', status: 'ok' },
                { name: 'module-registry', status: 'ok' },
              ],
            }),
            meta: { requestId: req.id },
          });
        }),
      );

      return router;
    },
  });

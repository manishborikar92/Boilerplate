import { Router } from 'express';

import { createHealthRouter } from '../modules/health/health.routes.js';

export const createRouter = ({ config, startedAt, configureRoutes } = {}) => {
  const router = Router();

  router.use(createHealthRouter({ config, startedAt }));

  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  return router;
};

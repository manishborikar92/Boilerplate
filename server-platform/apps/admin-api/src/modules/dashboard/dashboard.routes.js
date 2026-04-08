import express from 'express';
import { createDashboardController } from './dashboard.controller.js';

export const createDashboardRoutes = (context) => {
  const router = express.Router();
  const controller = createDashboardController(context);

  router.get('/summary', controller.getSummary);

  return router;
};

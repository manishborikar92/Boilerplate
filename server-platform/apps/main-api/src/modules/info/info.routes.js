import express from 'express';
import { createInfoController } from './info.controller.js';

export const createInfoRoutes = (context) => {
  const router = express.Router();
  const controller = createInfoController(context);

  router.get('/', controller.getInfo);

  return router;
};

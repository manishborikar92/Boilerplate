import { Router } from 'express';
import * as healthController from '../controllers/health.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { healthQuerySchema } from '../validators/health.validator.js';

const router = Router();

router.get('/', validate(healthQuerySchema, 'query'), healthController.getHealth);
router.get('/live', healthController.getLiveness);
router.get('/ready', validate(healthQuerySchema, 'query'), healthController.getReadiness);

export default router;

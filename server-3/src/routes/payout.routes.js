import { Router } from 'express';

import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as payoutController from '../controllers/payout.controller.js';
import { payoutIdParamSchema } from '../validators/payout.validator.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Webhook route - public but protected by signature verification in service layer
router.post('/webhook', payoutController.handlePayoutWebhook);

// All other payout routes require authentication
router.use(authenticate);

router.post(
    '/:payoutId/retry',
    authorize(ROLES.ADMIN),
    validate(payoutIdParamSchema, 'params'),
    payoutController.retryPayout,
);

export default router;

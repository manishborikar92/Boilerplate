import { Router } from 'express';

import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as paymentController from '../controllers/payment.controller.js';
import {
    initiatePaymentSchema,
    paymentIdParamSchema,
    paymentListQuerySchema,
    verifyPaymentSchema,
} from '../validators/payment.validator.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Webhook route - public but protected by signature verification in service layer
router.post('/webhook', paymentController.handleWebhook);

// All other payment routes require authentication
router.use(authenticate);

router.get(
    '/',
    authorize(ROLES.CUSTOMER, ROLES.BARBER, ROLES.ADMIN),
    validate(paymentListQuerySchema, 'query'),
    paymentController.getPayments,
);

router.post(
    '/',
    authorize(ROLES.CUSTOMER),
    validate(initiatePaymentSchema, 'body'),
    paymentController.initiatePayment,
);

router.post(
    '/:id/verify',
    authorize(ROLES.CUSTOMER),
    validate(paymentIdParamSchema, 'params'),
    validate(verifyPaymentSchema, 'body'),
    paymentController.verifyPayment,
);

router.get(
    '/:id',
    authorize(ROLES.CUSTOMER, ROLES.BARBER, ROLES.ADMIN),
    validate(paymentIdParamSchema, 'params'),
    paymentController.getPaymentStatus,
);

export default router;

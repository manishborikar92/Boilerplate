import { Router } from 'express';

import * as earningsController from '../controllers/earnings.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import {
    transactionListQuerySchema,
    transactionDetailParamsSchema,
    statementQuerySchema,
} from '../validators/earnings.validator.js';

const router = Router();

// All earnings routes require authentication and BARBER role
router.use(authenticate, authorize(ROLES.BARBER));

router.get('/', earningsController.getEarnings);
router.get('/transactions', validate(transactionListQuerySchema, 'query'), earningsController.getTransactions);
router.get('/transactions/statement', validate(statementQuerySchema, 'query'), earningsController.downloadStatement);
router.get('/transactions/:id', validate(transactionDetailParamsSchema, 'params'), earningsController.getTransactionDetail);

export default router;

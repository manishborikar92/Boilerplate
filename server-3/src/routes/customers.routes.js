import { Router } from 'express';

import * as customerController from '../controllers/customer.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { uploadCustomerPhoto } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import { updateCustomerSchema } from '../validators/customer.validator.js';

const router = Router();

// All customer routes require authentication and CUSTOMER role
router.use(authenticate, authorize(ROLES.CUSTOMER));

router.get('/me', customerController.getMe);
router.patch('/me', uploadCustomerPhoto, validate(updateCustomerSchema, 'body'), customerController.updateMe);

export default router;

import { Router } from 'express';

import * as notificationController from '../controllers/notification.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
    notificationIdParamSchema,
    notificationListQuerySchema,
    notificationPatchSchema,
    registerFcmTokenSchema,
    unregisterFcmTokenSchema,
} from '../validators/notification.validator.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.post('/tokens', validate(registerFcmTokenSchema, 'body'), notificationController.registerFcmToken);
router.delete('/tokens', validate(unregisterFcmTokenSchema, 'body'), notificationController.unregisterFcmToken);
router.get('/', validate(notificationListQuerySchema, 'query'), notificationController.listNotifications);
router.get('/summary', notificationController.getNotificationSummary);
router.patch('/', validate(notificationPatchSchema, 'body'), notificationController.patchNotifications);
router.patch('/:id', validate(notificationIdParamSchema, 'params'), validate(notificationPatchSchema, 'body'), notificationController.patchNotification);

export default router;

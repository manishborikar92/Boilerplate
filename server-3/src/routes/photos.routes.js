import { Router } from 'express';

import * as photoController from '../controllers/photo.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { uploadShopPhotos } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import { objectIdParamSchema } from '../validators/common.validator.js';
import { photoFilterQuerySchema, photoUploadSchema } from '../validators/photo.validator.js';

const router = Router();

// All photo routes require authentication and BARBER role
router.use(authenticate, authorize(ROLES.BARBER));

router.get('/', validate(photoFilterQuerySchema, 'query'), photoController.getPhotos);
router.post('/', uploadShopPhotos, validate(photoUploadSchema, 'body'), photoController.uploadPhotos);
router.get('/analytics', photoController.getPhotoStats);
router.get('/:id', validate(objectIdParamSchema, 'params'), photoController.getPhotoById);
router.delete('/:id', validate(objectIdParamSchema, 'params'), photoController.deletePhoto);

export default router;

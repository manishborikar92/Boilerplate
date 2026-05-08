import { Router } from 'express';

import * as ratingController from '../controllers/rating.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import { objectIdParamSchema, paginationSchema } from '../validators/common.validator.js';
import { addRatingSchema, addReplySchema } from '../validators/rating.validator.js';

const router = Router();

// All rating routes require authentication
router.use(authenticate);

router.get('/analytics', authorize(ROLES.BARBER), ratingController.getOwnedRatingSummary);
router.get('/', authorize(ROLES.BARBER), validate(paginationSchema, 'query'), ratingController.getOwnedRatings);
router.post('/', authorize(ROLES.CUSTOMER), validate(addRatingSchema, 'body'), ratingController.addRating);
router.put('/:id/reply', authorize(ROLES.BARBER), validate(objectIdParamSchema, 'params'), validate(addReplySchema, 'body'), ratingController.updateReply);
router.delete('/:id/reply', authorize(ROLES.BARBER), validate(objectIdParamSchema, 'params'), ratingController.deleteReply);
router.delete('/:id', authorize(ROLES.BARBER), validate(objectIdParamSchema, 'params'), ratingController.deleteRating);

export default router;

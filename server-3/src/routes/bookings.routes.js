import { Router } from 'express';

import * as bookingController from '../controllers/booking.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import {
    bookingPatchSchema,
    bookingListQuerySchema,
    createBookingSchema,
    bookingIdParamSchema,
    bookingAnalyticsQuerySchema,
    favoritePatchSchema,
} from '../validators/booking.validator.js';
import { refundSchema } from '../validators/payment.validator.js';

const router = Router();

// ============================================================================
// All booking routes require authentication
// ============================================================================

router.use(authenticate);

// ============================================================================
// Collection Routes (no :id parameter)
// ============================================================================

router.post('/', authorize(ROLES.CUSTOMER), validate(createBookingSchema, 'body'), bookingController.createBooking);
router.get('/', authorize(ROLES.CUSTOMER, ROLES.BARBER), validate(bookingListQuerySchema, 'query'), bookingController.getBookings);
router.get('/analytics', authorize(ROLES.BARBER), validate(bookingAnalyticsQuerySchema, 'query'), bookingController.getBookingAnalytics);

// ============================================================================
// Resource Routes (with :id parameter)
// ============================================================================

router.get('/:id', authorize(ROLES.CUSTOMER, ROLES.BARBER), validate(bookingIdParamSchema, 'params'), bookingController.getBookingById);
router.patch('/:id', authorize(ROLES.CUSTOMER, ROLES.BARBER), validate(bookingIdParamSchema, 'params'), validate(bookingPatchSchema, 'body'), bookingController.patchBooking);
router.patch('/:id/favorite', authorize(ROLES.CUSTOMER), validate(bookingIdParamSchema, 'params'), validate(favoritePatchSchema, 'body'), bookingController.setFavoriteBooking);
router.post('/:id/refunds', authorize(ROLES.ADMIN, ROLES.BARBER), validate(bookingIdParamSchema, 'params'), validate(refundSchema, 'body'), paymentController.initiateRefund);

export default router;

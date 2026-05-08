import { Router } from 'express';
import { authenticateOnboarding } from '../middleware/authenticate.middleware.js';
import {
    uploadBarberOnboardingImage,
    uploadCustomerPhoto,
} from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
    customerOnboardingSchema,
    barberOnboardingSchema,
} from '../validators/onboarding.validator.js';
import * as onboardingController from '../controllers/onboarding.controller.js';

const router = Router();

// ============================================================================
// Onboarding Routes (require onboarding token from OTP verification)
// ============================================================================

/**
 * POST /api/v1/onboarding/customers
 * Create customer after OTP verification with onboarding token.
 */
router.post(
    '/customers',
    authenticateOnboarding,
    uploadCustomerPhoto,
    validate(customerOnboardingSchema, 'body'),
    onboardingController.createCustomerOnboarding,
);

/**
 * POST /api/v1/onboarding/barbers
 * Create barber/shop profile after OTP verification with onboarding token.
 */
router.post(
    '/barbers',
    authenticateOnboarding,
    uploadBarberOnboardingImage,
    validate(barberOnboardingSchema, 'body'),
    onboardingController.createBarberOnboarding,
);

export default router;

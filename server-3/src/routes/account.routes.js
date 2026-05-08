import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { otpRateLimiter } from '../middleware/otp-rate-limiter.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as accountController from '../controllers/account.controller.js';
import { OTP_RATE_LIMIT, ROLES } from '../utils/constants.js';
import { deleteBarberAccountSchema } from '../validators/account.validator.js';
import {
    sendPhoneOtpSchema,
    verifyPhoneOtpSchema,
} from '../validators/phone.validator.js';
import { updateEmailSchema } from '../validators/email.validator.js';

const router = Router();

// All account routes require authentication
router.use(authenticate);

// Phone number update endpoints with OTP verification
router.post(
    '/phone/send-otp',
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxSendPerPhone,
        keyPrefix: 'phone-update-send',
        keySource: 'body.newMobile',
    }),
    validate(sendPhoneOtpSchema, 'body'),
    accountController.sendPhoneUpdateOtp,
);

router.post(
    '/phone/verify-otp',
    otpRateLimiter({
        windowMs: OTP_RATE_LIMIT.windowMs,
        max: OTP_RATE_LIMIT.maxVerifyPerPhone,
        keyPrefix: 'phone-update-verify',
        keySource: 'body.newMobile',
    }),
    validate(verifyPhoneOtpSchema, 'body'),
    accountController.verifyPhoneUpdateOtp,
);

// Email update endpoint
router.patch(
    '/email',
    validate(updateEmailSchema, 'body'),
    accountController.updateEmail,
);

router.delete(
    '/sessions',
    accountController.signOutEverywhere,
);

router.delete(
    '/',
    authorize(ROLES.BARBER),
    validate(deleteBarberAccountSchema, 'body'),
    accountController.deleteAccount,
);

export default router;

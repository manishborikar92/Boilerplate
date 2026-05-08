import * as smsProvider from './sms-provider.service.js';
import { BadRequestError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * OTP Service — orchestrates OTP operations via the SMS provider.
 *
 * Rate limiting is handled by the `otp-rate-limiter.middleware.js` at the route
 * level. This service focuses purely on business logic.
 */

/** Request OTP for a mobile number. */
export const requestOtp = async (mobile) => {
    const result = await smsProvider.sendOtp(mobile);
    if (!result.success) {
        throw new BadRequestError('Failed to send OTP. Please try again.');
    }
    return { message: 'OTP sent successfully' };
};

/** Verify OTP for a mobile number. */
export const verifyOtp = async (mobile, otp) => {
    const result = await smsProvider.verifyOtp(mobile, otp);
    if (!result.success) {
        throw new BadRequestError(result.message || 'Invalid or expired OTP');
    }
    return { verified: true };
};

/** Resend OTP via alternative channel. */
export const resendOtp = async (mobile, retryType) => {
    const result = await smsProvider.resendOtp(mobile, retryType);
    if (!result.success) {
        throw new BadRequestError('Failed to resend OTP. Please try again.');
    }
    return { message: `OTP resent via ${retryType}` };
};

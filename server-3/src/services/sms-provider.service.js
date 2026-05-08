import msg91 from '../config/msg91.config.js';
import logger, { maskPhoneNumber } from '../utils/logger.js';
import { AppError } from '../utils/api-error.js';

/**
 * SMS Provider Service - abstracts MSG91 OTP API.
 *
 * All MSG91 API communication is isolated here. To switch providers
 * (Twilio, 2Factor, etc.), only this file needs to change.
 */

/**
 * Send OTP to a mobile number via MSG91.
 * @param {string} mobile - 10-digit Indian mobile number (without country code)
 * @returns {Promise<{ success: boolean, requestId: string|null }>}
 */
export const sendOtp = async (mobile) => {
    if (msg91.testMode) {
        if (process.env.NODE_ENV === 'production') {
            logger.error('CRITICAL: MSG91 test mode is enabled in production!');
            throw new AppError('Configuration error', 500);
        }

        logger.info('MSG91 test mode - OTP send bypassed', {
            mobile: maskPhoneNumber(mobile),
            testOtp: msg91.testOtp,
        });
        return { success: true, requestId: 'test-mode' };
    }

    try {
        const response = await fetch(msg91.endpoints.sendOtp, {
            method: 'POST',
            headers: msg91.headers,
            body: JSON.stringify({
                template_id: msg91.otpTemplateId,
                mobile: `91${mobile}`,
                otp_length: msg91.otpLength,
                otp_expiry: msg91.otpExpiry,
            }),
        });

        const data = await response.json();

        if (data.type === 'success') {
            logger.info('OTP sent successfully', {
                mobile: maskPhoneNumber(mobile),
                requestId: data.request_id,
            });
            return { success: true, requestId: data.request_id };
        }

        logger.warn('MSG91 OTP send failed', {
            mobile: maskPhoneNumber(mobile),
            response: data,
        });
        return { success: false, requestId: null };
    } catch (err) {
        logger.error('MSG91 API error (sendOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};

/**
 * Verify OTP for a mobile number via MSG91.
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {string} otp    - user-entered OTP
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const verifyOtp = async (mobile, otp) => {
    if (msg91.testMode) {
        const isValid = otp === msg91.testOtp;
        logger.info('MSG91 test mode - OTP verify bypassed', {
            mobile: maskPhoneNumber(mobile),
            valid: isValid,
        });
        return {
            success: isValid,
            message: isValid ? 'OTP verified (test mode)' : 'Invalid OTP (test mode)',
        };
    }

    try {
        const url = `${msg91.endpoints.verifyOtp}?mobile=91${mobile}&otp=${otp}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { authkey: msg91.authKey },
        });

        const data = await response.json();
        return {
            success: data.type === 'success',
            message: data.message || (data.type === 'success' ? 'OTP verified' : 'Invalid or expired OTP'),
        };
    } catch (err) {
        logger.error('MSG91 API error (verifyOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};

/**
 * Resend OTP via a different channel.
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {'text'|'voice'} retryType - channel to retry on
 * @returns {Promise<{ success: boolean }>}
 */
export const resendOtp = async (mobile, retryType = 'text') => {
    if (msg91.testMode) {
        logger.info('MSG91 test mode - OTP resend bypassed', {
            mobile: maskPhoneNumber(mobile),
        });
        return { success: true };
    }

    try {
        const response = await fetch(msg91.endpoints.resendOtp, {
            method: 'POST',
            headers: msg91.headers,
            body: JSON.stringify({
                mobile: `91${mobile}`,
                retrytype: retryType,
            }),
        });

        const data = await response.json();
        return { success: data.type === 'success' };
    } catch (err) {
        logger.error('MSG91 API error (resendOtp)', { error: err.message });
        throw new AppError('SMS service unavailable. Please try again later.', 503);
    }
};

import * as phoneUpdateService from '../services/phone-update.service.js';
import * as emailUpdateService from '../services/email-update.service.js';
import * as accountService from '../services/account.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

/**
 * POST /account/phone/send-otp
 * Send OTP to new phone number for verification
 */
export const sendPhoneUpdateOtp = async (req, res) => {
    const { newMobile } = getValidatedRequestData(req, 'body');
    const result = await phoneUpdateService.sendPhoneUpdateOtp(req.user._id, newMobile);

    return res.status(200).json(
        ApiResponse.success(result, result.message),
    );
};

/**
 * POST /account/phone/verify-otp
 * Verify OTP and update phone number
 */
export const verifyPhoneUpdateOtp = async (req, res) => {
    const { newMobile, otp } = getValidatedRequestData(req, 'body');
    const result = await phoneUpdateService.verifyAndUpdatePhone(req.user._id, newMobile, otp);

    return res.status(200).json(
        ApiResponse.success(
            { phoneNumber: result.phoneNumber },
            result.message,
        ),
    );
};

/**
 * PATCH /account/email
 * Update user email
 */
export const updateEmail = async (req, res) => {
    const { newEmail } = getValidatedRequestData(req, 'body');
    const result = await emailUpdateService.updateEmail(req.user._id, newEmail);

    return res.status(200).json(
        ApiResponse.success(
            {
                email: result.email,
                emailVerified: result.emailVerified,
            },
            result.message,
        ),
    );
};

export const signOutEverywhere = async (req, res, next) => {
    try {
        const result = await accountService.signOutEverywhere(req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Signed out from all devices'));
    } catch (err) {
        next(err);
    }
};

export const deleteAccount = async (req, res, next) => {
    try {
        const { currentPin } = getValidatedRequestData(req, 'body');
        const result = await accountService.deleteBarberAccount(req.user, currentPin);
        return res.status(200).json(ApiResponse.success(result, 'Account deleted successfully'));
    } catch (err) {
        next(err);
    }
};

import * as authService from '../services/auth.service.js';
import * as otpService from '../services/otp.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

const buildSessionPayload = (session) => {
    if (session.isNewUser) {
        return {
            message: 'OTP verified. Please complete your profile.',
            data: {
                isNewUser: true,
                onboardingToken: session.onboardingToken,
            },
        };
    }

    return {
        message: 'Login successful',
        data: {
            isNewUser: false,
            user: session.user,
            profile: session.profile,
            accessToken: session.tokens.accessToken,
            refreshToken: session.tokens.refreshToken,
        },
    };
};

/** POST /auth/otp/send */
export const sendOtp = async (req, res) => {
    const { mobile } = getValidatedRequestData(req, 'body');
    const result = await otpService.requestOtp(mobile);

    return res.status(200).json(
        ApiResponse.success(result, 'OTP sent successfully'),
    );
};

/** POST /auth/otp/verify */
export const verifyOtp = async (req, res) => {
    const { mobile, otp } = getValidatedRequestData(req, 'body');

    await otpService.verifyOtp(mobile, otp);
    const session = await authService.resolveOtpSession(mobile);
    const response = buildSessionPayload(session);

    return res.status(200).json(
        ApiResponse.success(response.data, response.message),
    );
};

/** POST /auth/otp/resend */
export const resendOtp = async (req, res) => {
    const { mobile, retryType } = getValidatedRequestData(req, 'body');
    const result = await otpService.resendOtp(mobile, retryType);

    return res.status(200).json(
        ApiResponse.success(result, result.message),
    );
};

/** POST /auth/token/refresh */
export const refreshToken = async (req, res) => {
    const { refreshToken: token } = getValidatedRequestData(req, 'body');
    const tokens = await authService.refreshAccessToken(token);

    return res.status(200).json(
        ApiResponse.success(tokens, 'Token refreshed successfully'),
    );
};

/** POST /auth/logout */
export const logout = async (req, res) => {
    await authService.revokeRefreshToken(req.user._id);

    return res.status(200).json(
        ApiResponse.success(null, 'Logged out successfully'),
    );
};

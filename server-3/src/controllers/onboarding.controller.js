import * as onboardingService from '../services/onboarding.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

/**
 * Onboarding controller - handles first-time profile creation for both roles.
 */
export const createCustomerOnboarding = async (req, res) => {
    const { phoneNumber } = req.onboardingContext;
    const body = getValidatedRequestData(req, 'body');
    const result = await onboardingService.createCustomerOnboarding(phoneNumber, body, req.file);
    const { user, profile, tokens } = result;

    return res.status(201).json(
        ApiResponse.success(
            {
                user,
                profile,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            'Customer created',
        ),
    );
};

export const createBarberOnboarding = async (req, res) => {
    const { phoneNumber } = req.onboardingContext;
    const body = getValidatedRequestData(req, 'body');
    const result = await onboardingService.createBarberOnboarding(phoneNumber, body, req.file);
    const { user, shop, tokens } = result;

    return res.status(201).json(
        ApiResponse.success(
            {
                user,
                shop,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            'Barber profile created',
        ),
    );
};

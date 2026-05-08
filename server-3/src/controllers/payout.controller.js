import * as payoutService from '../services/payout.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';
import logger from '../utils/logger.js';

export const handlePayoutWebhook = async (req, res) => {
    try {
        const rawBody = req.rawBody || JSON.stringify(req.body || {});
        const result = await payoutService.handlePayoutWebhook(req.headers, rawBody, req.body);

        logger.info('[PayoutController] Webhook processed', {
            event: result.event,
            processed: result.processed,
        });

        return res.status(200).json(ApiResponse.success(
            { received: true, ...result },
            'Payout webhook processed',
        ));
    } catch (error) {
        logger.error('[PayoutController] Webhook processing error', {
            error: error.message,
        });

        return res.status(error.statusCode || 500).json(ApiResponse.error(
            error.message || 'processing_error',
            { received: false },
        ));
    }
};

export const retryPayout = async (req, res, next) => {
    try {
        const { payoutId } = getValidatedRequestData(req, 'params');
        const result = await payoutService.retryPayout(payoutId);
        return res.status(200).json(ApiResponse.success(result, 'Payout retry initiated'));
    } catch (error) {
        next(error);
    }
};

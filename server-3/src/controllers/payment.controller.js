import * as paymentService from '../services/payment.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';
import logger from '../utils/logger.js';

export const handleWebhook = async (req, res) => {
    try {
        const result = await paymentService.handleWebhook(req.headers, req.body);

        logger.info('[PaymentController] Webhook processed', {
            event: result.event,
            processed: result.processed,
        });

        return res.status(200).json(ApiResponse.success(
            { received: true, ...result },
            'Payment webhook processed',
        ));
    } catch (error) {
        logger.error('[PaymentController] Webhook processing error', {
            error: error.message,
        });

        return res.status(error.statusCode || 500).json(ApiResponse.error(
            error.message || 'processing_error',
            { received: false },
        ));
    }
};

export const initiatePayment = async (req, res, next) => {
    try {
        const { bookingId } = getValidatedRequestData(req, 'body');
        const result = await paymentService.initiatePayment(req.user._id, bookingId);
        return res.status(200).json(ApiResponse.success(result, 'Payment initiated'));
    } catch (error) {
        next(error);
    }
};

export const getPayments = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await paymentService.getPayments(req.user, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Payments fetched'));
    } catch (error) {
        next(error);
    }
};

export const getPaymentStatus = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const result = await paymentService.getPaymentStatus(req.user, id);
        return res.status(200).json(ApiResponse.success(result, 'Payment status'));
    } catch (error) {
        next(error);
    }
};

export const verifyPayment = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const verificationContext = getValidatedRequestData(req, 'body');
        const result = await paymentService.verifyPayment(req.user._id, id, verificationContext);
        return res.status(200).json(ApiResponse.success(result, 'Payment verified'));
    } catch (error) {
        next(error);
    }
};

export const initiateRefund = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const { reason } = getValidatedRequestData(req, 'body');
        const result = await paymentService.initiateRefund(id, reason, {
            roleType: req.user.roleType,
            userId: req.user._id,
        });
        return res.status(200).json(ApiResponse.success(result, 'Refund initiated'));
    } catch (error) {
        next(error);
    }
};

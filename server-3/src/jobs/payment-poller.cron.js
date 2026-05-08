import logger from '../utils/logger.js';
import { pollPendingPayments } from '../services/payment.service.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
let intervalId = null;

export const startPaymentPoller = () => {
    if (intervalId) return;

    logger.info('[PaymentPoller] Starting payment status poller', {
        intervalMs: POLL_INTERVAL_MS,
    });

    pollPendingPayments().catch((error) => {
        logger.error('[PaymentPoller] Initial poll failed', { error: error.message });
    });

    intervalId = setInterval(async () => {
        try {
            await pollPendingPayments();
        } catch (error) {
            logger.error('[PaymentPoller] Poll cycle failed', { error: error.message });
        }
    }, POLL_INTERVAL_MS);
};

export const stopPaymentPoller = () => {
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;
    logger.info('[PaymentPoller] Stopped');
};

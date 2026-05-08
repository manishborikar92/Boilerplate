import logger from '../utils/logger.js';
import { pollPendingPayouts } from '../services/payout.service.js';

const POLL_INTERVAL_MS = 10 * 60 * 1000;
let intervalId = null;

export const startPayoutPoller = () => {
    if (intervalId) return;

    logger.info('[PayoutPoller] Starting payout status poller', {
        intervalMs: POLL_INTERVAL_MS,
    });

    setTimeout(() => {
        pollPendingPayouts().catch((error) => {
            logger.error('[PayoutPoller] Initial poll failed', { error: error.message });
        });
    }, 30_000);

    intervalId = setInterval(async () => {
        try {
            await pollPendingPayouts();
        } catch (error) {
            logger.error('[PayoutPoller] Poll cycle failed', { error: error.message });
        }
    }, POLL_INTERVAL_MS);
};

export const stopPayoutPoller = () => {
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;
    logger.info('[PayoutPoller] Stopped');
};

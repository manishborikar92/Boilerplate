import logger from '../utils/logger.js';
import { autoCancelAwaitingBookings } from '../services/booking.service.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let intervalId = null;

export const startAutoCancelJob = () => {
    if (intervalId) return;

    logger.info('[AutoCancelJob] Starting auto-cancel job', {
        intervalMs: POLL_INTERVAL_MS,
        intervalMinutes: POLL_INTERVAL_MS / 60000,
    });

    // Run immediately on start
    autoCancelAwaitingBookings().catch((error) => {
        logger.error('[AutoCancelJob] Initial run failed', { error: error.message });
    });

    // Then run every 15 minutes
    intervalId = setInterval(async () => {
        try {
            await autoCancelAwaitingBookings();
        } catch (error) {
            logger.error('[AutoCancelJob] Job cycle failed', { error: error.message });
        }
    }, POLL_INTERVAL_MS);
};

export const stopAutoCancelJob = () => {
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;
    logger.info('[AutoCancelJob] Stopped');
};

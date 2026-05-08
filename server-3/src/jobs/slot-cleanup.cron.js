import employeeRepository from '../repositories/employee.repository.js';
import logger from '../utils/logger.js';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let intervalId = null;

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

export const cleanupPastSlotLocks = async (cutoffDate = getTodayDateString()) => {
    const result = await employeeRepository.cleanupPastTimeLocks(cutoffDate);
    logger.info('[SlotCleanupJob] Past booking locks cleaned', {
        cutoffDate,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
    });
    return result;
};

export const startSlotCleanupJob = () => {
    if (intervalId) return;

    logger.info('[SlotCleanupJob] Starting slot cleanup job', {
        intervalMs: CLEANUP_INTERVAL_MS,
        intervalHours: CLEANUP_INTERVAL_MS / 3_600_000,
    });

    cleanupPastSlotLocks().catch((error) => {
        logger.error('[SlotCleanupJob] Initial run failed', { error: error.message });
    });

    intervalId = setInterval(async () => {
        try {
            await cleanupPastSlotLocks();
        } catch (error) {
            logger.error('[SlotCleanupJob] Job cycle failed', { error: error.message });
        }
    }, CLEANUP_INTERVAL_MS);
};

export const stopSlotCleanupJob = () => {
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;
    logger.info('[SlotCleanupJob] Stopped');
};

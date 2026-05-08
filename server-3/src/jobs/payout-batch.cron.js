import bookingRepository from '../repositories/booking.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as payoutService from '../services/payout.service.js';

let intervalId = null;
let lastRunKey = null;

const getZonedParts = (date, timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    return Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );
};

const parseDailyCron = (cronExpression) => {
    const [minute, hour] = String(cronExpression || '').trim().split(/\s+/);
    const parsedMinute = Number.parseInt(minute, 10);
    const parsedHour = Number.parseInt(hour, 10);

    if (!Number.isInteger(parsedMinute) || !Number.isInteger(parsedHour)) {
        return {
            minute: 0,
            hour: 23,
        };
    }

    return {
        minute: parsedMinute,
        hour: parsedHour,
    };
};

export const runPayoutBatchNow = async ({
    triggerBarberPayout = payoutService.triggerBarberPayout,
} = {}) => {
    const pendingBookings = await bookingRepository.findCompletedWithPendingPayout();

    if (pendingBookings.length === 0) {
        logger.info('[PayoutBatchJob] No pending payouts for this cycle');
        return {
            totalBookings: 0,
            uniqueBarbers: 0,
            success: 0,
            failed: 0,
        };
    }

    const bookingIds = pendingBookings.map((booking) => booking._id);
    const completedPayments = await paymentRepository.findCompletedByBookingIds(bookingIds);
    const paymentByBookingId = new Map(
        completedPayments.map((payment) => [String(payment.bookingId), payment]),
    );

    const groupedPayouts = new Map();
    for (const booking of pendingBookings) {
        const barberId = String(booking.shopId?.ownerId || booking.shopId);
        if (!groupedPayouts.has(barberId)) {
            groupedPayouts.set(barberId, {
                bookingIds: [],
                totalPayoutInPaisa: 0,
            });
        }

        const group = groupedPayouts.get(barberId);
        group.bookingIds.push(String(booking._id));

        const payment = paymentByBookingId.get(String(booking._id));
        group.totalPayoutInPaisa += (
            payment?.settlement?.barberPayout
            || payment?.settlement?.serviceAmount
            || 0
        );
    }

    let success = 0;
    let failed = 0;

    for (const [barberId, { bookingIds: groupBookingIds, totalPayoutInPaisa }] of groupedPayouts.entries()) {
        try {
            await triggerBarberPayout(barberId, groupBookingIds, totalPayoutInPaisa);
            success += 1;
        } catch (error) {
            failed += 1;
            logger.error('[PayoutBatchJob] Failed to initiate payout for barber group', {
                barberId,
                bookingIds: groupBookingIds,
                error: error.message,
            });
        }
    }

    const result = {
        totalBookings: pendingBookings.length,
        uniqueBarbers: groupedPayouts.size,
        success,
        failed,
    };

    logger.info('[PayoutBatchJob] Batch cycle complete', result);
    return result;
};

export const startPayoutBatchJob = () => {
    if (intervalId) return;

    const { minute, hour } = parseDailyCron(config.payment.payoutBatchCronTime);
    const timeZone = config.payment.payoutBatchTimezone || 'Asia/Kolkata';

    logger.info('[PayoutBatchJob] Scheduling end-of-day batch payout', {
        hour,
        minute,
        timeZone,
    });

    intervalId = setInterval(async () => {
        const parts = getZonedParts(new Date(), timeZone);
        const runKey = `${parts.year}-${parts.month}-${parts.day}`;

        if (Number(parts.hour) !== hour || Number(parts.minute) !== minute) {
            return;
        }

        if (lastRunKey === runKey) {
            return;
        }

        lastRunKey = runKey;

        try {
            await runPayoutBatchNow();
        } catch (error) {
            logger.error('[PayoutBatchJob] Scheduled batch failed', {
                error: error.message,
            });
        }
    }, 60_000);
};

export const stopPayoutBatchJob = () => {
    if (!intervalId) return;

    clearInterval(intervalId);
    intervalId = null;
    logger.info('[PayoutBatchJob] Stopped');
};

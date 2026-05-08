/**
 * Exact-range availability engine.
 *
 * Slots are display suggestions. The source of truth is the continuous
 * [startMinute, endMinute) range used here and by the booking repository.
 */

import {
    buildTimeRange,
    doTimeRangesOverlap,
    minutesToTimeString,
    normalizeBreakTimeRanges,
    parseTimeToMinutes,
} from './time.utils.js';

export const SLOT_INTERVAL_MINUTES = 5;

const BOOKING_FALLBACK_DURATION_MINUTES = 30;

const isSameDate = (value, date) => {
    if (!value) return false;
    return new Date(value).toISOString().slice(0, 10) === date;
};

const normalizeRange = (range, fallbackDate) => {
    const startMinute = Number(range?.startMinute);
    const endMinute = Number(range?.endMinute);

    if (
        Number.isFinite(startMinute)
        && Number.isFinite(endMinute)
        && startMinute < endMinute
    ) {
        return {
            date: range.date || fallbackDate,
            startTime: range.startTime || minutesToTimeString(startMinute),
            endTime: range.endTime || minutesToTimeString(endMinute),
            startMinute,
            endMinute,
            bookingId: range.bookingId,
        };
    }

    const duration = Number(range?.durationMinutes) > 0
        ? Number(range.durationMinutes)
        : BOOKING_FALLBACK_DURATION_MINUTES;
    const builtRange = buildTimeRange(range?.time || range?.startTime, duration);
    if (!builtRange) return null;

    return {
        date: range.date || fallbackDate,
        startTime: builtRange.startTime,
        endTime: builtRange.endTime,
        startMinute: builtRange.startMinute,
        endMinute: builtRange.endMinute,
        bookingId: range.bookingId || range._id,
    };
};

export const normalizeBookedRanges = ({
    date,
    bookedRanges = [],
    bookedSlots = [],
}) => {
    const ranges = [];

    for (const range of bookedRanges || []) {
        const normalized = normalizeRange(range, date);
        if (normalized && (!normalized.date || isSameDate(normalized.date, date))) {
            ranges.push(normalized);
        }
    }

    for (const booking of bookedSlots || []) {
        const normalized = normalizeRange(booking, date);
        if (normalized && (!normalized.date || isSameDate(normalized.date, date))) {
            ranges.push(normalized);
        }
    }

    return ranges;
};

const sortRanges = (ranges = []) => (
    [...ranges].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
);

const mergeRanges = (ranges = []) => {
    const sorted = sortRanges(ranges);
    const merged = [];

    for (const range of sorted) {
        const previous = merged.at(-1);
        if (!previous || range.startMinute > previous.endMinute) {
            merged.push({ ...range });
            continue;
        }

        previous.endMinute = Math.max(previous.endMinute, range.endMinute);
        previous.endTime = minutesToTimeString(previous.endMinute);
    }

    return merged;
};

const subtractBlockedRanges = (windowRange, blockedRanges = []) => {
    let windows = [{ ...windowRange }];

    for (const block of mergeRanges(blockedRanges)) {
        const nextWindows = [];

        for (const window of windows) {
            if (!doTimeRangesOverlap(window.startMinute, window.endMinute, block.startMinute, block.endMinute)) {
                nextWindows.push(window);
                continue;
            }

            if (block.startMinute > window.startMinute) {
                nextWindows.push({
                    startMinute: window.startMinute,
                    endMinute: Math.min(block.startMinute, window.endMinute),
                });
            }

            if (block.endMinute < window.endMinute) {
                nextWindows.push({
                    startMinute: Math.max(block.endMinute, window.startMinute),
                    endMinute: window.endMinute,
                });
            }
        }

        windows = nextWindows;
    }

    return windows
        .filter((window) => window.startMinute < window.endMinute)
        .map((window) => ({
            startTime: minutesToTimeString(window.startMinute),
            endTime: minutesToTimeString(window.endMinute),
            startMinute: window.startMinute,
            endMinute: window.endMinute,
        }));
};

const generateTimeSlotsFromMinutes = (
    startMinutes,
    endMinutes,
    serviceDuration,
    intervalMinutes = SLOT_INTERVAL_MINUTES,
) => {
    if (
        !Number.isFinite(startMinutes)
        || !Number.isFinite(endMinutes)
        || !Number.isFinite(serviceDuration)
        || startMinutes >= endMinutes
    ) {
        return [];
    }

    const slots = new Set();
    for (
        let currentMinutes = startMinutes;
        currentMinutes + serviceDuration <= endMinutes;
        currentMinutes += intervalMinutes
    ) {
        slots.add(minutesToTimeString(currentMinutes));
    }

    return [...slots].filter(Boolean);
};

/**
 * Generate all possible display slots between start and end time.
 */
export const generateTimeSlots = (
    startTime,
    endTime,
    serviceDuration,
    intervalMinutes = SLOT_INTERVAL_MINUTES,
) => {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    return generateTimeSlotsFromMinutes(startMinutes, endMinutes, serviceDuration, intervalMinutes);
};

const isSlotInPast = (slotTime, date, now = new Date()) => {
    const todayStr = now.toISOString().slice(0, 10);
    if (date !== todayStr) return false;

    const slotMinutes = parseTimeToMinutes(slotTime);
    if (slotMinutes === null) return true;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return slotMinutes <= currentMinutes;
};

const getSlotBlockReason = ({
    slotTime,
    date,
    serviceDuration,
    bookedRanges,
    breakRanges,
    effectiveStartMinutes,
    effectiveEndMinutes,
    now,
}) => {
    const slotRange = buildTimeRange(slotTime, serviceDuration);
    if (!slotRange) return 'invalid_time';

    if (
        slotRange.startMinute < effectiveStartMinutes
        || slotRange.endMinute > effectiveEndMinutes
    ) {
        return 'outside_hours';
    }

    if (isSlotInPast(slotTime, date, now)) return 'past';

    if (breakRanges.some((breakRange) => (
        doTimeRangesOverlap(
            slotRange.startMinute,
            slotRange.endMinute,
            breakRange.startMinute,
            breakRange.endMinute,
        )
    ))) {
        return 'break';
    }

    if (bookedRanges.some((bookedRange) => (
        doTimeRangesOverlap(
            slotRange.startMinute,
            slotRange.endMinute,
            bookedRange.startMinute,
            bookedRange.endMinute,
        )
    ))) {
        return 'booked';
    }

    return null;
};

const addExactFreeWindowStarts = (candidateTimes, availableWindows, serviceDuration) => {
    for (const window of availableWindows) {
        if (window.startMinute + serviceDuration <= window.endMinute) {
            candidateTimes.add(window.startTime);
        }
    }
};

export const calculateAvailableSlots = ({
    date,
    shopHours,
    employeeHours,
    serviceDuration,
    bookedSlots = [],
    bookedRanges = [],
    breakTimes = [],
    blockedDates = [],
    now = new Date(),
    intervalMinutes = SLOT_INTERVAL_MINUTES,
}) => {
    const isDateBlocked = blockedDates.some((blockedDate) => isSameDate(blockedDate, date));

    if (isDateBlocked) {
        return {
            slots: [],
            availableWindows: [],
            totalSlots: 0,
            totalAvailable: 0,
            reason: 'date_blocked',
        };
    }

    const shopStartMinutes = parseTimeToMinutes(shopHours?.openTime);
    const shopEndMinutes = parseTimeToMinutes(shopHours?.closeTime);
    const employeeStartMinutes = parseTimeToMinutes(employeeHours?.start);
    const employeeEndMinutes = parseTimeToMinutes(employeeHours?.end);

    if (
        shopStartMinutes === null
        || shopEndMinutes === null
        || employeeStartMinutes === null
        || employeeEndMinutes === null
        || shopStartMinutes >= shopEndMinutes
        || employeeStartMinutes >= employeeEndMinutes
    ) {
        return {
            slots: [],
            availableWindows: [],
            totalSlots: 0,
            totalAvailable: 0,
            reason: 'invalid_hours',
        };
    }

    const duration = Number(serviceDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
        return {
            slots: [],
            availableWindows: [],
            totalSlots: 0,
            totalAvailable: 0,
            reason: 'invalid_duration',
        };
    }

    const effectiveStartMinutes = Math.max(shopStartMinutes, employeeStartMinutes);
    const effectiveEndMinutes = Math.min(shopEndMinutes, employeeEndMinutes);

    if (effectiveStartMinutes >= effectiveEndMinutes) {
        return {
            slots: [],
            availableWindows: [],
            totalSlots: 0,
            totalAvailable: 0,
            reason: 'no_overlap',
        };
    }

    const normalizedBookedRanges = normalizeBookedRanges({ date, bookedRanges, bookedSlots });
    const breakRanges = normalizeBreakTimeRanges(breakTimes)
        .filter((breakRange) => (
            doTimeRangesOverlap(
                effectiveStartMinutes,
                effectiveEndMinutes,
                breakRange.startMinute,
                breakRange.endMinute,
            )
        ));
    const effectiveWindow = {
        startMinute: effectiveStartMinutes,
        endMinute: effectiveEndMinutes,
    };
    const availableWindows = subtractBlockedRanges(effectiveWindow, [
        ...breakRanges,
        ...normalizedBookedRanges,
    ]).filter((window) => window.startMinute + duration <= window.endMinute);

    const candidateTimes = new Set(generateTimeSlotsFromMinutes(
        effectiveStartMinutes,
        effectiveEndMinutes,
        duration,
        intervalMinutes,
    ));
    addExactFreeWindowStarts(candidateTimes, availableWindows, duration);

    const slots = [...candidateTimes]
        .map((time) => {
            const startMinute = parseTimeToMinutes(time);
            return { time, startMinute };
        })
        .filter((slot) => slot.startMinute !== null)
        .sort((a, b) => a.startMinute - b.startMinute)
        .map(({ time }) => {
            const reason = getSlotBlockReason({
                slotTime: time,
                date,
                serviceDuration: duration,
                bookedRanges: normalizedBookedRanges,
                breakRanges,
                effectiveStartMinutes,
                effectiveEndMinutes,
                now,
            });

            return {
                time,
                available: !reason,
                ...(reason && { reason }),
            };
        });

    const totalAvailable = slots.filter((slot) => slot.available).length;

    return {
        slots,
        availableWindows,
        totalSlots: slots.length,
        totalAvailable,
        slotInterval: intervalMinutes,
    };
};

export const getAvailableSlotTimes = (params) => {
    const result = calculateAvailableSlots(params);
    return result.slots
        .filter((slot) => slot.available)
        .map((slot) => slot.time);
};

export const findFirstAvailableSlot = (params) => {
    const result = calculateAvailableSlots(params);
    const firstAvailable = result.slots.find((slot) => slot.available);
    return firstAvailable ? firstAvailable.time : null;
};

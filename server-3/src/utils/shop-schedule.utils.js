import { parseTimeToMinutes, toTwentyFourHourTime } from './time.utils.js';

const result = (value, error = null) => ({ value, error });

const buildTimeFormatError = (fieldName) => `${fieldName} must use HH:MM or hh:mm AM/PM format`;

const hasValidOrder = (start, end) => {
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
};

export const normalizeScheduleTime = (value) => {
    if (typeof value !== 'string') return null;
    return toTwentyFourHourTime(value.trim());
};

export const normalizeBreakTimes = (breakTimes = []) => {
    let rawBreakTimes = breakTimes;

    if (typeof rawBreakTimes === 'string') {
        const trimmed = rawBreakTimes.trim();
        if (!trimmed) return result([]);

        try {
            rawBreakTimes = JSON.parse(trimmed);
        } catch {
            return result(null, 'breakTimes must be a valid JSON array');
        }
    }

    if (!Array.isArray(rawBreakTimes)) {
        rawBreakTimes = [rawBreakTimes];
    }

    const normalizedBreakTimes = [];

    for (const [index, entry] of rawBreakTimes.entries()) {
        const start = normalizeScheduleTime(entry?.start ?? entry?.startsAt ?? '');
        if (!start) {
            return result(null, buildTimeFormatError(`breakTimes[${index}].start`));
        }

        const end = normalizeScheduleTime(entry?.end ?? entry?.endsAt ?? '');
        if (!end) {
            return result(null, buildTimeFormatError(`breakTimes[${index}].end`));
        }

        if (!hasValidOrder(start, end)) {
            return result(
                null,
                `breakTimes[${index}].start must be earlier than breakTimes[${index}].end`,
            );
        }

        normalizedBreakTimes.push({ start, end });
    }

    return result(normalizedBreakTimes);
};

export const normalizeShopSchedule = ({ openTime, closeTime, breakTimes = [] }) => {
    const normalizedOpenTime = normalizeScheduleTime(openTime);
    if (!normalizedOpenTime) {
        return result(null, buildTimeFormatError('openTime'));
    }

    const normalizedCloseTime = normalizeScheduleTime(closeTime);
    if (!normalizedCloseTime) {
        return result(null, buildTimeFormatError('closeTime'));
    }

    if (!hasValidOrder(normalizedOpenTime, normalizedCloseTime)) {
        return result(null, 'openTime must be earlier than closeTime');
    }

    const normalizedBreakTimesResult = normalizeBreakTimes(breakTimes);
    if (normalizedBreakTimesResult.error) {
        return normalizedBreakTimesResult;
    }

    const shopOpenMinutes = parseTimeToMinutes(normalizedOpenTime);
    const shopCloseMinutes = parseTimeToMinutes(normalizedCloseTime);

    for (const [index, entry] of normalizedBreakTimesResult.value.entries()) {
        const breakStartMinutes = parseTimeToMinutes(entry.start);
        const breakEndMinutes = parseTimeToMinutes(entry.end);

        if (breakStartMinutes < shopOpenMinutes || breakEndMinutes > shopCloseMinutes) {
            return result(null, `breakTimes[${index}] must stay within shop hours`);
        }
    }

    return result({
        openTime: normalizedOpenTime,
        closeTime: normalizedCloseTime,
        breakTimes: normalizedBreakTimesResult.value,
    });
};

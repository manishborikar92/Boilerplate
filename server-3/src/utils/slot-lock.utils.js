import { parseTimeToMinutes } from './time.utils.js';

export const SLOT_LOCK_INTERVAL_MINUTES = 30;

const minutesToTimeString = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const buildSlotLockTimes = (
    startTime,
    durationMinutes,
    intervalMinutes = SLOT_LOCK_INTERVAL_MINUTES,
) => {
    const startMinutes = parseTimeToMinutes(startTime);
    const duration = Number(durationMinutes);

    if (startMinutes === null || !Number.isFinite(duration) || duration <= 0) {
        return [];
    }

    const lockCount = Math.ceil(duration / intervalMinutes);
    return Array.from({ length: lockCount }, (_, index) => (
        minutesToTimeString(startMinutes + (index * intervalMinutes))
    ));
};

export const toDateOnlyString = (value) => {
    if (typeof value === 'string') return value.slice(0, 10);
    return new Date(value).toISOString().slice(0, 10);
};

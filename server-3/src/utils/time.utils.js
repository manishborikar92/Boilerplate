/**
 * Time-related utility functions.
 */

const TWELVE_HOUR_TIME_PATTERN = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])$/;
const TWENTY_FOUR_HOUR_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const minutesToTimeString = (totalMinutes) => {
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0 || totalMinutes > 24 * 60) return null;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Parse a supported time string into total minutes since midnight.
 * Accepts "HH:MM" and "hh:mm AM/PM".
 *
 * @param   {string}      timeStr
 * @returns {number|null} minutes since midnight, or null if unparseable
 */
export const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const normalized = timeStr.trim().replace(/\s+/g, ' ');
    if (!normalized) return null;

    const twentyFourHourMatch = normalized.match(TWENTY_FOUR_HOUR_TIME_PATTERN);
    if (twentyFourHourMatch) {
        const hours = Number.parseInt(twentyFourHourMatch[1], 10);
        const minutes = Number.parseInt(twentyFourHourMatch[2], 10);
        return (hours * 60) + minutes;
    }

    const twelveHourMatch = normalized.match(TWELVE_HOUR_TIME_PATTERN);
    if (!twelveHourMatch) return null;

    let hours = Number.parseInt(twelveHourMatch[1], 10);
    const minutes = Number.parseInt(twelveHourMatch[2], 10);
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return (hours * 60) + minutes;
};

export const toTwentyFourHourTime = (timeStr) => {
    const minutes = parseTimeToMinutes(timeStr);
    if (minutes === null) return null;
    return minutesToTimeString(minutes);
};

export const addMinutesToTime = (timeStr, minutesToAdd) => {
    const startMinutes = parseTimeToMinutes(timeStr);
    const duration = Number(minutesToAdd);
    if (startMinutes === null || !Number.isFinite(duration)) return null;
    return minutesToTimeString(startMinutes + duration);
};

export const doTimeRangesOverlap = (startA, endA, startB, endB) => (
    startA < endB && endA > startB
);

export const isTimeRangeWithinWindow = (startMinutes, endMinutes, windowStartMinutes, windowEndMinutes) => (
    Number.isFinite(startMinutes)
    && Number.isFinite(endMinutes)
    && Number.isFinite(windowStartMinutes)
    && Number.isFinite(windowEndMinutes)
    && startMinutes >= windowStartMinutes
    && endMinutes <= windowEndMinutes
    && startMinutes < endMinutes
);

export const normalizeBreakTimeRanges = (breakTimes = []) => (
    (Array.isArray(breakTimes) ? breakTimes : [])
        .map((breakTime) => {
            const startMinute = parseTimeToMinutes(breakTime?.start);
            const endMinute = parseTimeToMinutes(breakTime?.end);
            if (startMinute === null || endMinute === null || startMinute >= endMinute) return null;
            return {
                startTime: minutesToTimeString(startMinute),
                endTime: minutesToTimeString(endMinute),
                startMinute,
                endMinute,
            };
        })
        .filter(Boolean)
);

export const getOverlappingBreakRange = (startMinutes, endMinutes, breakTimes = []) => (
    normalizeBreakTimeRanges(breakTimes).find((breakRange) => (
        doTimeRangesOverlap(startMinutes, endMinutes, breakRange.startMinute, breakRange.endMinute)
    )) || null
);

export const isTimeRangeOverlappingBreak = (startMinutes, endMinutes, breakTimes = []) => (
    Boolean(getOverlappingBreakRange(startMinutes, endMinutes, breakTimes))
);

export const buildTimeRange = (startTime, durationMinutes) => {
    const normalizedStartTime = toTwentyFourHourTime(startTime);
    const startMinute = parseTimeToMinutes(normalizedStartTime);
    const duration = Number(durationMinutes);

    if (
        !normalizedStartTime
        || startMinute === null
        || !Number.isFinite(duration)
        || duration <= 0
    ) {
        return null;
    }

    const endMinute = startMinute + duration;
    const endTime = minutesToTimeString(endMinute);
    if (!endTime) return null;

    return {
        startTime: normalizedStartTime,
        endTime,
        startMinute,
        endMinute,
        durationMinutes: duration,
    };
};

/**
 * Check whether a booking time is in the future compared to "now".
 *
 * @param   {string}  dateStr
 * @param   {string}  timeStr
 * @param   {Date}    [now]
 * @returns {boolean}
 */
export const isBookingInFuture = (dateStr, timeStr, now = new Date()) => {
    const bookingMinutes = parseTimeToMinutes(timeStr);
    if (bookingMinutes === null) return false;

    const bookingDate = new Date(dateStr);
    const todayStr = now.toISOString().slice(0, 10);
    const bookingDateStr = bookingDate.toISOString().slice(0, 10);

    if (bookingDateStr > todayStr) return true;
    if (bookingDateStr < todayStr) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return bookingMinutes > currentMinutes;
};

/**
 * Check whether a time string falls within a shop's open/close window.
 *
 * @param   {string}  timeStr
 * @param   {string}  openTime
 * @param   {string}  closeTime
 * @returns {boolean}
 */
export const isWithinShopHours = (timeStr, openTime, closeTime) => {
    const bookingMinutes = parseTimeToMinutes(timeStr);
    const openMinutes = parseTimeToMinutes(openTime);
    const closeMinutes = parseTimeToMinutes(closeTime);

    if (
        bookingMinutes === null
        || openMinutes === null
        || closeMinutes === null
        || openMinutes >= closeMinutes
    ) {
        return false;
    }

    return bookingMinutes >= openMinutes && bookingMinutes < closeMinutes;
};

/**
 * Check whether a booking date is within the allowed advance booking window.
 *
 * @param   {string}  dateStr - Date in YYYY-MM-DD format
 * @param   {number}  maxAdvanceDays - Maximum days in advance (default: 7)
 * @param   {Date}    [now] - Current date for testing
 * @returns {boolean}
 */
export const isWithinBookingWindow = (dateStr, maxAdvanceDays = 7, now = new Date()) => {
    const bookingDate = new Date(dateStr);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + maxAdvanceDays);

    // Booking date must be >= today and <= today + maxAdvanceDays
    return bookingDate >= today && bookingDate <= maxDate;
};

/**
 * Check whether a booking date and time is valid for booking.
 * Combines future check and booking window check.
 *
 * @param   {string}  dateStr
 * @param   {string}  timeStr
 * @param   {number}  maxAdvanceDays
 * @param   {Date}    [now]
 * @returns {boolean}
 */
export const isValidBookingDateTime = (dateStr, timeStr, maxAdvanceDays = 7, now = new Date()) => {
    return isBookingInFuture(dateStr, timeStr, now) && isWithinBookingWindow(dateStr, maxAdvanceDays, now);
};

/**
 * Get the full weekday name for a given date string.
 *
 * @param   {string} dateStr
 * @returns {string}
 */
export const getDayOfWeek = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
};

/**
 * Check if "now" is within `windowHours` before the appointment.
 *
 * @param   {Date}    appointmentDate
 * @param   {string}  appointmentTime
 * @param   {number}  windowHours
 * @param   {Date}    [now]
 * @returns {boolean}
 */
export const isWithinCancellationWindow = (
    appointmentDate,
    appointmentTime,
    windowHours,
    now = new Date(),
) => {
    const minutes = parseTimeToMinutes(appointmentTime);
    if (minutes === null) return false;

    const appointment = new Date(appointmentDate);
    appointment.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

    const windowStart = new Date(appointment.getTime() - windowHours * 60 * 60 * 1000);
    return now >= windowStart && now < appointment;
};

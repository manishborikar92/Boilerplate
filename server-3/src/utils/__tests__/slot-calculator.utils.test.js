import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateAvailableSlots } from '../slot-calculator.utils.js';

test('calculateAvailableSlots exposes exact free-window starts after variable-duration bookings', () => {
    const result = calculateAvailableSlots({
        date: '2099-01-01',
        shopHours: { openTime: '12:00', closeTime: '15:00' },
        employeeHours: { start: '12:00', end: '15:00' },
        serviceDuration: 30,
        bookedRanges: [
            {
                date: '2099-01-01',
                startTime: '12:30',
                endTime: '13:35',
                startMinute: 750,
                endMinute: 815,
            },
        ],
        now: new Date('2099-01-01T00:00:00.000Z'),
    });

    assert.ok(
        result.availableWindows.some((window) => window.startTime === '13:35' && window.endTime === '15:00'),
        'exact free window should begin when the previous booking ends',
    );
    assert.ok(
        result.slots.some((slot) => slot.time === '13:35' && slot.available === true),
        'the exact post-booking start should be bookable without waiting for the next fixed slot',
    );
    assert.equal(
        result.slots.find((slot) => slot.time === '12:30')?.available,
        false,
    );
});

test('calculateAvailableSlots rejects starts that span a break and resumes exactly when the break ends', () => {
    const result = calculateAvailableSlots({
        date: '2099-01-01',
        shopHours: { openTime: '12:00', closeTime: '15:00' },
        employeeHours: { start: '12:00', end: '15:00' },
        serviceDuration: 45,
        breakTimes: [{ start: '13:00', end: '13:20' }],
        now: new Date('2099-01-01T00:00:00.000Z'),
    });

    assert.equal(
        result.slots.find((slot) => slot.time === '12:30')?.reason,
        'break',
    );
    assert.ok(
        result.slots.some((slot) => slot.time === '13:20' && slot.available === true),
        'availability should resume at the exact break end',
    );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { isWithinShopHours, parseTimeToMinutes, toTwentyFourHourTime } from '../time.utils.js';

test('parseTimeToMinutes accepts 24-hour and 12-hour time strings', () => {
    assert.equal(parseTimeToMinutes('09:30'), 570);
    assert.equal(parseTimeToMinutes('09:30 AM'), 570);
    assert.equal(parseTimeToMinutes('8:00 PM'), 1200);
});

test('toTwentyFourHourTime normalizes AM/PM strings for persisted shop schedules', () => {
    assert.equal(toTwentyFourHourTime('09:00 AM'), '09:00');
    assert.equal(toTwentyFourHourTime('8:00 PM'), '20:00');
});

test('isWithinShopHours supports legacy AM/PM shop hours', () => {
    assert.equal(isWithinShopHours('10:00 AM', '09:00 AM', '08:00 PM'), true);
    assert.equal(isWithinShopHours('08:30 AM', '09:00 AM', '08:00 PM'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    bookingAnalyticsQuerySchema,
    bookingListQuerySchema,
    bookingPatchSchema,
    createBookingSchema,
} from '../booking.validator.js';

test('booking schemas accept availability HH:MM times and normalize AM/PM input', () => {
    const createResult = createBookingSchema.validate({
        shopId: '507f1f77bcf86cd799439011',
        employeeId: '507f1f77bcf86cd799439012',
        serviceIds: ['507f1f77bcf86cd799439013'],
        date: '2099-01-01',
        time: '10:00',
    });
    assert.equal(createResult.error, undefined);
    assert.equal(createResult.value.time, '10:00');

    const updateResult = bookingPatchSchema.validate({
        employeeId: '507f1f77bcf86cd799439012',
        date: '2099-01-01',
        time: '10:00 AM',
    });
    assert.equal(updateResult.error, undefined);
    assert.equal(updateResult.value.time, '10:00');

    const statusResult = bookingPatchSchema.validate({
        status: 'confirmed',
    });
    assert.equal(statusResult.error, undefined);
    assert.equal(statusResult.value.status, 'confirmed');
});

test('createBookingSchema accepts sourceBookingId for reordering through the bookings collection', () => {
    const { error, value } = createBookingSchema.validate({
        sourceBookingId: '507f1f77bcf86cd799439011',
        date: '2099-01-02',
        time: '1:30 PM',
    });

    assert.equal(error, undefined);
    assert.equal(value.time, '13:30');
});

test('bookingPatchSchema rejects mixed schedule and status changes', () => {
    const { error } = bookingPatchSchema.validate({
        employeeId: '507f1f77bcf86cd799439012',
        date: '2099-01-01',
        time: '10:00',
        status: 'completed',
    });

    assert.match(error?.message || '', /does not match any of the allowed types/);
});

test('bookingAnalyticsQuerySchema accepts a complete explicit month/year period', () => {
    const { error, value } = bookingAnalyticsQuerySchema.validate({
        month: '3',
        year: '2026',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        month: 3,
        year: 2026,
    });
});

test('bookingAnalyticsQuerySchema rejects incomplete periods', () => {
    const { error } = bookingAnalyticsQuerySchema.validate({
        month: 3,
    });

    assert.match(error?.message || '', /contains \[month\] without its required peers \[year\]/);
});

test('booking list queries accept explicit date and multi-status filters', () => {
    const bookingQuery = bookingListQuerySchema.validate({
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        status: 'confirmed,awaiting_confirmation',
        page: '1',
        limit: '10',
    });
    assert.equal(bookingQuery.error, undefined);
    assert.deepEqual(bookingQuery.value.status, ['confirmed', 'awaiting_confirmation']);
    assert.equal(bookingQuery.value.dateFrom, '2026-05-01');
    assert.equal(bookingQuery.value.dateTo, '2026-05-31');
    const legacyPeriodQuery = bookingListQuerySchema.validate({ period: 'past' });
    assert.match(legacyPeriodQuery.error?.message || '', /period/);
});

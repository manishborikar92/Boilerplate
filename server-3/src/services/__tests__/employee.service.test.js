import assert from 'node:assert/strict';
import test from 'node:test';

import cloudinary from '../../config/cloudinary.config.js';
import bookingRepository from '../../repositories/booking.repository.js';
import employeeRepository from '../../repositories/employee.repository.js';
import shopRepository from '../../repositories/shop.repository.js';
import notificationEvents from '../notification-events.service.js';
import * as employeeService from '../employee.service.js';

test('deleteEmployee blocks unresolved bookings for that employee', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findById', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        cloudinaryId: 'employee-photo-1',
    }));
    t.mock.method(bookingRepository, 'hasActiveBookingsForEmployee', async () => true);

    let softDeleteCalled = false;
    t.mock.method(employeeRepository, 'softDelete', async () => {
        softDeleteCalled = true;
        return null;
    });

    await assert.rejects(
        () => employeeService.deleteEmployee('owner-1', 'employee-1'),
        {
            name: 'BadRequestError',
            message: 'Cannot delete employee with upcoming or pending bookings',
        },
    );

    assert.equal(softDeleteCalled, false);
});

test('addEmployee cleans up uploaded photo when a duplicate write slips past the pre-check', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        openTime: '09:00',
        closeTime: '18:00',
    }));
    t.mock.method(employeeRepository, 'findByShopIdAndPhone', async () => null);
    t.mock.method(employeeRepository, 'create', async () => {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
    });

    let destroyedPublicId = null;
    t.mock.method(cloudinary.uploader, 'destroy', async (publicId) => {
        destroyedPublicId = publicId;
        return { result: 'ok' };
    });

    await assert.rejects(
        () => employeeService.addEmployee(
            'owner-1',
            {
                firstName: 'Alex',
                lastName: 'Stylist',
                phoneNumber: '+15551234567',
                gender: 'Male',
                dateOfBirth: '1994-04-12',
                workingHours: { start: '09:00', end: '18:00' },
            },
            {
                path: 'https://example.com/photo.jpg',
                public_id: 'employee-photo-1',
            },
        ),
        {
            name: 'ConflictError',
            message: 'Employee with this phone number already exists',
        },
    );

    assert.equal(destroyedPublicId, 'employee-photo-1');
});

test('addEmployee accepts 24-hour employee hours when legacy shop hours are stored in AM/PM format', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        openTime: '09:00 AM',
        closeTime: '08:00 PM',
    }));
    t.mock.method(employeeRepository, 'findByShopIdAndPhone', async () => null);

    let createdPayload = null;
    t.mock.method(employeeRepository, 'create', async (payload) => {
        createdPayload = payload;
        return payload;
    });

    const employee = await employeeService.addEmployee(
        'owner-1',
        {
            firstName: 'Alex',
            lastName: 'Stylist',
            phoneNumber: '+15551234567',
            gender: 'Male',
            dateOfBirth: '1994-04-12',
            workingHours: { start: '09:00', end: '18:00' },
        },
        null,
    );

    assert.deepEqual(createdPayload.workingHours, { start: '09:00', end: '18:00' });
    assert.equal(employee.shopId, 'shop-1');
});

test('addEmployee defaults working hours to normalized 24-hour shop hours', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        openTime: '09:00 AM',
        closeTime: '08:00 PM',
    }));
    t.mock.method(employeeRepository, 'findByShopIdAndPhone', async () => null);

    let createdPayload = null;
    t.mock.method(employeeRepository, 'create', async (payload) => {
        createdPayload = payload;
        return payload;
    });

    await employeeService.addEmployee(
        'owner-1',
        {
            firstName: 'Alex',
            lastName: 'Stylist',
            phoneNumber: '+15551234567',
            gender: 'Male',
            dateOfBirth: '1994-04-12',
        },
        null,
    );

    assert.deepEqual(createdPayload.workingHours, { start: '09:00', end: '20:00' });
});

test('updateEmployee persists desired active state through the employee resource update', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        openTime: '09:00',
        closeTime: '18:00',
    }));
    t.mock.method(employeeRepository, 'findById', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        firstName: 'Mina',
        lastName: 'Stylist',
        phoneNumber: '+15551234567',
        isActive: true,
    }));

    let updateArgs = null;
    t.mock.method(employeeRepository, 'updateById', async (employeeId, shopId, updateData) => {
        updateArgs = { employeeId, shopId, updateData };
        return {
            _id: employeeId,
            shopId,
            firstName: 'Mina',
            lastName: 'Stylist',
            phoneNumber: '+15551234567',
            isActive: updateData.isActive,
        };
    });

    const result = await employeeService.updateEmployee('owner-1', 'employee-1', { isActive: false });

    assert.deepEqual(updateArgs, {
        employeeId: 'employee-1',
        shopId: 'shop-1',
        updateData: { isActive: false },
    });
    assert.equal(result.isActive, false);
});

test('updateEmployeeAvailability blocks only new leave dates and notifies affected bookings', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findById', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        firstName: 'Alex',
        lastName: 'Stylist',
        blockedDates: [new Date('2026-06-15T00:00:00.000Z')],
    }));

    let availabilityUpdate = null;
    t.mock.method(employeeRepository, 'updateAvailabilityDates', async (employeeId, shopId, dates, available) => {
        availabilityUpdate = { employeeId, shopId, dates, available };
        return {
            _id: employeeId,
            shopId,
            firstName: 'Alex',
            lastName: 'Stylist',
            blockedDates: [
                new Date('2026-06-15T00:00:00.000Z'),
                new Date('2026-06-16T00:00:00.000Z'),
            ],
        };
    });

    let affectedLookup = null;
    t.mock.method(bookingRepository, 'findActiveByEmployeeAndDates', async (employeeId, dates) => {
        affectedLookup = { employeeId, dates };
        return [
            {
                _id: 'booking-1',
                customerId: { firstName: 'Mina', lastName: 'Shah' },
                date: new Date('2026-06-16T00:00:00.000Z'),
                time: '10:00',
            },
        ];
    });

    const notifiedBookings = [];
    t.mock.method(notificationEvents, 'notifyBookingEmployeeUnavailable', async (payload) => {
        notifiedBookings.push(payload);
        return { skipped: false };
    });

    const result = await employeeService.updateEmployeeAvailability(
        'owner-1',
        'employee-1',
        { dates: ['2026-06-15', '2026-06-16', '2026-06-16'], available: false },
    );

    assert.deepEqual(availabilityUpdate, {
        employeeId: 'employee-1',
        shopId: 'shop-1',
        dates: ['2026-06-16'],
        available: false,
    });
    assert.deepEqual(affectedLookup, {
        employeeId: 'employee-1',
        dates: ['2026-06-16'],
    });
    assert.deepEqual(notifiedBookings, [
        {
            bookingId: 'booking-1',
            employeeId: 'employee-1',
            employeeName: 'Alex Stylist',
            date: '2026-06-16',
        },
    ]);
    assert.equal(result.employeeId, 'employee-1');
    assert.equal(result.datesBlocked, 1);
    assert.equal(result.affectedBookings, 1);
    assert.equal(result.customersNotified, 1);
    assert.deepEqual(result.blockedDates, ['2026-06-15', '2026-06-16']);
    assert.deepEqual(result.notificationsSent, [
        {
            bookingId: 'booking-1',
            customerName: 'Mina Shah',
            date: '2026-06-16',
            time: '10:00',
            notificationStatus: 'sent',
        },
    ]);
});

test('updateEmployeeAvailability removes blocked dates without notifying customers', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findById', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        firstName: 'Alex',
        lastName: 'Stylist',
        blockedDates: [new Date('2026-06-15T00:00:00.000Z')],
    }));
    t.mock.method(employeeRepository, 'updateAvailabilityDates', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        firstName: 'Alex',
        lastName: 'Stylist',
        blockedDates: [],
    }));

    const affectedLookup = t.mock.method(bookingRepository, 'findActiveByEmployeeAndDates', async () => []);
    const notifyMock = t.mock.method(notificationEvents, 'notifyBookingEmployeeUnavailable', async () => {
        throw new Error('marking available again should not notify customers');
    });

    const result = await employeeService.updateEmployeeAvailability(
        'owner-1',
        'employee-1',
        { dates: ['2026-06-15'], available: true },
    );

    assert.equal(affectedLookup.mock.calls.length, 0);
    assert.equal(notifyMock.mock.calls.length, 0);
    assert.equal(result.datesUnblocked, 1);
    assert.equal(result.affectedBookings, 0);
    assert.equal(result.customersNotified, 0);
    assert.deepEqual(result.blockedDates, []);
});

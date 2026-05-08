import assert from 'node:assert/strict';
import test from 'node:test';

const ensureRequiredEnv = () => {
    const defaults = {
        MONGODB_URI: 'mongodb://localhost:27017/evercut-test',
        FIREBASE_PROJECT_ID: 'evercut-test',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
        CLOUDINARY_CLOUD_NAME: 'evercut',
        CLOUDINARY_API_KEY: 'cloudinary-key',
        CLOUDINARY_API_SECRET: 'cloudinary-secret',
        MSG91_AUTH_KEY: 'msg91-auth',
        MSG91_OTP_TEMPLATE_ID: 'msg91-template',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        PHONEPE_CLIENT_ID: 'phonepe-client',
        PHONEPE_CLIENT_SECRET: 'phonepe-secret',
        PHONEPE_CLIENT_VERSION: '1',
        PHONEPE_MERCHANT_ID: 'merchant-id',
        PHONEPE_WEBHOOK_USERNAME: 'webhook-user',
        PHONEPE_WEBHOOK_PASSWORD: 'webhook-pass',
        CASHFREE_PAYOUT_CLIENT_ID: 'cashfree-client',
        CASHFREE_PAYOUT_CLIENT_SECRET: 'cashfree-secret',
    };

    for (const [key, value] of Object.entries(defaults)) {
        process.env[key] ??= value;
    }
};

ensureRequiredEnv();

const bookingRepository = (await import('../../repositories/booking.repository.js')).default;
const employeeRepository = (await import('../../repositories/employee.repository.js')).default;
const shopRepository = (await import('../../repositories/shop.repository.js')).default;
const customerRepository = (await import('../../repositories/customer.repository.js')).default;
const serviceRepository = (await import('../../repositories/service.repository.js')).default;
const bookingService = await import('../booking.service.js');

const getInWindowBookingDate = (daysFromNow = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
};

test('getBookingsByShop loads bookings by shopId so deleted employees do not disappear from history', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));

    let countFilter = null;
    t.mock.method(bookingRepository, 'countAll', async (filter) => {
        countFilter = filter;
        return 1;
    });

    let listArgs = null;
    t.mock.method(bookingRepository, 'findByShopId', async (shopId, filters, options) => {
        listArgs = { shopId, filters, options };
        return [{ _id: 'booking-1' }];
    });

    t.mock.method(bookingRepository, 'getUniqueCustomerCountForShop', async () => 2);
    t.mock.method(employeeRepository, 'countByShopId', async () => 3);

    const result = await bookingService.getBookingsByShop('owner-1', { page: 2, limit: 5 });

    assert.deepEqual(countFilter, { shopId: 'shop-1' });
    assert.deepEqual(listArgs, {
        shopId: 'shop-1',
        filters: {},
        options: { skip: 5, limit: 5 },
    });
    assert.equal(result.items[0].id, 'booking-1');
    assert.equal('bookingId' in result.items[0], false);
    assert.equal('_id' in result.items[0], false);
    assert.deepEqual(result.pagination, {
        currentPage: 2,
        totalPages: 1,
        totalDocuments: 1,
        hasNextPage: false,
        hasPrevPage: true,
    });
    assert.equal(result.numberOfEmployees, 3);
    assert.equal(result.numberOfCustomers, 2);
});

test('getCustomerBookings applies explicit status, payment, and date filters', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    let countFilter = null;
    t.mock.method(bookingRepository, 'countAll', async (filter) => {
        countFilter = filter;
        return 1;
    });

    let findArgs = null;
    t.mock.method(bookingRepository, 'findByCustomer', async (customerId, filters, options) => {
        findArgs = { customerId, filters, options };
        return [{ _id: 'booking-1' }];
    });

    const result = await bookingService.getCustomerBookings('user-1', {
        page: 1,
        limit: 10,
        status: ['confirmed', 'completed'],
        paymentStatus: 'success',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
    });

    assert.deepEqual(countFilter, {
        customerId: 'customer-1',
        status: { $in: ['confirmed', 'completed'] },
        paymentStatus: 'success',
        date: {
            $gte: new Date('2026-05-01T00:00:00.000Z'),
            $lte: new Date('2026-05-31T23:59:59.999Z'),
        },
    });
    assert.deepEqual(findArgs, {
        customerId: 'customer-1',
        filters: {
            status: { $in: ['confirmed', 'completed'] },
            paymentStatus: 'success',
            date: {
                $gte: new Date('2026-05-01T00:00:00.000Z'),
                $lte: new Date('2026-05-31T23:59:59.999Z'),
            },
        },
        options: { skip: 0, limit: 10 },
    });
    assert.equal(result.items[0].id, 'booking-1');
});

test('getBookingsByShop rejects employee filters outside the owned shop', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findById', async () => ({
        _id: 'employee-2',
        shopId: 'shop-2',
    }));

    await assert.rejects(
        () => bookingService.getBookingsByShop('owner-1', { employeeId: 'employee-2' }),
        {
            name: 'BadRequestError',
            message: 'Employee does not belong to this shop',
        },
    );
});

test('getBookingAnalytics returns the monthly completed-booking target state for the requested period', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findByShopId', async () => []);
    t.mock.method(bookingRepository, 'countAll', async () => 0);
    t.mock.method(bookingRepository, 'countByStatusForShop', async () => 0);
    t.mock.method(bookingRepository, 'findByShopId', async () => []);

    let capturedArgs = null;
    t.mock.method(bookingRepository, 'countCompletedForShopInDateRange', async (shopId, startDate, endDate) => {
        capturedArgs = { shopId, startDate, endDate };
        return 500;
    });

    const result = await bookingService.getBookingAnalytics('owner-1', { month: 3, year: 2026 });

    assert.deepEqual(capturedArgs, {
        shopId: 'shop-1',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-04-01T00:00:00.000Z'),
    });
    assert.deepEqual(result.milestones, {
        period: {
            month: 3,
            year: 2026,
            label: 'March 2026',
        },
        status: 'active',
        completedBookings: 500,
        progress: {
            min: 0,
            max: 1000,
            value: 500,
            percentage: 50,
        },
        milestones: [
            {
                targetBookings: 500,
                label: '1st target',
                isCompleted: true,
                remainingBookings: 0,
            },
            {
                targetBookings: 750,
                label: '2nd target',
                isCompleted: false,
                remainingBookings: 250,
            },
            {
                targetBookings: 1000,
                label: '3rd target',
                isCompleted: false,
                remainingBookings: 500,
            },
        ],
        currentMilestone: {
            targetBookings: 500,
            label: '1st target',
            statusText: '1st target completed',
        },
        nextMilestone: {
            targetBookings: 750,
            label: '2nd target',
            remainingBookings: 250,
            rewardMessage: 'Just 250 more bookings to reach your next reward!',
        },
    });
});

test('getBookingAnalytics returns no next milestone once all visible targets are completed', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(employeeRepository, 'findByShopId', async () => []);
    t.mock.method(bookingRepository, 'countAll', async () => 0);
    t.mock.method(bookingRepository, 'countByStatusForShop', async () => 0);
    t.mock.method(bookingRepository, 'findByShopId', async () => []);
    t.mock.method(bookingRepository, 'countCompletedForShopInDateRange', async () => 1200);

    const result = await bookingService.getBookingAnalytics('owner-1', { month: 3, year: 2026 });

    assert.equal(result.milestones.progress.value, 1000);
    assert.equal(result.milestones.progress.percentage, 100);
    assert.deepEqual(result.milestones.currentMilestone, {
        targetBookings: 1000,
        label: '3rd target',
        statusText: '3rd target completed',
    });
    assert.equal(result.milestones.nextMilestone, null);
});

test('getBookingAnalytics returns summary, milestones, today pulse, and both queue buckets', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-1',
        openTime: '09:00',
        closeTime: '10:00',
        breakTimes: [],
    }));

    t.mock.method(employeeRepository, 'findByShopId', async () => ([
        {
            _id: 'employee-1',
            isActive: true,
            deletedAt: null,
            workingHours: { start: '09:00', end: '10:00' },
            blockedDates: [],
        },
    ]));

    t.mock.method(bookingRepository, 'countAll', async () => 12);
    t.mock.method(bookingRepository, 'countByStatusForShop', async (_shopId, status) => ({
        pending: 2,
        awaiting_confirmation: 3,
        completed: 4,
        cancelled: 1,
    }[status] || 0));
    t.mock.method(bookingRepository, 'countCompletedForShopInDateRange', async () => 500);
    t.mock.method(bookingRepository, 'findByShopId', async (_shopId, filters) => {
        if (filters.status?.$nin) {
            return [
                {
                    _id: 'active-booking',
                    customerId: { firstName: 'Active', lastName: 'Customer' },
                    employeeId: { firstName: 'Active', lastName: 'Barber' },
                    serviceIds: [{ serviceName: 'Haircut' }],
                    date: new Date(),
                    time: '00:00',
                    status: 'confirmed',
                },
                {
                    _id: 'upcoming-booking',
                    customerId: { firstName: 'Upcoming', lastName: 'Customer' },
                    employeeId: { firstName: 'Upcoming', lastName: 'Barber' },
                    serviceIds: [{ serviceName: 'Shave' }],
                    date: new Date(),
                    time: '23:59',
                    status: 'confirmed',
                },
            ];
        }

        return [
            {
                _id: 'today-booking',
                status: 'confirmed',
                startMinute: 540,
                endMinute: 570,
                durationMinutes: 30,
            },
        ];
    });

    const result = await bookingService.getBookingAnalytics('owner-1', { month: 3, year: 2026 });

    assert.deepEqual(result.summary, {
        total: 12,
        pending: 2,
        awaitingConfirmation: 3,
        completed: 4,
        cancelled: 1,
    });
    assert.equal(result.milestones.period.label, 'March 2026');
    assert.equal(result.today.occupancy.unit, 'minutes');
    assert.equal(result.queue.active.count, 1);
    assert.equal(result.queue.upcoming.count, 1);
    assert.equal(result.queue.active.items[0].id, 'active-booking');
    assert.equal(result.queue.upcoming.items[0].id, 'upcoming-booking');
});

test('createBooking creates a pending booking that requires payment before confirmation', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        breakTimes: [],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            shopId: 'shop-1',
            finalPrice: 120,
            serviceType: 'single',
            duration: 30,
        },
    ]));

    t.mock.method(employeeRepository, 'findByIdLean', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        isActive: true,
        workingHours: { start: '09:00', end: '21:00' },
        blockedDates: [],
    }));

    let capturedClaim = null;
    t.mock.method(employeeRepository, 'claimTimeRange', async (employeeId, range, options) => {
        capturedClaim = { employeeId, range, options };
        return {
            _id: employeeId,
        };
    });
    t.mock.method(employeeRepository, 'claimSlot', async () => {
        throw new Error('createBooking should claim exact ranges, not single slots');
    });
    t.mock.method(employeeRepository, 'claimSlots', async () => {
        throw new Error('createBooking should claim exact ranges, not marker slots');
    });

    const originalReleaseSlots = employeeRepository.releaseSlots;
    if (!employeeRepository.releaseSlots) employeeRepository.releaseSlots = async () => null;
    t.after(() => {
        if (originalReleaseSlots) employeeRepository.releaseSlots = originalReleaseSlots;
        else delete employeeRepository.releaseSlots;
    });

    let capturedRelease = null;
    t.mock.method(employeeRepository, 'releaseTimeRange', async (employeeId, range) => {
        capturedRelease = { employeeId, range };
        return { acknowledged: true };
    });

    t.mock.method(employeeRepository, 'releaseSlot', async () => {
        throw new Error('createBooking should release normalized slot markers with releaseSlots');
    });

    let createdBookingPayload = null;
    t.mock.method(bookingRepository, 'create', async (payload) => {
        createdBookingPayload = payload;
        return {
            _id: 'booking-1',
            ...payload,
            status: payload.status,
            paymentStatus: payload.paymentStatus,
            payoutStatus: payload.payoutStatus,
        };
    });

    const bookingDate = getInWindowBookingDate();
    const result = await bookingService.createBooking('user-1', {
        shopId: 'shop-1',
        employeeId: 'employee-1',
        serviceIds: ['service-1'],
        date: bookingDate,
        time: '10:00 AM',
    });

    assert.equal(capturedClaim.employeeId, 'employee-1');
    assert.equal(capturedClaim.range.date, bookingDate);
    assert.equal(capturedClaim.range.startTime, '10:00');
    assert.equal(capturedClaim.range.endTime, '10:30');
    assert.equal(capturedClaim.range.startMinute, 600);
    assert.equal(capturedClaim.range.endMinute, 630);
    assert.deepEqual(capturedClaim.range.slotLockTimes, ['10:00']);
    assert.deepEqual(capturedClaim.options, { shopId: 'shop-1' });
    assert.equal(capturedRelease, null);
    assert.ok(createdBookingPayload._id);
    assert.equal(createdBookingPayload.customerId, 'customer-1');
    assert.deepEqual(createdBookingPayload.serviceIds, ['service-1']);
    assert.equal(createdBookingPayload.employeeId, 'employee-1');
    assert.equal(createdBookingPayload.shopId, 'shop-1');
    assert.equal(createdBookingPayload.date, bookingDate);
    assert.equal(createdBookingPayload.time, '10:00');
    assert.equal(createdBookingPayload.endTime, '10:30');
    assert.equal(createdBookingPayload.startMinute, 600);
    assert.equal(createdBookingPayload.endMinute, 630);
    assert.equal(createdBookingPayload.totalAmount, 120);
    assert.equal(createdBookingPayload.durationMinutes, 30);
    assert.deepEqual(createdBookingPayload.slotLockTimes, ['10:00']);
    assert.equal(createdBookingPayload.status, 'pending');
    assert.equal(createdBookingPayload.paymentStatus, 'pending');
    assert.equal(createdBookingPayload.payoutStatus, 'not_initiated');
    assert.equal(result.status, 'pending');
    assert.equal(result.paymentRequired, true);
    assert.equal(result.paymentStatus, 'pending');
    assert.equal(result.payoutStatus, 'not_initiated');
});

test('createBooking claims every slot marker covered by the selected service duration', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        breakTimes: [],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            shopId: 'shop-1',
            finalPrice: 120,
            serviceType: 'single',
            duration: 60,
        },
    ]));

    t.mock.method(employeeRepository, 'findByIdLean', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        isActive: true,
        workingHours: { start: '09:00', end: '21:00' },
        blockedDates: [],
    }));

    let claimedRange = null;
    t.mock.method(employeeRepository, 'claimTimeRange', async (_employeeId, range) => {
        claimedRange = range;
        return {
            _id: 'employee-1',
        };
    });
    t.mock.method(employeeRepository, 'claimSlot', async () => {
        throw new Error('createBooking should not use start-only claimSlot for duration-based bookings');
    });
    t.mock.method(employeeRepository, 'claimSlots', async () => {
        throw new Error('createBooking should not use marker-only claimSlots for duration-based bookings');
    });

    t.mock.method(bookingRepository, 'create', async (payload) => ({
        _id: 'employee-1',
        ...payload,
    }));

    const bookingDate = getInWindowBookingDate();
    await bookingService.createBooking('user-1', {
        shopId: 'shop-1',
        employeeId: 'employee-1',
        serviceIds: ['service-1'],
        date: bookingDate,
        time: '10:00',
    });

    assert.equal(claimedRange.startTime, '10:00');
    assert.equal(claimedRange.endTime, '11:00');
    assert.equal(claimedRange.startMinute, 600);
    assert.equal(claimedRange.endMinute, 660);
    assert.deepEqual(claimedRange.slotLockTimes, ['10:00', '10:30']);
});

test('createBooking rejects bookings whose exact end time exceeds the employee or shop window before claiming', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        breakTimes: [],
    }));

    t.mock.method(employeeRepository, 'findByIdLean', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        isActive: true,
        workingHours: { start: '09:00', end: '18:00' },
        blockedDates: [],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            shopId: 'shop-1',
            finalPrice: 120,
            serviceType: 'single',
            duration: 60,
        },
    ]));

    const originalClaimTimeRange = employeeRepository.claimTimeRange;
    if (!employeeRepository.claimTimeRange) employeeRepository.claimTimeRange = async () => null;
    t.after(() => {
        if (originalClaimTimeRange) employeeRepository.claimTimeRange = originalClaimTimeRange;
        else delete employeeRepository.claimTimeRange;
    });

    const claimRangeMock = t.mock.method(employeeRepository, 'claimTimeRange', async () => {
        throw new Error('booking should be rejected before claiming an exact range');
    });
    t.mock.method(employeeRepository, 'claimSlots', async () => {
        throw new Error('booking should not use marker-only claiming');
    });

    await assert.rejects(
        bookingService.createBooking('user-1', {
            shopId: 'shop-1',
            employeeId: 'employee-1',
            serviceIds: ['service-1'],
            date: getInWindowBookingDate(),
            time: '17:30',
        }),
        /past closing time|outside employee working hours/i,
    );
    assert.equal(claimRangeMock.mock.calls.length, 0);
});

test('createBooking rejects bookings that overlap a shop break before claiming', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        breakTimes: [{ start: '13:00', end: '14:00' }],
    }));

    t.mock.method(employeeRepository, 'findByIdLean', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        isActive: true,
        workingHours: { start: '09:00', end: '18:00' },
        blockedDates: [],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            shopId: 'shop-1',
            finalPrice: 120,
            serviceType: 'single',
            duration: 60,
        },
    ]));

    const originalClaimTimeRange = employeeRepository.claimTimeRange;
    if (!employeeRepository.claimTimeRange) employeeRepository.claimTimeRange = async () => null;
    t.after(() => {
        if (originalClaimTimeRange) employeeRepository.claimTimeRange = originalClaimTimeRange;
        else delete employeeRepository.claimTimeRange;
    });

    const claimRangeMock = t.mock.method(employeeRepository, 'claimTimeRange', async () => {
        throw new Error('booking should be rejected before claiming an exact range');
    });
    t.mock.method(employeeRepository, 'claimSlots', async () => {
        throw new Error('booking should not use marker-only claiming');
    });

    await assert.rejects(
        bookingService.createBooking('user-1', {
            shopId: 'shop-1',
            employeeId: 'employee-1',
            serviceIds: ['service-1'],
            date: getInWindowBookingDate(),
            time: '12:30',
        }),
        /break/i,
    );
    assert.equal(claimRangeMock.mock.calls.length, 0);
});

test('createBooking claims an exact minute range and persists exact end metadata', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        breakTimes: [],
    }));

    t.mock.method(employeeRepository, 'findByIdLean', async () => ({
        _id: 'employee-1',
        shopId: 'shop-1',
        isActive: true,
        workingHours: { start: '09:00', end: '21:00' },
        blockedDates: [],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            shopId: 'shop-1',
            finalPrice: 120,
            serviceType: 'single',
            duration: 65,
        },
    ]));

    const originalClaimTimeRange = employeeRepository.claimTimeRange;
    if (!employeeRepository.claimTimeRange) employeeRepository.claimTimeRange = async () => null;
    t.after(() => {
        if (originalClaimTimeRange) employeeRepository.claimTimeRange = originalClaimTimeRange;
        else delete employeeRepository.claimTimeRange;
    });

    let capturedRange = null;
    t.mock.method(employeeRepository, 'claimTimeRange', async (employeeId, range, options) => {
        capturedRange = { employeeId, range, options };
        return { _id: employeeId, firstName: 'Postman', lastName: 'Employee' };
    });
    t.mock.method(employeeRepository, 'claimSlots', async () => {
        throw new Error('exact range bookings must not use marker-only claiming');
    });

    let createdBookingPayload = null;
    t.mock.method(bookingRepository, 'create', async (payload) => {
        createdBookingPayload = payload;
        return { ...payload };
    });

    const bookingDate = getInWindowBookingDate();
    await bookingService.createBooking('user-1', {
        shopId: 'shop-1',
        employeeId: 'employee-1',
        serviceIds: ['service-1'],
        date: bookingDate,
        time: '12:30',
    });

    assert.equal(capturedRange.employeeId, 'employee-1');
    assert.equal(capturedRange.options.shopId, 'shop-1');
    assert.equal(capturedRange.range.date, bookingDate);
    assert.equal(capturedRange.range.startTime, '12:30');
    assert.equal(capturedRange.range.endTime, '13:35');
    assert.equal(capturedRange.range.startMinute, 750);
    assert.equal(capturedRange.range.endMinute, 815);
    assert.ok(capturedRange.range.bookingId);
    assert.equal(createdBookingPayload.time, '12:30');
    assert.equal(createdBookingPayload.endTime, '13:35');
    assert.equal(createdBookingPayload.startMinute, 750);
    assert.equal(createdBookingPayload.endMinute, 815);
    assert.deepEqual(createdBookingPayload.slotLockTimes, ['12:30', '13:00', '13:30']);
});

test('updateBookingSchedule rejects paid bookings before releasing the existing slot', async (t) => {
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-1',
        employeeId: 'employee-1',
        shopId: 'shop-1',
        date: new Date('2099-01-01T00:00:00.000Z'),
        time: '10:00',
        status: 'awaiting_confirmation',
        paymentStatus: 'success',
        slotLockTimes: ['10:00'],
        durationMinutes: 30,
    }));
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    const releaseMock = t.mock.method(employeeRepository, 'releaseSlot', async () => {
        throw new Error('paid bookings should be rejected before releasing slots');
    });

    await assert.rejects(
        bookingService.updateBookingSchedule('booking-1', 'user-1', {
            employeeId: 'employee-1',
            date: '2099-01-02',
            time: '11:00',
        }),
        /cannot be changed after payment has started/i,
    );
    assert.equal(releaseMock.mock.calls.length, 0);
});

test('createBooking rejects bundle bookings below the documented minimum service amount', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(shopRepository, 'findByIdWithFields', async () => ({
        _id: 'shop-1',
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    }));

    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'bundle-1',
            shopId: 'shop-1',
            finalPrice: 250,
            totalPrice: 250,
            serviceType: 'bundled',
            totalDuration: 90,
        },
    ]));

    t.mock.method(employeeRepository, 'claimSlot', async () => ({
        _id: 'employee-1',
    }));

    t.mock.method(bookingRepository, 'create', async (payload) => ({
        _id: 'booking-2',
        ...payload,
    }));

    await assert.rejects(
        bookingService.createBooking('user-1', {
            shopId: 'shop-1',
            employeeId: 'employee-1',
            serviceIds: ['bundle-1'],
            date: getInWindowBookingDate(),
            time: '10:00 AM',
        }),
        /at least ₹300/,
    );
});

test('updateBookingStatus returns a customer-friendly manual-refund message when payout has started', async (t) => {
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-1',
        employeeId: 'employee-1',
        date: new Date('2099-01-01T00:00:00.000Z'),
        time: '10:00 AM',
        paymentStatus: 'success',
        payoutStatus: 'pending',
        status: 'confirmed',
    }));
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    t.mock.method(employeeRepository, 'releaseSlots', async () => ({ acknowledged: true }));

    let bookingUpdate = null;
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdate = updates;
        return { _id: id, ...updates };
    });

    const result = await bookingService.updateBookingStatus(
        'booking-1',
        { _id: 'user-1', roleType: 'CUSTOMER' },
        'cancelled',
    );

    assert.equal(
        bookingUpdate.cancellationNote,
        'Refund window has closed. Please request a manual refund.',
    );
    assert.equal(
        result.cancellationNote,
        'Refund window has closed. Please request a manual refund.',
    );
});

test('updateBookingStatus releases the exact booking range when a booking is completed', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        shopId: 'shop-1',
        employeeId: 'employee-1',
        date: new Date('2099-01-01T00:00:00.000Z'),
        time: '10:00',
        endTime: '10:45',
        startMinute: 600,
        endMinute: 645,
        status: 'confirmed',
        paymentStatus: 'success',
        payoutStatus: 'not_initiated',
        slotLockTimes: ['10:00', '10:30'],
    }));

    const originalReleaseTimeRange = employeeRepository.releaseTimeRange;
    if (!employeeRepository.releaseTimeRange) employeeRepository.releaseTimeRange = async () => null;
    t.after(() => {
        if (originalReleaseTimeRange) employeeRepository.releaseTimeRange = originalReleaseTimeRange;
        else delete employeeRepository.releaseTimeRange;
    });

    let releasedRange = null;
    t.mock.method(employeeRepository, 'releaseTimeRange', async (employeeId, range) => {
        releasedRange = { employeeId, range };
        return { acknowledged: true };
    });
    t.mock.method(employeeRepository, 'releaseSlots', async () => ({ acknowledged: true }));
    t.mock.method(bookingRepository, 'updateById', async (id, update) => ({
        _id: id,
        ...update,
    }));

    await bookingService.updateBookingStatus(
        'booking-1',
        { _id: 'owner-1', roleType: 'BARBER' },
        'completed',
    );

    assert.deepEqual(releasedRange, {
        employeeId: 'employee-1',
        range: {
            bookingId: 'booking-1',
            date: '2099-01-01',
            startMinute: 600,
            endMinute: 645,
            slotLockTimes: ['10:00', '10:30'],
        },
    });
});

test('getFavoriteBookings returns a paginated customer booking favorites list', async (t) => {
    t.mock.method(customerRepository, 'findFavoriteBookingsByUserId', async () => ({
        favoriteBookings: [
            { _id: 'booking-1' },
            { _id: 'booking-2' },
            { _id: 'booking-3' },
        ],
    }));

    const result = await bookingService.getFavoriteBookings('user-1', { page: 2, limit: 2 });

    assert.equal(result.items[0].id, 'booking-3');
    assert.equal('bookingId' in result.items[0], false);
    assert.equal('_id' in result.items[0], false);
    assert.deepEqual(result.pagination, {
        currentPage: 2,
        totalPages: 2,
        totalDocuments: 3,
        hasNextPage: false,
        hasPrevPage: true,
    });
});

test('addFavoriteBooking rejects bookings owned by another customer', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({
        _id: 'customer-1',
        favoriteBookings: [],
    }));
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-2',
    }));

    const addMock = t.mock.method(customerRepository, 'addFavoriteBooking', async () => {
        throw new Error('should not favorite another customer booking');
    });

    await assert.rejects(
        bookingService.addFavoriteBooking('user-1', 'booking-1'),
        /own bookings/,
    );
    assert.equal(addMock.mock.calls.length, 0);
});

test('removeFavoriteBooking removes an existing favorite booking', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({
        _id: 'customer-1',
        favoriteBookings: ['booking-1'],
    }));
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-1',
    }));

    let removed = null;
    t.mock.method(customerRepository, 'removeFavoriteBooking', async (userId, bookingId) => {
        removed = { userId, bookingId };
        return { _id: 'customer-1' };
    });

    const result = await bookingService.removeFavoriteBooking('user-1', 'booking-1');

    assert.deepEqual(removed, { userId: 'user-1', bookingId: 'booking-1' });
    assert.deepEqual(result, {
        favorite: false,
        bookingId: 'booking-1',
    });
});

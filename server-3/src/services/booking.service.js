import mongoose from 'mongoose';

import bookingRepository from '../repositories/booking.repository.js';
import employeeRepository from '../repositories/employee.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/api-error.js';
import {
    isBookingInFuture,
    getDayOfWeek,
    isWithinCancellationWindow,
    toTwentyFourHourTime,
    isValidBookingDateTime,
    isWithinBookingWindow,
    buildTimeRange,
    getOverlappingBreakRange,
    isTimeRangeWithinWindow,
    minutesToTimeString,
    parseTimeToMinutes,
} from '../utils/time.utils.js';
import { buildPagination } from '../utils/pagination.utils.js';
import {
    BOOKING_MILESTONE_TARGETS,
    BOOKING_STATUS,
    BOOKING_LIMITS,
    BUNDLE_RULES,
    MAX_RESCHEDULE_COUNT,
    CANCELLATION_WINDOW_HOURS,
    PAYMENT_STATUS,
    PAYOUT_STATUS,
    ROLES,
    SERVICE_TYPE,
} from '../utils/constants.js';
import { getEffectiveServicePrice, normalizeServicePricing } from '../utils/service-pricing.utils.js';
import { buildSlotLockTimes, toDateOnlyString } from '../utils/slot-lock.utils.js';
import { calculateAvailableSlots, getAvailableSlotTimes, normalizeBookedRanges } from '../utils/slot-calculator.utils.js';
import logger from '../utils/logger.js';
import notificationEvents from './notification-events.service.js';
import {
    serializeBooking,
    serializeBookingCreation,
    serializeBookingDetails,
} from '../serializers/booking.serializer.js';

/**
 * Booking service — all booking business logic.
 */

// ── Customer: create booking ─────────────────────────────────────────────

const normalizeBookedServices = (services = []) => services.map(normalizeServicePricing);
const toObjectIdString = (value) => String(value?._id || value || '');
const paginateArray = (items, query = {}) => {
    const { skip, limit, pagination } = buildPagination(query, items.length);
    return {
        items: items.slice(skip, skip + limit),
        pagination,
    };
};
const setFilterValue = (filters, field, value) => {
    if (Array.isArray(value)) {
        filters[field] = { $in: value };
    } else if (value) {
        filters[field] = value;
    }
};

const toUtcDateBoundary = (dateText, endOfDay = false) => {
    const [year, month, day] = String(dateText).split('-').map(Number);
    return new Date(Date.UTC(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
    ));
};

const applyDateRangeFilter = (filters, query = {}) => {
    if (!query.dateFrom && !query.dateTo) return;

    filters.date = {};

    if (query.dateFrom) {
        filters.date.$gte = toUtcDateBoundary(query.dateFrom);
    }

    if (query.dateTo) {
        filters.date.$lte = toUtcDateBoundary(query.dateTo, true);
    }
};
const sumServicePrices = (services = []) => services.reduce(
    (sum, service) => sum + (getEffectiveServicePrice(service) ?? 0),
    0,
);
const getServiceDuration = (service) => (
    service.serviceType === SERVICE_TYPE.BUNDLED
        ? service.totalDuration
        : service.duration
);
const sumServiceDurations = (services = []) => services.reduce(
    (sum, service) => sum + (Number(getServiceDuration(service)) || 0),
    0,
);
const assertValidServiceDuration = (durationMinutes) => {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new BadRequestError('Selected services must have a valid duration');
    }
};
const normalizeBookingTime = (time) => {
    const normalized = toTwentyFourHourTime(time);
    if (!normalized) throw new BadRequestError('Booking time must use HH:MM or hh:mm AM/PM format');
    return normalized;
};
const getBookingSlotLockTimes = (booking) => {
    if (Array.isArray(booking.slotLockTimes) && booking.slotLockTimes.length > 0) {
        return booking.slotLockTimes;
    }

    const normalizedTime = toTwentyFourHourTime(booking.time);
    return normalizedTime ? [normalizedTime] : [booking.time].filter(Boolean);
};
const getBookingTimeRangeLock = (booking) => {
    const date = toDateOnlyString(booking.date);
    const startMinute = Number(booking.startMinute);
    const endMinute = Number(booking.endMinute);

    if (Number.isFinite(startMinute) && Number.isFinite(endMinute) && startMinute < endMinute) {
        return {
            bookingId: booking._id,
            date,
            startMinute,
            endMinute,
            slotLockTimes: getBookingSlotLockTimes(booking),
        };
    }

    const fallbackDuration = Number(booking.durationMinutes) > 0 ? Number(booking.durationMinutes) : 30;
    const fallbackRange = buildTimeRange(booking.time, fallbackDuration);
    if (!fallbackRange) {
        return {
            bookingId: booking._id,
            date,
            slotLockTimes: getBookingSlotLockTimes(booking),
        };
    }

    return {
        bookingId: booking._id,
        date,
        startMinute: fallbackRange.startMinute,
        endMinute: fallbackRange.endMinute,
        slotLockTimes: getBookingSlotLockTimes(booking),
    };
};
const releaseBookingSlotLock = async (booking) => {
    const rangeLock = getBookingTimeRangeLock(booking);
    const hasPersistedExactRange = Number.isFinite(Number(booking.startMinute))
        && Number.isFinite(Number(booking.endMinute))
        && Number(booking.startMinute) < Number(booking.endMinute);

    if (hasPersistedExactRange) {
        await employeeRepository.releaseTimeRange(booking.employeeId, rangeLock);
        return;
    }

    await employeeRepository.releaseSlots(booking.employeeId, rangeLock.date, rangeLock.slotLockTimes);
};
const assertBookingCanChangeBeforePayment = (booking) => {
    if (booking.status !== BOOKING_STATUS.PENDING || booking.paymentStatus !== PAYMENT_STATUS.PENDING) {
        throw new BadRequestError('Booking cannot be changed after payment has started');
    }
};
const isBundleSelection = (services = []) => (
    services.length > 1
    || services.some((service) => service.serviceType === SERVICE_TYPE.BUNDLED)
);
const assertBundleMinimum = (services = [], totalAmount = 0) => {
    if (!isBundleSelection(services)) return;
    if (totalAmount >= BUNDLE_RULES.MIN_SERVICE_AMOUNT) return;

    throw new BadRequestError(`Bundle service amount must be at least ₹${BUNDLE_RULES.MIN_SERVICE_AMOUNT}`);
};
const assertShopAcceptsDate = (shop, date) => {
    if (!shop.isOpen) throw new BadRequestError('Shop is currently closed');

    const dayOfWeek = getDayOfWeek(date);
    if (!Array.isArray(shop.availableDays) || !shop.availableDays.includes(dayOfWeek)) {
        throw new BadRequestError(`Shop is closed on ${dayOfWeek}`);
    }
};

const loadEmployeeForScheduling = async (employeeId, shopId) => {
    const employee = await employeeRepository.findByIdLean(
        employeeId,
        'firstName lastName photoUrl shopId workingHours blockedDates isActive deletedAt',
    );
    if (!employee) throw new NotFoundError('Employee');
    if (!employee.isActive || employee.deletedAt) throw new BadRequestError('Employee is not active');
    if (toObjectIdString(employee.shopId) !== toObjectIdString(shopId)) {
        throw new BadRequestError('Employee must belong to the target shop');
    }
    return employee;
};

const assertDateIsNotBlockedForEmployee = (employee, date) => {
    const blocked = (employee.blockedDates || []).some((blockedDate) => (
        toDateOnlyString(blockedDate) === date
    ));
    if (blocked) throw new BadRequestError('Employee is blocked for this date');
};

const getEffectiveScheduleWindow = (shop, employee) => {
    const shopStart = parseTimeToMinutes(shop.openTime);
    const shopEnd = parseTimeToMinutes(shop.closeTime);
    const employeeStart = parseTimeToMinutes(employee.workingHours?.start);
    const employeeEnd = parseTimeToMinutes(employee.workingHours?.end);

    if (
        shopStart === null
        || shopEnd === null
        || employeeStart === null
        || employeeEnd === null
        || shopStart >= shopEnd
        || employeeStart >= employeeEnd
    ) {
        throw new BadRequestError('Shop or employee working hours are invalid');
    }

    return {
        startMinute: Math.max(shopStart, employeeStart),
        endMinute: Math.min(shopEnd, employeeEnd),
    };
};

const buildSchedulingPlan = ({ shop, employee, date, time, durationMinutes }) => {
    assertDateIsNotBlockedForEmployee(employee, date);

    const timeRange = buildTimeRange(time, durationMinutes);
    if (!timeRange) throw new BadRequestError('Booking time or duration is invalid');

    const effectiveWindow = getEffectiveScheduleWindow(shop, employee);
    if (effectiveWindow.startMinute >= effectiveWindow.endMinute) {
        throw new BadRequestError('Employee has no working overlap with shop hours');
    }

    if (!isTimeRangeWithinWindow(
        timeRange.startMinute,
        timeRange.endMinute,
        effectiveWindow.startMinute,
        effectiveWindow.endMinute,
    )) {
        const effectiveEnd = minutesToTimeString(effectiveWindow.endMinute);
        if (timeRange.startMinute >= effectiveWindow.startMinute && timeRange.startMinute < effectiveWindow.endMinute) {
            throw new BadRequestError(`Booking would extend past closing time (${effectiveEnd})`);
        }
        throw new BadRequestError('Booking time is outside employee working hours');
    }

    const overlappingBreak = getOverlappingBreakRange(
        timeRange.startMinute,
        timeRange.endMinute,
        shop.breakTimes || [],
    );
    if (overlappingBreak) {
        throw new BadRequestError(
            `Booking time overlaps with shop break ${overlappingBreak.startTime}-${overlappingBreak.endTime}`,
        );
    }

    return {
        ...timeRange,
        date,
        effectiveWindow,
        slotLockTimes: buildSlotLockTimes(timeRange.startTime, durationMinutes),
    };
};

const toBookingRangeForAvailability = (booking) => ({
    _id: booking._id,
    bookingId: booking._id,
    date: booking.date,
    time: booking.time,
    startTime: booking.time,
    endTime: booking.endTime,
    startMinute: booking.startMinute,
    endMinute: booking.endMinute,
    durationMinutes: booking.durationMinutes,
});

const buildBookingPersistencePayload = ({
    bookingId,
    customerId,
    serviceIds,
    employeeId,
    shopId,
    date,
    totalAmount,
    durationMinutes,
    schedulePlan,
    idempotencyKey,
}) => ({
    ...(bookingId && { _id: bookingId }),
    customerId,
    serviceIds,
    employeeId,
    shopId,
    date,
    time: schedulePlan.startTime,
    endTime: schedulePlan.endTime,
    startMinute: schedulePlan.startMinute,
    endMinute: schedulePlan.endMinute,
    totalAmount,
    durationMinutes,
    slotLockTimes: schedulePlan.slotLockTimes,
    status: BOOKING_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING,
    payoutStatus: PAYOUT_STATUS.NOT_INITIATED,
    ...(idempotencyKey && { idempotencyKey }),
});
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

const getOrdinalLabel = (index) => {
    const ordinals = ['1st', '2nd', '3rd'];
    return ordinals[index] || `${index + 1}th`;
};

const getTargetLabel = (index) => `${getOrdinalLabel(index)} target`;

const getUtcMonthRange = (month, year) => ({
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
});

const getDefaultProgressPeriod = () => {
    const now = new Date();
    return {
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
    };
};

const buildBookingDetailsPayload = async (booking) => {
    const services = normalizeBookedServices(
        await serviceRepository.findByIds(
            booking.serviceIds,
            'serviceName finalPrice totalPrice actualPrice offerPrice imageUrl serviceType duration totalDuration',
        ),
    );
    const totalAmount = sumServicePrices(services);

    // Calculate platform fee
    const isBundled = isBundleSelection(services);
    const platformFee = isBundled ? 10 : 3;

    return serializeBookingDetails({
        bookingId: booking._id,
        customer: booking.customerId,
        employee: booking.employeeId,
        shop: booking.shopId,
        date: booking.date,
        time: booking.time,
        endTime: booking.endTime,
        services,
        subTotal: totalAmount,
        platformFee,
        totalAmount: totalAmount + platformFee,
        totalServices: services.length,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        payoutStatus: booking.payoutStatus,
        durationMinutes: booking.durationMinutes || sumServiceDurations(services),
        startMinute: booking.startMinute,
        endMinute: booking.endMinute,
        slotLockTimes: booking.slotLockTimes,
        paymentTransactionId: booking.paymentTransactionId,
        merchantOrderId: booking.merchantOrderId,
    });
};

export const createBooking = async (userId, data) => {
    if (data.sourceBookingId) {
        return reorderBooking(userId, data.sourceBookingId, data.date, data.time);
    }

    const { serviceIds, employeeId, shopId, date, time, idempotencyKey } = data;
    const normalizedTime = normalizeBookingTime(time);

    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    const customerId = customer._id;

    if (idempotencyKey) {
        const existing = await bookingRepository.findByIdempotencyKey(customerId, idempotencyKey);
        if (existing) {
            return serializeBookingCreation({
                bookingId: existing._id,
                shopId: existing.shopId,
                customerId: existing.customerId,
                employeeId: existing.employeeId,
                serviceIds: existing.serviceIds,
                date: toDateOnlyString(existing.date),
                time: existing.time,
                endTime: existing.endTime,
                totalAmount: existing.totalAmount,
                durationMinutes: existing.durationMinutes,
                slotLockTimes: existing.slotLockTimes,
                status: existing.status,
                paymentStatus: existing.paymentStatus,
                payoutStatus: existing.payoutStatus,
                paymentRequired: existing.paymentStatus === PAYMENT_STATUS.PENDING,
                idempotentReplay: true,
            });
        }
    }

    // Validate date/time is in future and within booking window
    if (!isValidBookingDateTime(date, normalizedTime, BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS)) {
        if (!isBookingInFuture(date, normalizedTime)) {
            throw new BadRequestError('Cannot book in the past. Please select a future date and time.');
        }
        throw new BadRequestError(`Bookings can only be made up to ${BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
    }

    // Validate shop
    const shop = await shopRepository.findByIdWithFields(
        shopId,
        'shopName address isOpen openTime closeTime availableDays breakTimes',
    );
    if (!shop) throw new NotFoundError('Shop');
    assertShopAcceptsDate(shop, date);

    // Validate: No duplicates
    const uniqueServiceIds = new Set(serviceIds);
    if (uniqueServiceIds.size !== serviceIds.length) {
        throw new BadRequestError('Duplicate services are not allowed');
    }

    // Validate: Maximum services limit
    if (serviceIds.length > BOOKING_LIMITS.MAX_SERVICES_PER_BOOKING) {
        throw new BadRequestError(
            `Cannot select more than ${BOOKING_LIMITS.MAX_SERVICES_PER_BOOKING} services per booking`,
        );
    }

    // Validate services
    const services = normalizeBookedServices(
        await serviceRepository.findByIds(
            serviceIds,
            'serviceName finalPrice totalPrice actualPrice offerPrice serviceType shopId duration totalDuration',
        ),
    );
    if (!services.length) throw new NotFoundError('Services');
    if (
        services.length !== serviceIds.length
        || services.some((service) => service.shopId?.toString() !== shopId)
    ) {
        throw new BadRequestError('Selected services must belong to the target shop');
    }

    const totalAmount = sumServicePrices(services);
    const durationMinutes = sumServiceDurations(services);
    assertValidServiceDuration(durationMinutes);
    assertBundleMinimum(services, totalAmount);

    // Validate: Maximum duration limit
    if (durationMinutes > BOOKING_LIMITS.MAX_BOOKING_DURATION_MINUTES) {
        throw new BadRequestError(
            `Total booking duration cannot exceed ${BOOKING_LIMITS.MAX_BOOKING_DURATION_MINUTES / 60} hours`,
        );
    }

    const employeeForScheduling = await loadEmployeeForScheduling(employeeId, shopId);
    const schedulePlan = buildSchedulingPlan({
        shop,
        employee: employeeForScheduling,
        date,
        time: normalizedTime,
        durationMinutes,
    });

    const bookingId = new mongoose.Types.ObjectId();

    // Create booking first, with the same id that will be used in the range lock.
    const booking = await bookingRepository.create(buildBookingPersistencePayload({
        bookingId,
        customerId,
        serviceIds,
        employeeId,
        shopId,
        date,
        totalAmount,
        durationMinutes,
        schedulePlan,
        idempotencyKey,
    }));

    // Claim the exact employee time range atomically using the generated booking ID
    let employee;
    try {
        employee = await employeeRepository.claimTimeRange(
            employeeId,
            {
                bookingId: booking._id,
                date,
                startTime: schedulePlan.startTime,
                endTime: schedulePlan.endTime,
                startMinute: schedulePlan.startMinute,
                endMinute: schedulePlan.endMinute,
                slotLockTimes: schedulePlan.slotLockTimes,
            },
            { shopId },
        );
        if (!employee) throw new BadRequestError('Employee not available at this date/time');
    } catch (error) {
        // If claiming fails, delete the booking we just created
        await bookingRepository.deleteById(booking._id);
        throw error;
    }

    return serializeBookingCreation({
        bookingId: booking._id,
        shopId,
        customerId,
        employee,
        services,
        date,
        time: schedulePlan.startTime,
        endTime: schedulePlan.endTime,
        totalAmount,
        durationMinutes,
        slotLockTimes: schedulePlan.slotLockTimes,
        startMinute: schedulePlan.startMinute,
        endMinute: schedulePlan.endMinute,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        payoutStatus: booking.payoutStatus,
        paymentRequired: true,
    });
};

// ── Customer: get booking details ────────────────────────────────────────

const getBookingDetailsForCustomer = async (bookingId, userId) => {
    const booking = await bookingRepository.findByIdPopulated(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const customer = await customerRepository.findByUserId(userId);
    if (!customer || (booking.customerId._id || booking.customerId).toString() !== customer._id.toString()) {
        throw new ForbiddenError('You can only access your own bookings');
    }

    return buildBookingDetailsPayload(booking);
};

const getBookingDetailsForShopOwner = async (bookingId, ownerId) => {
    const booking = await bookingRepository.findByIdPopulated(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const bookingShopId = booking.shopId?._id || booking.shopId;
    if (bookingShopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only access bookings for your own shop');
    }

    return buildBookingDetailsPayload(booking);
};

export const getBookingDetailsForUser = async (bookingId, user) => {
    if (user.roleType === ROLES.CUSTOMER) {
        return getBookingDetailsForCustomer(bookingId, user._id);
    }

    if (user.roleType === ROLES.BARBER) {
        return getBookingDetailsForShopOwner(bookingId, user._id);
    }

    throw new ForbiddenError('This endpoint is available only to customers and barbers');
};

// ── Customer: cancel booking ─────────────────────────────────────────────

const cancelBookingByCustomer = async (bookingId, userId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const customer = await customerRepository.findByUserId(userId);
    if (!customer || (booking.customerId._id || booking.customerId).toString() !== customer._id.toString()) {
        throw new ForbiddenError('You can only cancel your own bookings');
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) throw new BadRequestError('Booking is already cancelled');
    if (booking.status === BOOKING_STATUS.COMPLETED) throw new BadRequestError('Cannot cancel a completed booking');

    // Check if past
    if (!isBookingInFuture(booking.date.toISOString().split('T')[0], booking.time)) {
        throw new BadRequestError('Appointment has already passed');
    }

    // Check cancellation window
    if (isWithinCancellationWindow(booking.date, booking.time, CANCELLATION_WINDOW_HOURS)) {
        throw new BadRequestError(`Cancellation not allowed within ${CANCELLATION_WINDOW_HOURS} hours of appointment`);
    }

    let cancellationNote = null;

    if (booking.paymentStatus === PAYMENT_STATUS.SUCCESS) {
        if (![PAYOUT_STATUS.NOT_INITIATED, PAYOUT_STATUS.FAILED, PAYOUT_STATUS.REVERSED].includes(booking.payoutStatus)) {
            logger.warn('[BookingService] Cannot auto-refund cancelled booking after payout started', { bookingId });
            cancellationNote = 'Refund window has closed. Please request a manual refund.';
        } else {
            try {
                const { initiateRefund } = await import('./payment.service.js');
                const refundResult = await initiateRefund(bookingId, 'Booking cancelled by customer', null, false);

                logger.info('[BookingService] Auto-refund initiated for cancelled booking', {
                    bookingId,
                    refundAmount: refundResult.refundAmount,
                    deductions: refundResult.deductions,
                });
            } catch (error) {
                logger.error('[BookingService] Auto-refund failed for cancelled booking', {
                    bookingId,
                    error: error.message,
                });
                cancellationNote = 'Refund could not be initiated automatically. Please request a manual refund.';
            }
        }
    }

    const updated = await bookingRepository.updateById(bookingId, {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancellationNote,
    });
    await releaseBookingSlotLock(booking);
    await notificationEvents.notifyBookingCancelled({
        bookingId,
        actorUserId: userId,
        cancelledBy: 'customer',
        reason: cancellationNote,
    });
    return serializeBooking(updated);
};

// ── Customer: schedule changes ───────────────────────────────────────────

// Schedule changes are handled by updateBookingSchedule.

// ── Customer: create booking from source ─────────────────────────────────

const reorderBooking = async (userId, bookingId, newDate, newTime) => {
    const normalizedNewTime = normalizeBookingTime(newTime);
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    const customerId = customer._id;

    const existing = await bookingRepository.findById(bookingId);
    if (!existing) throw new NotFoundError('Original booking');
    if ((existing.customerId._id || existing.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only reorder your own bookings');
    }

    // Prevent same date/time
    if (existing.date.toISOString().split('T')[0] === new Date(newDate).toISOString().split('T')[0] && existing.time === normalizedNewTime) {
        throw new BadRequestError('Please choose a different date or time');
    }

    if (!isValidBookingDateTime(newDate, normalizedNewTime, BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS)) {
        if (!isBookingInFuture(newDate, normalizedNewTime)) {
            throw new BadRequestError('Cannot book for a past date/time');
        }
        throw new BadRequestError(`Bookings can only be made up to ${BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
    }

    const services = normalizeBookedServices(
        await serviceRepository.findByIds(
            existing.serviceIds,
            'serviceName finalPrice totalPrice actualPrice offerPrice serviceType duration totalDuration',
        ),
    );
    const totalAmount = sumServicePrices(services);
    const durationMinutes = sumServiceDurations(services);
    assertValidServiceDuration(durationMinutes);
    assertBundleMinimum(services, totalAmount);
    if (durationMinutes > BOOKING_LIMITS.MAX_BOOKING_DURATION_MINUTES) {
        throw new BadRequestError(
            `Total booking duration cannot exceed ${BOOKING_LIMITS.MAX_BOOKING_DURATION_MINUTES / 60} hours`,
        );
    }

    const shop = await shopRepository.findByIdWithFields(
        existing.shopId,
        'shopName address isOpen openTime closeTime availableDays breakTimes',
    );
    if (!shop) throw new NotFoundError('Shop');
    assertShopAcceptsDate(shop, newDate);
    const employeeForScheduling = await loadEmployeeForScheduling(existing.employeeId, existing.shopId);
    const schedulePlan = buildSchedulingPlan({
        shop,
        employee: employeeForScheduling,
        date: newDate,
        time: normalizedNewTime,
        durationMinutes,
    });

    // Create booking first - MongoDB auto-generates the _id
    const newBooking = await bookingRepository.create(buildBookingPersistencePayload({
        customerId,
        serviceIds: existing.serviceIds,
        employeeId: existing.employeeId,
        shopId: existing.shopId,
        date: newDate,
        totalAmount,
        durationMinutes,
        schedulePlan,
    }));

    // Claim the exact employee time range atomically using the generated booking ID
    let employee;
    try {
        employee = await employeeRepository.claimTimeRange(
            existing.employeeId,
            {
                bookingId: newBooking._id,
                date: newDate,
                startTime: schedulePlan.startTime,
                endTime: schedulePlan.endTime,
                startMinute: schedulePlan.startMinute,
                endMinute: schedulePlan.endMinute,
                slotLockTimes: schedulePlan.slotLockTimes,
            },
            { shopId: existing.shopId },
        );
        if (!employee) throw new BadRequestError('Employee not available');
    } catch (err) {
        // If claiming fails, delete the booking we just created
        await bookingRepository.deleteById(newBooking._id);
        throw err;
    }

    return serializeBookingCreation({
        bookingId: newBooking._id,
        employee,
        services,
        totalAmount,
        durationMinutes,
        time: schedulePlan.startTime,
        endTime: schedulePlan.endTime,
        startMinute: schedulePlan.startMinute,
        endMinute: schedulePlan.endMinute,
        slotLockTimes: schedulePlan.slotLockTimes,
        status: newBooking.status,
        paymentStatus: newBooking.paymentStatus,
        payoutStatus: newBooking.payoutStatus,
        paymentRequired: true,
    });
};

// ── Customer: list bookings ──────────────────────────────────────────────

export const getCustomerBookings = async (userId, query = {}) => {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    const customerId = customer._id;

    if (query.favorite) {
        return getFavoriteBookings(userId, query);
    }

    const filters = {};
    setFilterValue(filters, 'status', query.status);
    setFilterValue(filters, 'paymentStatus', query.paymentStatus);
    applyDateRangeFilter(filters, query);

    const total = await bookingRepository.countAll({ customerId, ...filters });
    const { skip, limit, pagination } = buildPagination(query, total);
    const items = (await bookingRepository.findByCustomer(customerId, filters, { skip, limit }))
        .map(serializeBooking)
        .filter(Boolean);
    return { items, pagination };
};

const loadCustomer = async (userId) => {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    return customer;
};

const assertBookingBelongsToCustomer = async (customer, bookingId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if (toObjectIdString(booking.customerId) !== toObjectIdString(customer._id)) {
        throw new ForbiddenError('You can only favorite your own bookings');
    }

    return undefined;
};

export const getFavoriteBookings = async (userId, query = {}) => {
    const customer = await customerRepository.findFavoriteBookingsByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    return paginateArray((customer.favoriteBookings || []).map(serializeBooking).filter(Boolean), query);
};

export const addFavoriteBooking = async (userId, bookingId) => {
    const customer = await loadCustomer(userId);
    await assertBookingBelongsToCustomer(customer, bookingId);
    await customerRepository.addFavoriteBooking(userId, bookingId);

    return {
        favorite: true,
        bookingId,
    };
};

export const removeFavoriteBooking = async (userId, bookingId) => {
    await loadCustomer(userId);
    await customerRepository.removeFavoriteBooking(userId, bookingId);

    return {
        favorite: false,
        bookingId,
    };
};

// ── Customer: update booking schedule ────────────────────────────────────

export const updateBookingSchedule = async (bookingId, userId, { employeeId, date, time }) => {
    const normalizedTime = normalizeBookingTime(time);
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const customer = await customerRepository.findByUserId(userId);
    if (!customer || (booking.customerId._id || booking.customerId).toString() !== customer._id.toString()) {
        throw new ForbiddenError('You can only update your own bookings');
    }

    assertBookingCanChangeBeforePayment(booking);

    if (!isValidBookingDateTime(date, normalizedTime, BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS)) {
        if (!isBookingInFuture(date, normalizedTime)) {
            throw new BadRequestError('Cannot update to a past date/time');
        }
        throw new BadRequestError(`Bookings can only be made up to ${BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
    }

    const oldDate = booking.date.toISOString().split('T')[0];
    const isSameSlot = booking.employeeId.toString() === employeeId
        && oldDate === new Date(date).toISOString().split('T')[0]
        && booking.time === normalizedTime;

    // Nothing to update if the slot hasn't changed
    if (isSameSlot) return serializeBooking(booking);

    if (!isBookingInFuture(booking.date.toISOString().split('T')[0], booking.time)) {
        throw new BadRequestError('Appointment has already passed');
    }

    if (isWithinCancellationWindow(booking.date, booking.time, CANCELLATION_WINDOW_HOURS)) {
        throw new BadRequestError(`Booking updates are not allowed within ${CANCELLATION_WINDOW_HOURS} hours of appointment`);
    }

    if ((booking.rescheduleCount || 0) >= MAX_RESCHEDULE_COUNT) {
        throw new BadRequestError('You can only reschedule once');
    }

    const durationMinutes = booking.durationMinutes || sumServiceDurations(
        normalizeBookedServices(
            await serviceRepository.findByIds(
                booking.serviceIds,
                'serviceType duration totalDuration',
            ),
        ),
    );
    assertValidServiceDuration(durationMinutes);
    const oldSlotLockTimes = getBookingSlotLockTimes(booking);
    const shop = await shopRepository.findByIdWithFields(
        booking.shopId,
        'shopName address isOpen openTime closeTime availableDays breakTimes',
    );
    if (!shop) throw new NotFoundError('Shop');
    assertShopAcceptsDate(shop, date);
    const employeeForScheduling = await loadEmployeeForScheduling(employeeId, booking.shopId);
    const schedulePlan = buildSchedulingPlan({
        shop,
        employee: employeeForScheduling,
        date,
        time: normalizedTime,
        durationMinutes,
    });

    const oldRangeLock = getBookingTimeRangeLock(booking);
    let employee = null;

    if (
        toObjectIdString(booking.employeeId) === toObjectIdString(employeeId)
        && Number.isFinite(oldRangeLock.startMinute)
        && Number.isFinite(oldRangeLock.endMinute)
    ) {
        employee = await employeeRepository.moveTimeRange(
            booking.employeeId,
            {
                bookingId: booking._id,
                date,
                startTime: schedulePlan.startTime,
                endTime: schedulePlan.endTime,
                startMinute: schedulePlan.startMinute,
                endMinute: schedulePlan.endMinute,
                slotLockTimes: schedulePlan.slotLockTimes,
            },
            { shopId: booking.shopId },
        );
    } else {
        employee = await employeeRepository.claimTimeRange(
            employeeId,
            {
                bookingId: booking._id,
                date,
                startTime: schedulePlan.startTime,
                endTime: schedulePlan.endTime,
                startMinute: schedulePlan.startMinute,
                endMinute: schedulePlan.endMinute,
                slotLockTimes: schedulePlan.slotLockTimes,
            },
            { shopId: booking.shopId },
        );
        if (employee) {
            await releaseBookingSlotLock(booking);
        }
    }

    if (!employee) {
        throw new BadRequestError('Employee not available at this date/time');
    }

    booking.employeeId = employeeId;
    booking.date = date;
    booking.time = schedulePlan.startTime;
    booking.endTime = schedulePlan.endTime;
    booking.startMinute = schedulePlan.startMinute;
    booking.endMinute = schedulePlan.endMinute;
    booking.durationMinutes = durationMinutes;
    booking.slotLockTimes = schedulePlan.slotLockTimes;
    booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
    await booking.save();

    return serializeBooking(booking);
};

// ── Availability ─────────────────────────────────────────────────────────

export const getAvailableSlots = async (employeeId, date, serviceId) => {
    if (!date) throw new BadRequestError('Date query parameter is required');
    if (!serviceId) throw new BadRequestError('ServiceId query parameter is required');

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
        throw new BadRequestError('Date must be in YYYY-MM-DD format');
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (date < todayStr) {
        throw new BadRequestError('Cannot fetch availability for past dates');
    }

    // Check if date is within booking window
    if (!isWithinBookingWindow(date, BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS, now)) {
        throw new BadRequestError(`Availability can only be checked up to ${BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
    }

    // Normalize serviceIds to array
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId];

    // Get employee details
    const employee = await employeeRepository.findByIdLean(
        employeeId,
        'firstName lastName shopId workingHours blockedDates isActive',
    );
    if (!employee) throw new NotFoundError('Employee');
    if (!employee.isActive) throw new BadRequestError('Employee is not active');

    // Get shop details
    const shop = await shopRepository.findByIdWithFields(
        employee.shopId,
        'shopName openTime closeTime isOpen breakTimes',
    );
    if (!shop) throw new NotFoundError('Shop');
    if (!shop.isOpen) throw new BadRequestError('Shop is currently closed');

    // Get service details
    const services = normalizeBookedServices(
        await serviceRepository.findByIds(serviceIds, 'serviceName serviceType shopId duration totalDuration'),
    );
    if (!services.length) throw new NotFoundError('Services');
    if (services.length !== serviceIds.length) {
        throw new BadRequestError('One or more services not found');
    }
    if (services.some((service) => String(service.shopId) !== String(employee.shopId))) {
        throw new BadRequestError('All services must belong to this shop');
    }

    // Calculate total service duration
    const serviceDuration = sumServiceDurations(services);

    if (!serviceDuration || serviceDuration <= 0) {
        throw new BadRequestError('Services must have a valid total duration');
    }

    // Get booked slots for this date
    const bookings = await bookingRepository.findBlockingByEmployeeAndDate(employeeId, date);
    const bookedRanges = normalizeBookedRanges({
        date,
        bookedSlots: bookings.map(toBookingRangeForAvailability),
    });

    // Calculate available slots
    const availability = calculateAvailableSlots({
        date,
        shopHours: {
            openTime: shop.openTime,
            closeTime: shop.closeTime,
        },
        employeeHours: employee.workingHours,
        serviceDuration,
        bookedRanges,
        breakTimes: shop.breakTimes || [],
        blockedDates: employee.blockedDates || [],
        now,
    });

    return {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        date,
        services: services.map((s) => ({
            id: s._id,
            name: s.serviceName,
            duration: getServiceDuration(s),
        })),
        totalDuration: serviceDuration,
        shopHours: {
            openTime: shop.openTime,
            closeTime: shop.closeTime,
        },
        employeeHours: employee.workingHours,
        ...availability,
    };
};

export const getShopAvailability = async (shopId, date, serviceId) => {
    if (!date) throw new BadRequestError('Date query parameter is required');
    if (!serviceId) throw new BadRequestError('ServiceId query parameter is required');

    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
        throw new BadRequestError('Date must be in YYYY-MM-DD format');
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (date < todayStr) {
        throw new BadRequestError('Cannot fetch availability for past dates');
    }

    // Check if date is within booking window
    if (!isWithinBookingWindow(date, BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS, now)) {
        throw new BadRequestError(`Availability can only be checked up to ${BOOKING_LIMITS.MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
    }

    // Normalize serviceIds to array
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId];

    // Get shop details
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');
    if (!shop.isOpen) throw new BadRequestError('Shop is currently closed');

    // Get service details
    const services = normalizeBookedServices(
        await serviceRepository.findByIds(serviceIds, 'serviceName serviceType shopId duration totalDuration'),
    );
    if (!services.length) throw new NotFoundError('Services');
    if (services.length !== serviceIds.length) {
        throw new BadRequestError('One or more services not found');
    }
    if (services.some((service) => String(service.shopId) !== String(shopId))) {
        throw new BadRequestError('All services must belong to this shop');
    }

    // Calculate total service duration
    const serviceDuration = sumServiceDurations(services);

    if (!serviceDuration || serviceDuration <= 0) {
        throw new BadRequestError('Services must have a valid total duration');
    }

    // Get all active employees for this shop
    const employees = await employeeRepository.findByShopId(shopId, {});
    const activeEmployees = employees.filter((emp) => emp.isActive && !emp.deletedAt);

    if (activeEmployees.length === 0) {
        return {
            shopId,
            shopName: shop.shopName,
            date,
            services: services.map((s) => ({
                id: s._id,
                name: s.serviceName,
                duration: getServiceDuration(s),
            })),
            totalDuration: serviceDuration,
            employees: [],
            firstAvailable: null,
        };
    }

    // Calculate availability for each employee from the same exact-range engine used at booking time.
    const employeeAvailability = [];
    let firstAvailable = null;
    const employeeIds = activeEmployees.map((employee) => employee._id);
    const bookingsForDate = await bookingRepository.findBlockingByEmployeeIdsAndDate(employeeIds, date);
    const bookingsByEmployee = new Map();

    for (const booking of bookingsForDate) {
        const employeeKey = toObjectIdString(booking.employeeId);
        const existing = bookingsByEmployee.get(employeeKey) || [];
        existing.push(booking);
        bookingsByEmployee.set(employeeKey, existing);
    }

    for (const employee of activeEmployees) {
        const bookings = bookingsByEmployee.get(toObjectIdString(employee._id)) || [];
        const bookedRanges = normalizeBookedRanges({
            date,
            bookedSlots: bookings.map(toBookingRangeForAvailability),
        });

        // Calculate available slots
        const availableSlots = getAvailableSlotTimes({
            date,
            shopHours: {
                openTime: shop.openTime,
                closeTime: shop.closeTime,
            },
            employeeHours: employee.workingHours,
            serviceDuration,
            bookedRanges,
            breakTimes: shop.breakTimes || [],
            blockedDates: employee.blockedDates || [],
            now,
        });

        if (availableSlots.length > 0) {
            employeeAvailability.push({
                employeeId: employee._id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                photoUrl: employee.photoUrl,
                availableSlots,
                totalAvailable: availableSlots.length,
            });

            // Track first available slot across all employees
            if (!firstAvailable || availableSlots[0] < firstAvailable.time) {
                firstAvailable = {
                    employeeId: employee._id,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    time: availableSlots[0],
                };
            }
        }
    }

    return {
        shopId,
        shopName: shop.shopName,
        date,
        services: services.map((s) => ({
            id: s._id,
            name: s.serviceName,
            duration: getServiceDuration(s),
        })),
        totalDuration: serviceDuration,
        employees: employeeAvailability,
        firstAvailable,
    };
};

// ── Barber-side: booking management ──────────────────────────────────────

export const getBookingsByShop = async (ownerId, query = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    // Build filters
    const filters = {};
    
    setFilterValue(filters, 'status', query.status);
    setFilterValue(filters, 'paymentStatus', query.paymentStatus);
    
    // Employee filter
    if (query.employeeId) {
        // Validate employee belongs to this shop
        const employee = await employeeRepository.findById(query.employeeId);
        if (!employee || employee.shopId.toString() !== shop._id.toString()) {
            throw new BadRequestError('Employee does not belong to this shop');
        }
        filters.employeeId = query.employeeId;
    }
    
    applyDateRangeFilter(filters, query);

    const total = await bookingRepository.countAll({ shopId: shop._id, ...filters });
    const { skip, limit, pagination } = buildPagination(query, total);

    const [bookings, numCustomers, numberOfEmployees] = await Promise.all([
        bookingRepository.findByShopId(shop._id, filters, { skip, limit }),
        bookingRepository.getUniqueCustomerCountForShop(shop._id),
        employeeRepository.countByShopId(shop._id),
    ]);

    return {
        items: bookings.map(serializeBooking).filter(Boolean),
        pagination,
        numberOfEmployees,
        numberOfCustomers: numCustomers,
    };
};

const updateBookingStatusForShopOwner = async (bookingId, status, ownerId) => {
    const allowed = [
        BOOKING_STATUS.COMPLETED,
        BOOKING_STATUS.NO_SHOW,
    ];
    if (!allowed.includes(status)) throw new BadRequestError(`Invalid status. Allowed: ${allowed.join(', ')}`);

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const booking = await bookingRepository.findById(bookingId);
    if (!booking || booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only manage bookings for your own shop');
    }

    // Prevent manual status changes for bookings awaiting confirmation
    if (booking.status === BOOKING_STATUS.AWAITING_CONFIRMATION) {
        throw new BadRequestError('Confirm or cancel bookings awaiting confirmation before closing them');
    }

    if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.NO_SHOW].includes(status) && booking.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
        throw new BadRequestError('Cannot close a booking before payment succeeds');
    }

    const updated = await bookingRepository.updateById(bookingId, {
        status,
        completedAt: status === BOOKING_STATUS.COMPLETED ? new Date() : booking.completedAt,
        noShowAt: status === BOOKING_STATUS.NO_SHOW ? new Date() : booking.noShowAt,
        payoutStatus: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.NO_SHOW].includes(status)
            ? (booking.payoutStatus || PAYOUT_STATUS.NOT_INITIATED)
            : booking.payoutStatus,
    });
    if (!updated) throw new NotFoundError('Booking');

    if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.NO_SHOW].includes(status)) {
        await releaseBookingSlotLock(booking);
    }

    await notificationEvents.notifyBookingStatusChanged({
        bookingId,
        status,
        actorUserId: ownerId,
    });

    return serializeBooking(updated);
};

export const updateBookingStatus = async (bookingId, user, status) => {
    if (user.roleType === ROLES.CUSTOMER) {
        if (status !== BOOKING_STATUS.CANCELLED) {
            throw new ForbiddenError('Customers can only cancel bookings through this field');
        }
        return cancelBookingByCustomer(bookingId, user._id);
    }

    if (user.roleType === ROLES.BARBER) {
        if (status === BOOKING_STATUS.CANCELLED) {
            return cancelBookingByBarber(bookingId, user._id);
        }
        if (status === BOOKING_STATUS.CONFIRMED) {
            return confirmBookingByBarber(bookingId, user._id);
        }
        return updateBookingStatusForShopOwner(bookingId, status, user._id);
    }

    throw new ForbiddenError('This endpoint is available only to customers and barbers');
};

const buildBookingSummaryAnalytics = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const [total, pending, awaitingConfirmation, completed, cancelled] = await Promise.all([
        bookingRepository.countAll({ shopId: shop._id }),
        bookingRepository.countByStatusForShop(shop._id, 'pending'),
        bookingRepository.countByStatusForShop(shop._id, 'awaiting_confirmation'),
        bookingRepository.countByStatusForShop(shop._id, 'completed'),
        bookingRepository.countByStatusForShop(shop._id, 'cancelled'),
    ]);
    return { total, pending, awaitingConfirmation, completed, cancelled };
};

const buildMilestoneAnalytics = async (ownerId, query = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const period = query.month && query.year
        ? { month: query.month, year: query.year }
        : getDefaultProgressPeriod();
    const { startDate, endDate } = getUtcMonthRange(period.month, period.year);
    const completedBookings = await bookingRepository.countCompletedForShopInDateRange(
        shop._id,
        startDate,
        endDate,
    );

    const progressMax = BOOKING_MILESTONE_TARGETS[BOOKING_MILESTONE_TARGETS.length - 1] || 0;
    const progressValue = progressMax > 0
        ? Math.min(completedBookings, progressMax)
        : completedBookings;
    const milestones = BOOKING_MILESTONE_TARGETS.map((targetBookings, index) => ({
        targetBookings,
        label: getTargetLabel(index),
        isCompleted: completedBookings >= targetBookings,
        remainingBookings: Math.max(targetBookings - completedBookings, 0),
    }));
    const currentMilestone = milestones.filter((milestone) => milestone.isCompleted).at(-1) || null;
    const nextMilestone = milestones.find((milestone) => !milestone.isCompleted) || null;

    return {
        period: {
            ...period,
            label: MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(period.year, period.month - 1, 1))),
        },
        status: 'active',
        completedBookings,
        progress: {
            min: 0,
            max: progressMax,
            value: progressValue,
            percentage: progressMax > 0
                ? Number(((progressValue / progressMax) * 100).toFixed(2))
                : 0,
        },
        milestones,
        currentMilestone: currentMilestone ? {
            targetBookings: currentMilestone.targetBookings,
            label: currentMilestone.label,
            statusText: `${currentMilestone.label} completed`,
        } : null,
        nextMilestone: nextMilestone ? {
            targetBookings: nextMilestone.targetBookings,
            label: nextMilestone.label,
            remainingBookings: nextMilestone.remainingBookings,
            rewardMessage: `Just ${nextMilestone.remainingBookings} more bookings to reach your next reward!`,
        } : null,
    };
};

export const getBookingAnalytics = async (ownerId, query = {}) => {
    const [summary, milestones, today, queue] = await Promise.all([
        buildBookingSummaryAnalytics(ownerId),
        buildMilestoneAnalytics(ownerId, query),
        buildTodayAnalytics(ownerId),
        buildQueueAnalytics(ownerId),
    ]);

    return {
        summary,
        milestones,
        today,
        queue,
    };
};

// Status-filtered booking lists are served by getBookingsByShop(query).

// ── Barber: Get Pending Confirmations ────────────────────────────────────

// Pending confirmations are served by getBookingsByShop({ status, paymentStatus }).

// ── Barber: Confirm Booking ──────────────────────────────────────────────

const confirmBookingByBarber = async (bookingId, ownerId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    if (booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only confirm bookings for your own shop');
    }

    if (booking.status !== BOOKING_STATUS.AWAITING_CONFIRMATION) {
        throw new BadRequestError('Booking is not awaiting confirmation');
    }

    if (booking.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
        throw new BadRequestError('Payment must be successful before confirming booking');
    }

    const updated = await bookingRepository.updateById(bookingId, {
        status: BOOKING_STATUS.CONFIRMED,
        barberConfirmedAt: new Date(),
    });

    logger.info('[BookingService] Booking confirmed by barber', {
        bookingId,
        shopId: shop._id,
        ownerId,
    });

    await notificationEvents.notifyBookingConfirmed({
        bookingId,
        actorUserId: ownerId,
    });

    return serializeBooking(updated);
};

// ── Barber: Cancel Booking (Paid or Unpaid) ──────────────────────────────

const cancelBookingByBarber = async (bookingId, ownerId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    if (booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only cancel bookings for your own shop');
    }

    // Handle PAID bookings
    if (booking.paymentStatus === PAYMENT_STATUS.SUCCESS) {
        // Only allow cancellation if awaiting confirmation
        if (booking.status !== BOOKING_STATUS.AWAITING_CONFIRMATION) {
            throw new BadRequestError('Can only cancel paid bookings that are awaiting confirmation');
        }

        // Initiate FULL refund (no deductions)
        try {
            const { initiateRefund } = await import('./payment.service.js');
            await initiateRefund(bookingId, 'Barber cancelled booking', null, true);

            logger.info('[BookingService] Full refund initiated for barber-cancelled booking', {
                bookingId,
                shopId: shop._id,
                ownerId,
            });
        } catch (error) {
            logger.error('[BookingService] Refund failed for barber-cancelled booking', {
                bookingId,
                error: error.message,
            });
            // Continue with cancellation even if refund fails
        }

        const updated = await bookingRepository.updateById(bookingId, {
            status: BOOKING_STATUS.CANCELLED,
            barberCancelledAt: new Date(),
            cancelledAt: new Date(),
        });
        await releaseBookingSlotLock(booking);

        logger.info('[BookingService] Paid booking cancelled by barber', {
            bookingId,
            shopId: shop._id,
            ownerId,
        });

        await notificationEvents.notifyBookingCancelled({
            bookingId,
            actorUserId: ownerId,
            cancelledBy: 'barber',
        });

        return serializeBooking(updated);
    }

    // Handle UNPAID bookings - just delete
    await bookingRepository.deleteById(bookingId);
    await releaseBookingSlotLock(booking);

    logger.info('[BookingService] Unpaid booking deleted by barber', {
        bookingId,
        shopId: shop._id,
        ownerId,
    });

    return { message: 'Booking deleted and time slot freed' };
};

// ── System: Auto-Cancel Awaiting Bookings ────────────────────────────────

export const autoCancelAwaitingBookings = async () => {
    const CONFIRMATION_TIMEOUT_HOURS = 24;
    const cutoffTime = new Date(Date.now() - CONFIRMATION_TIMEOUT_HOURS * 60 * 60 * 1000);

    logger.info('[BookingService] Starting auto-cancel job', {
        cutoffTime,
        timeoutHours: CONFIRMATION_TIMEOUT_HOURS,
    });

    // Find bookings awaiting confirmation for more than 24 hours
    const expiredBookings = await bookingRepository.findAwaitingConfirmationExpired(cutoffTime, 100);

    if (expiredBookings.length === 0) {
        logger.info('[BookingService] No bookings to auto-cancel');
        return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info('[BookingService] Found bookings to auto-cancel', {
        count: expiredBookings.length,
    });

    let succeeded = 0;
    let failed = 0;

    for (const booking of expiredBookings) {
        try {
            // Double-check status (prevent race conditions)
            const currentBooking = await bookingRepository.findById(booking._id);
            if (!currentBooking || currentBooking.status !== BOOKING_STATUS.AWAITING_CONFIRMATION) {
                logger.warn('[BookingService] Booking status changed, skipping auto-cancel', {
                    bookingId: booking._id,
                    currentStatus: currentBooking?.status,
                });
                continue;
            }

            // Initiate FULL refund (no deductions for auto-cancel)
            try {
                const { initiateRefund } = await import('./payment.service.js');
                await initiateRefund(
                    booking._id,
                    'Booking auto-cancelled - Barber did not respond within 24 hours',
                    null,
                    true, // isBarberCancellation = true (full refund)
                );

                logger.info('[BookingService] Full refund initiated for auto-cancelled booking', {
                    bookingId: booking._id,
                    shopId: booking.shopId,
                });
            } catch (error) {
                logger.error('[BookingService] Refund failed for auto-cancelled booking', {
                    bookingId: booking._id,
                    error: error.message,
                });
                // Continue with cancellation even if refund fails
            }

            // Update booking status
            await bookingRepository.updateById(booking._id, {
                status: BOOKING_STATUS.CANCELLED,
                autoCancelledAt: new Date(),
                cancelledAt: new Date(),
            });
            await releaseBookingSlotLock(booking);
            await notificationEvents.notifyBookingAutoCancelled({
                bookingId: booking._id,
            });

            // Update shop stats (increment missed confirmation count)
            await shopRepository.updateById(booking.shopId, {
                $inc: { missedConfirmationCount: 1 },
                lastMissedConfirmationAt: new Date(),
            });

            logger.info('[BookingService] Booking auto-cancelled successfully', {
                bookingId: booking._id,
                shopId: booking.shopId,
                customerId: booking.customerId,
            });

            succeeded++;
        } catch (error) {
            logger.error('[BookingService] Failed to auto-cancel booking', {
                bookingId: booking._id,
                error: error.message,
                stack: error.stack,
            });
            failed++;
        }
    }

    const summary = {
        processed: expiredBookings.length,
        succeeded,
        failed,
    };

    logger.info('[BookingService] Auto-cancel job completed', summary);

    return summary;
};

// Resource analytics

/**
 * Get today's pulse metrics - Executive Performance
 * Shows real-time occupancy and booking status breakdown
 */
const buildTodayAnalytics = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all bookings for today
    const todaysBookings = await bookingRepository.findByShopId(
        shop._id,
        {
            date: { $gte: today, $lt: tomorrow },
        },
        {},
    );

    // Calculate status counts
    const statusCounts = {
        all: todaysBookings.length,
        pending: 0,
        done: 0,
        cancelled: 0,
    };

    todaysBookings.forEach((booking) => {
        if (booking.status === BOOKING_STATUS.CANCELLED) {
            statusCounts.cancelled++;
        } else if (
            booking.status === BOOKING_STATUS.COMPLETED ||
            booking.status === BOOKING_STATUS.NO_SHOW
        ) {
            statusCounts.done++;
        } else {
            // PENDING, AWAITING_CONFIRMATION, CONFIRMED
            statusCounts.pending++;
        }
    });

    // Calculate occupancy
    // Get all active employees
    const employees = await employeeRepository.findByShopId(shop._id, {});
    const activeEmployees = employees.filter((emp) => emp.isActive && !emp.deletedAt);

    // Calculate exact minute capacity from shop hours, employee hours, and breaks.
    const todayStr = toDateOnlyString(today);
    const totalCapacity = activeEmployees.reduce((sum, employee) => {
        const capacity = calculateAvailableSlots({
            date: todayStr,
            shopHours: { openTime: shop.openTime, closeTime: shop.closeTime },
            employeeHours: employee.workingHours,
            serviceDuration: 1,
            breakTimes: shop.breakTimes || [],
            blockedDates: employee.blockedDates || [],
            now: new Date('1970-01-01T00:00:00.000Z'),
        });
        return sum + capacity.availableWindows.reduce(
            (windowSum, window) => windowSum + (window.endMinute - window.startMinute),
            0,
        );
    }, 0);
    const bookedSlots = todaysBookings.filter(
        (b) => b.status !== BOOKING_STATUS.CANCELLED,
    ).reduce((sum, booking) => {
        const exactDuration = Number(booking.endMinute) - Number(booking.startMinute);
        const duration = Number.isFinite(exactDuration) && exactDuration > 0
            ? exactDuration
            : Number(booking.durationMinutes) || 0;
        return sum + duration;
    }, 0);

    return {
        occupancy: {
            booked: bookedSlots,
            total: totalCapacity,
            percentage: totalCapacity > 0 ? Math.round((bookedSlots / totalCapacity) * 100) : 0,
            unit: 'minutes',
        },
        statusBreakdown: [
            {
                label: 'All',
                count: statusCounts.all,
                color: 'default',
            },
            {
                label: 'Pending',
                count: statusCounts.pending,
                color: 'warning',
            },
            {
                label: 'Done',
                count: statusCounts.done,
                color: 'success',
            },
            {
                label: 'Cancelled',
                count: statusCounts.cancelled,
                color: 'muted',
            },
        ],
    };
};

/**
 * Get today's queue - active and upcoming appointments
 * Shows appointments organized by status (active/upcoming)
 */
const buildQueueAnalytics = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's bookings
    const todaysBookings = await bookingRepository.findByShopId(
        shop._id,
        {
            date: { $gte: today, $lt: tomorrow },
            status: { $nin: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.NO_SHOW] },
        },
        {},
    );

    // Parse current time in minutes for comparison
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Helper to parse time string to minutes
    const parseTimeToMinutes = (timeStr) => {
        const normalized = toTwentyFourHourTime(timeStr);
        if (!normalized) return null;
        const [hours, minutes] = normalized.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Separate active and upcoming
    const activeBookings = [];
    const upcomingBookings = [];

    todaysBookings.forEach((booking) => {
        const bookingMinutes = parseTimeToMinutes(booking.time);
        if (bookingMinutes === null) return;

        // Calculate time difference (negative = past, positive = future)
        const timeDiff = bookingMinutes - currentMinutes;

        // Active: bookings happening now or in the past (not yet completed)
        // Upcoming: bookings more than 30 minutes in the future
        if (timeDiff <= 30) {
            // Booking is now or in the past, or within 30 minutes in the future
            activeBookings.push(booking);
        } else {
            // Booking is more than 30 minutes in the future
            upcomingBookings.push(booking);
        }
    });

    // Sort by time
    const sortByTime = (a, b) => {
        const aMinutes = parseTimeToMinutes(a.time);
        const bMinutes = parseTimeToMinutes(b.time);
        return aMinutes - bMinutes;
    };

    activeBookings.sort(sortByTime);
    upcomingBookings.sort(sortByTime);

    // Format queue items
    const formatQueueItem = (booking) => ({
        id: toObjectIdString(booking._id),
        customer: {
            name: `${booking.customerId?.firstName || ''} ${booking.customerId?.lastName || ''}`.trim(),
        },
        employee: {
            name: `${booking.employeeId?.firstName || ''} ${booking.employeeId?.lastName || ''}`.trim(),
        },
        time: booking.time,
        status: booking.status,
        services: booking.serviceIds?.map((s) => s.serviceName) || [],
    });

    return {
        active: {
            count: activeBookings.length,
            items: activeBookings.map(formatQueueItem),
        },
        upcoming: {
            count: upcomingBookings.length,
            items: upcomingBookings.map(formatQueueItem),
        },
    };
};

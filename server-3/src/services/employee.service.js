import employeeRepository from '../repositories/employee.repository.js';
import bookingRepository from '../repositories/booking.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import logger from '../utils/logger.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/api-error.js';
import cloudinary from '../config/cloudinary.config.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { parseTimeToMinutes } from '../utils/time.utils.js';
import { normalizeShopSchedule } from '../utils/shop-schedule.utils.js';
import { serializeEmployee, serializeEmployees } from '../serializers/employee.serializer.js';
import { toIdString } from '../serializers/core.serializer.js';
import { toDateOnlyString } from '../utils/slot-lock.utils.js';
import notificationEvents from './notification-events.service.js';

/**
 * Employee service â€” CRUD operations for shop employees.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const parseJsonIfString = (value, fieldName) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        throw new BadRequestError(`${fieldName} must be valid JSON`);
    }
};

const normalizeDateOfBirth = (value) => {
    if (value === undefined) return undefined;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('dateOfBirth must be a valid date');
    }

    if (date > new Date()) {
        throw new BadRequestError('dateOfBirth cannot be in the future');
    }

    return date;
};

const normalizeWorkingHours = (value) => {
    if (value === undefined) return undefined;

    const parsed = parseJsonIfString(value, 'workingHours');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestError('workingHours must be an object');
    }

    const start = String(parsed.start ?? '').trim();
    const end = String(parsed.end ?? '').trim();

    if (!start || !end) {
        throw new BadRequestError('workingHours must include start and end');
    }

    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        throw new BadRequestError('workingHours must use HH:MM 24-hour format');
    }

    if (start >= end) {
        throw new BadRequestError('workingHours.start must be earlier than workingHours.end');
    }

    return { start, end };
};

const normalizeBlockedDates = (value) => {
    if (value === undefined) return undefined;

    let parsed = value;
    if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (!trimmed) return [];

        try {
            parsed = JSON.parse(trimmed);
        } catch {
            throw new BadRequestError('blockedDates must be a valid JSON array');
        }
    }

    const values = Array.isArray(parsed) ? parsed : [parsed];
    const seen = new Set();

    return values.reduce((dates, entry) => {
        const raw = entry instanceof Date
            ? entry.toISOString().slice(0, 10)
            : String(entry ?? '').trim();

        if (!DATE_ONLY_PATTERN.test(raw)) {
            throw new BadRequestError('blockedDates must use YYYY-MM-DD format');
        }

        if (seen.has(raw)) return dates;
        seen.add(raw);
        dates.push(new Date(`${raw}T00:00:00.000Z`));
        return dates;
    }, []);
};

const normalizeAvailabilityDates = (dates) => {
    const normalized = normalizeBlockedDates(dates);
    if (!Array.isArray(normalized) || normalized.length === 0) {
        throw new BadRequestError('dates must include at least one date');
    }

    return normalized.map(toDateOnlyString);
};

const employeeDisplayName = (employee) => [employee?.firstName, employee?.lastName]
    .filter(Boolean)
    .join(' ')
    || 'Employee';

const customerDisplayName = (customer) => [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(' ')
    || 'Customer';

const blockedDateStrings = (employee) => (
    Array.isArray(employee?.blockedDates)
        ? employee.blockedDates.map(toDateOnlyString).filter(Boolean).sort()
        : []
);

const getNormalizedShopWorkingHours = (shop) => {
    const scheduleResult = normalizeShopSchedule({
        openTime: shop?.openTime,
        closeTime: shop?.closeTime,
        breakTimes: [],
    });

    if (scheduleResult.error) {
        throw new BadRequestError(`Shop hours are invalid. ${scheduleResult.error}`);
    }

    return {
        start: scheduleResult.value.openTime,
        end: scheduleResult.value.closeTime,
    };
};

const assertWorkingHoursWithinShopHours = (workingHours, shop) => {
    if (!workingHours) return;

    const employeeStartMinutes = parseTimeToMinutes(workingHours.start);
    const employeeEndMinutes = parseTimeToMinutes(workingHours.end);
    const shopWorkingHours = getNormalizedShopWorkingHours(shop);
    const shopStartMinutes = parseTimeToMinutes(shopWorkingHours.start);
    const shopEndMinutes = parseTimeToMinutes(shopWorkingHours.end);

    if (
        employeeStartMinutes === null
        || employeeEndMinutes === null
        || employeeStartMinutes < shopStartMinutes
        || employeeEndMinutes > shopEndMinutes
    ) {
        throw new BadRequestError('Employee working hours must stay within shop hours');
    }
};

const normalizeEmployeePayload = (data = {}, shop = null) => {
    const normalized = { ...data };

    if (typeof normalized.phoneNumber === 'string') {
        normalized.phoneNumber = normalized.phoneNumber.trim();
    }

    if (normalized.dateOfBirth !== undefined) {
        normalized.dateOfBirth = normalizeDateOfBirth(normalized.dateOfBirth);
    }

    if (normalized.workingHours !== undefined) {
        normalized.workingHours = normalizeWorkingHours(normalized.workingHours);
    }

    if (normalized.blockedDates !== undefined) {
        normalized.blockedDates = normalizeBlockedDates(normalized.blockedDates);
    }

    if (shop) {
        assertWorkingHoursWithinShopHours(normalized.workingHours, shop);
    }

    return normalized;
};

const destroyCloudinaryAsset = async (publicId, context) => {
    if (!publicId) return;

    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        logger.warn('Employee image cleanup failed', {
            publicId,
            context,
            error: err.message,
        });
    }
};

const rethrowDuplicateEmployeeWrite = async (error, uploadedCloudinaryId) => {
    if (uploadedCloudinaryId) {
        await destroyCloudinaryAsset(uploadedCloudinaryId, 'duplicate-write');
    }

    if (error?.code === 11000) {
        throw new ConflictError('Employee with this phone number already exists');
    }

    throw error;
};

const buildDeletedPhoneNumber = (employeeId) => `deleted-${employeeId}-${Date.now()}`;

export const addEmployee = async (ownerId, data, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const normalizedData = normalizeEmployeePayload(data, shop);

    const existing = await employeeRepository.findByShopIdAndPhone(shop._id, normalizedData.phoneNumber);
    if (existing) throw new ConflictError('Employee with this phone number already exists');

    const employeeData = {
        shopId: shop._id,
        firstName: normalizedData.firstName,
        lastName: normalizedData.lastName,
        phoneNumber: normalizedData.phoneNumber,
        gender: normalizedData.gender,
        dateOfBirth: normalizedData.dateOfBirth,
        workingHours: normalizedData.workingHours || getNormalizedShopWorkingHours(shop),
        blockedDates: normalizedData.blockedDates || [],
    };

    if (file) {
        employeeData.photoUrl = file.path;
        employeeData.cloudinaryId = file.public_id || file.filename;
    }

    try {
        const created = await employeeRepository.create(employeeData);
        return serializeEmployee(created);
    } catch (error) {
        await rethrowDuplicateEmployeeWrite(error, employeeData.cloudinaryId);
    }
};

export const getEmployees = async (ownerId, query = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const total = await employeeRepository.countByShopId(shop._id);
    const { skip, limit, pagination } = buildPagination(query, total);

    const items = serializeEmployees(await employeeRepository.findByShopId(shop._id, { skip, limit }));
    return { items, pagination };
};

export const getEmployeeById = async (ownerId, employeeId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || String(employee.shopId) !== String(shop._id)) {
        throw new NotFoundError('Employee');
    }

    // Get today's bookings for this employee
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysBookings = await bookingRepository.findByEmployeeIds(
        [employee._id],
        {
            date: { $gte: today, $lt: tomorrow },
            status: { $nin: ['cancelled'] },
        },
        {},
    );

    // Calculate today's statistics
    const completedToday = todaysBookings.filter(
        (b) => b.status === 'completed' || b.status === 'no-show',
    ).length;
    const pendingToday = todaysBookings.filter(
        (b) => b.status === 'pending' || b.status === 'awaiting_confirmation' || b.status === 'confirmed',
    ).length;

    // Get total completed bookings (all time)
    const allBookings = await bookingRepository.findByEmployeeIds(
        [employee._id],
        { status: { $in: ['completed', 'no-show'] } },
        {},
    );

    // Calculate total earnings
    const totalEarnings = allBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    // Get this month's bookings
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const monthBookings = await bookingRepository.findByEmployeeIds(
        [employee._id],
        {
            date: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $in: ['completed', 'no-show'] },
        },
        {},
    );

    const monthlyEarnings = monthBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    // Get upcoming bookings (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingBookings = await bookingRepository.findByEmployeeIds(
        [employee._id],
        {
            date: { $gte: today, $lte: nextWeek },
            status: { $nin: ['cancelled', 'completed', 'no-show'] },
        },
        {},
    );

    return {
        employee: serializeEmployee(employee),
        statistics: {
            today: {
                total: todaysBookings.length,
                completed: completedToday,
                pending: pendingToday,
            },
            allTime: {
                totalBookings: allBookings.length,
                totalEarnings,
            },
            thisMonth: {
                totalBookings: monthBookings.length,
                totalEarnings: monthlyEarnings,
            },
            upcoming: {
                count: upcomingBookings.length,
                bookings: upcomingBookings.slice(0, 5).map((b) => ({
                    id: toIdString(b._id),
                    date: b.date,
                    time: b.time,
                    customer: {
                        name: `${b.customerId?.firstName || ''} ${b.customerId?.lastName || ''}`.trim(),
                    },
                    services: b.serviceIds?.map((s) => s.serviceName) || [],
                    status: b.status,
                })),
            },
        },
    };
};

export const updateEmployee = async (ownerId, employeeId, data, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || String(employee.shopId) !== String(shop._id)) {
        throw new NotFoundError('Employee');
    }

    const normalizedData = normalizeEmployeePayload(data, shop);
    const updateData = {};

    for (const field of ['firstName', 'lastName', 'phoneNumber', 'gender', 'dateOfBirth', 'workingHours', 'blockedDates', 'isActive']) {
        if (normalizedData[field] !== undefined) {
            updateData[field] = normalizedData[field];
        }
    }

    if (file) {
        updateData.photoUrl = file.path;
        updateData.cloudinaryId = file.public_id || file.filename;
    }

    if (Object.keys(updateData).length === 0) {
        throw new BadRequestError('No valid fields provided for update');
    }

    if (updateData.phoneNumber && updateData.phoneNumber !== employee.phoneNumber) {
        const existing = await employeeRepository.findByShopIdAndPhone(shop._id, updateData.phoneNumber);
        if (existing && String(existing._id) !== String(employeeId)) {
            if (updateData.cloudinaryId) {
                await destroyCloudinaryAsset(updateData.cloudinaryId, 'duplicate-phone');
            }
            throw new ConflictError('Employee with this phone number already exists');
        }
    }

    let updated;
    try {
        updated = await employeeRepository.updateById(employeeId, shop._id, updateData);
    } catch (err) {
        await rethrowDuplicateEmployeeWrite(err, updateData.cloudinaryId);
    }

    if (!updated) throw new NotFoundError('Employee');

    if (updateData.cloudinaryId && employee.cloudinaryId && employee.cloudinaryId !== updateData.cloudinaryId) {
        await destroyCloudinaryAsset(employee.cloudinaryId, 'replace-photo');
    }

    return serializeEmployee(updated);
};

export const updateEmployeeAvailability = async (ownerId, employeeId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || String(employee.shopId) !== String(shop._id)) {
        throw new NotFoundError('Employee');
    }

    const requestedDates = normalizeAvailabilityDates(data?.dates);
    const available = data?.available === true;
    const existingBlockedDates = new Set(blockedDateStrings(employee));
    const datesToChange = requestedDates.filter((date) => (
        available ? existingBlockedDates.has(date) : !existingBlockedDates.has(date)
    ));

    const updated = datesToChange.length > 0
        ? await employeeRepository.updateAvailabilityDates(employeeId, shop._id, datesToChange, available)
        : employee;
    if (!updated) throw new NotFoundError('Employee');

    let affectedBookings = [];
    let notificationsSent = [];

    if (!available && datesToChange.length > 0) {
        affectedBookings = await bookingRepository.findActiveByEmployeeAndDates(employeeId, datesToChange);
        const employeeName = employeeDisplayName(updated);

        notificationsSent = await Promise.all(affectedBookings.map(async (booking) => {
            const bookingDate = toDateOnlyString(booking.date);
            const notificationResult = await notificationEvents.notifyBookingEmployeeUnavailable({
                bookingId: toIdString(booking._id),
                employeeId: toIdString(updated._id),
                employeeName,
                date: bookingDate,
            });

            return {
                bookingId: toIdString(booking._id),
                customerName: customerDisplayName(booking.customerId),
                date: bookingDate,
                time: booking.time,
                notificationStatus: notificationResult?.skipped ? 'skipped' : 'sent',
            };
        }));
    }

    const customersNotified = notificationsSent.filter(
        (notification) => notification.notificationStatus === 'sent',
    ).length;

    logger.info('Employee availability dates updated', {
        employeeId,
        shopId: shop._id,
        ownerId,
        available,
        dates: datesToChange,
        affectedBookings: affectedBookings.length,
        customersNotified,
    });

    return {
        employeeId: toIdString(updated._id),
        name: employeeDisplayName(updated),
        datesBlocked: available ? 0 : datesToChange.length,
        datesUnblocked: available ? datesToChange.length : 0,
        blockedDates: blockedDateStrings(updated),
        affectedBookings: affectedBookings.length,
        customersNotified,
        notificationsSent,
    };
};

export const deleteEmployee = async (ownerId, employeeId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || String(employee.shopId) !== String(shop._id)) {
        throw new NotFoundError('Employee');
    }

    const hasActiveBookings = await bookingRepository.hasActiveBookingsForEmployee(shop._id, employeeId);
    if (hasActiveBookings) {
        throw new BadRequestError('Cannot delete employee with upcoming or pending bookings');
    }

    const deleted = await employeeRepository.softDelete(
        employeeId,
        shop._id,
        buildDeletedPhoneNumber(employee._id),
    );
    if (!deleted) throw new NotFoundError('Employee');

    if (employee.cloudinaryId) {
        await destroyCloudinaryAsset(employee.cloudinaryId, 'delete-employee');
    }

    return { message: 'Employee deleted successfully' };
};

// Resource analytics

/**
 * Get staff availability and progress
 * Shows each employee's daily appointment progress
 */
export const getStaffAvailability = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active employees
    const employees = await employeeRepository.findByShopId(shop._id, {});
    const activeEmployees = employees.filter((emp) => emp.isActive && !emp.deletedAt);

    // Get today's bookings for each employee
    const staffAvailability = await Promise.all(
        activeEmployees.map(async (employee) => {
            const employeeBookings = await bookingRepository.findByEmployeeIds(
                [employee._id],
                {
                    date: { $gte: today, $lt: tomorrow },
                    status: { $nin: ['cancelled'] },
                },
                {},
            );

            const completedCount = employeeBookings.filter(
                (b) =>
                    b.status === 'completed' ||
                    b.status === 'no-show',
            ).length;

            const totalCount = employeeBookings.length;
            const remainingCount = totalCount - completedCount;

            // Calculate progress percentage
            const progressPercentage =
                totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return {
                id: toIdString(employee._id),
                name: `${employee.firstName} ${employee.lastName}`,
                photoUrl: employee.photoUrl,
                progress: {
                    completed: completedCount,
                    total: totalCount,
                    remaining: remainingCount,
                    percentage: progressPercentage,
                },
            };
        }),
    );

    return {
        staff: staffAvailability,
        totalStaff: activeEmployees.length,
    };
};

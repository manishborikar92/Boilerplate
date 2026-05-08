import Employee from '../models/employee.model.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class EmployeeRepository {
    async create(data) {
        return Employee.create(data);
    }

    async findById(id) {
        return Employee.findById(id);
    }

    async findByShopId(shopId, options = {}) {
        const query = Employee.find({ shopId });
        
        if (options.skip !== undefined) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        return query.sort({ createdAt: -1 }).lean();
    }

    async countByShopId(shopId) {
        return Employee.countDocuments({ shopId });
    }

    async findByShopIdAndPhone(shopId, phoneNumber) {
        return Employee.findOne({ shopId, phoneNumber });
    }

    async updateById(id, shopId, data) {
        return Employee.findOneAndUpdate(
            { _id: id, shopId },
            { $set: data },
            { returnDocument: 'after', runValidators: true },
        );
    }

    async updateAvailabilityDates(id, shopId, dates, available) {
        const normalizedDates = [...new Set(dates)]
            .filter(Boolean)
            .map((date) => new Date(`${date}T00:00:00.000Z`));

        const update = available
            ? { $pull: { blockedDates: { $in: normalizedDates } } }
            : { $addToSet: { blockedDates: { $each: normalizedDates } } };

        return Employee.findOneAndUpdate(
            { _id: id, shopId },
            update,
            { returnDocument: 'after', runValidators: true },
        );
    }

    /**
     * Atomically claim every slot marker for a booking.
     * Returns null if any marker is already taken or the date is blocked.
     */
    async claimSlots(employeeId, date, times, options = {}) {
        const slotTimes = [...new Set(times)].filter(Boolean);
        const queryOptions = { returnDocument: 'after' };
        if (options.session) queryOptions.session = options.session;

        const query = {
            _id: employeeId,
            isActive: true,
            deletedAt: null,
            bookedSlots: { $not: { $elemMatch: { date, time: { $in: slotTimes } } } },
            blockedDates: { $ne: new Date(date) },
        };
        if (options.shopId) query.shopId = options.shopId;

        return Employee.findOneAndUpdate(
            trustQueryOperators(query),
            {
                $push: {
                    bookedSlots: {
                        $each: slotTimes.map((time) => ({ date, time })),
                    },
                },
            },
            queryOptions,
        ).select('firstName lastName photoUrl');
    }

    /**
     * Atomically claim an exact half-open time range: [startMinute, endMinute).
     *
     * This is the primary booking lock. It prevents overlaps without rounding
     * service durations up to coarse slot markers.
     */
    async claimTimeRange(employeeId, range, options = {}) {
        const queryOptions = { returnDocument: 'after', runValidators: true };
        if (options.session) queryOptions.session = options.session;

        const {
            bookingId,
            date,
            startTime,
            endTime,
            startMinute,
            endMinute,
            slotLockTimes = [],
        } = range;
        const legacySlotTimes = [...new Set(slotLockTimes)].filter(Boolean);

        const query = {
            _id: employeeId,
            isActive: true,
            deletedAt: null,
            blockedDates: { $ne: new Date(date) },
            $and: [
                {
                    bookedRanges: {
                        $not: {
                            $elemMatch: {
                                date,
                                startMinute: { $lt: endMinute },
                                endMinute: { $gt: startMinute },
                            },
                        },
                    },
                },
            ],
        };
        if (options.shopId) query.shopId = options.shopId;

        return Employee.findOneAndUpdate(
            trustQueryOperators(query),
            {
                $push: {
                    bookedRanges: {
                        bookingId,
                        date,
                        startTime,
                        endTime,
                        startMinute,
                        endMinute,
                    },
                    ...(legacySlotTimes.length > 0 && {
                        bookedSlots: {
                            $each: legacySlotTimes.map((time) => ({ date, time })),
                        },
                    }),
                },
            },
            queryOptions,
        ).select('firstName lastName photoUrl workingHours');
    }

    async moveTimeRange(employeeId, range, options = {}) {
        const queryOptions = { returnDocument: 'after', runValidators: true };
        if (options.session) queryOptions.session = options.session;

        const {
            bookingId,
            date,
            startTime,
            endTime,
            startMinute,
            endMinute,
        } = range;
        const query = {
            _id: employeeId,
            isActive: true,
            deletedAt: null,
            blockedDates: { $ne: new Date(date) },
            $and: [
                { bookedRanges: { $elemMatch: { bookingId } } },
                {
                    bookedRanges: {
                        $not: {
                            $elemMatch: {
                                date,
                                bookingId: { $ne: bookingId },
                                startMinute: { $lt: endMinute },
                                endMinute: { $gt: startMinute },
                            },
                        },
                    },
                },
            ],
        };
        if (options.shopId) query.shopId = options.shopId;

        return Employee.findOneAndUpdate(
            trustQueryOperators(query),
            {
                $set: {
                    'bookedRanges.$[bookingRange].date': date,
                    'bookedRanges.$[bookingRange].startTime': startTime,
                    'bookedRanges.$[bookingRange].endTime': endTime,
                    'bookedRanges.$[bookingRange].startMinute': startMinute,
                    'bookedRanges.$[bookingRange].endMinute': endMinute,
                },
            },
            {
                ...queryOptions,
                arrayFilters: [{ 'bookingRange.bookingId': bookingId }],
            },
        ).select('firstName lastName photoUrl workingHours');
    }

    /**
     * Backward-compatible single-marker slot claim.
     */
    async claimSlot(employeeId, date, time, options = {}) {
        return this.claimSlots(employeeId, date, [time], options);
    }

    /**
     * Release previously booked slot markers.
     */
    async releaseSlots(employeeId, date, times) {
        const slotTimes = [...new Set(times)].filter(Boolean);
        return Employee.findByIdAndUpdate(employeeId, {
            $pull: {
                bookedSlots: {
                    date,
                    time: { $in: slotTimes },
                },
            },
        });
    }

    async releaseTimeRange(employeeId, range) {
        const { bookingId, date, startMinute, endMinute, slotLockTimes = [] } = range;
        const pullRange = bookingId
            ? { bookingId }
            : { date, startMinute, endMinute };
        const legacySlotTimes = [...new Set(slotLockTimes)].filter(Boolean);

        return Employee.findByIdAndUpdate(employeeId, {
            $pull: {
                bookedRanges: pullRange,
                ...(legacySlotTimes.length > 0 && {
                    bookedSlots: {
                        date,
                        time: { $in: legacySlotTimes },
                    },
                }),
            },
        });
    }

    async cleanupPastTimeLocks(cutoffDate) {
        return Employee.updateMany(
            {},
            {
                $pull: {
                    bookedSlots: { date: { $lt: cutoffDate } },
                    bookedRanges: { date: { $lt: cutoffDate } },
                },
            },
        );
    }

    /**
     * Backward-compatible single-marker slot release.
     */
    async releaseSlot(employeeId, date, time) {
        return this.releaseSlots(employeeId, date, [time]);
    }

    async getIdsForShop(shopId) {
        const employees = await Employee.find({ shopId }).select('_id');
        return employees.map((e) => e._id);
    }

    async softDelete(id, shopId, deletionMarker) {
        return Employee.findOneAndUpdate(
            { _id: id, shopId },
            {
                deletedAt: new Date(),
                isActive: false,
                phoneNumber: deletionMarker,
            },
            { returnDocument: 'after' },
        );
    }

    async findByIdLean(id, fields) {
        return Employee.findById(id).select(fields).lean();
    }
}

export default new EmployeeRepository();

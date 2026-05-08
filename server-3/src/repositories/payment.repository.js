import PaymentTransaction from '../models/payment-transaction.model.js';
import { PAYMENT_TRANSACTION_STATUS } from '../utils/constants.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class PaymentRepository {
    async create(data) {
        return PaymentTransaction.create(data);
    }

    async findById(id) {
        return PaymentTransaction.findById(id);
    }

    async findByIdForEarnings(id) {
        return PaymentTransaction.findById(id)
            .populate({
                path: 'bookingId',
                select: 'date time status paymentStatus totalAmount customerId employeeId serviceIds',
                populate: [
                    {
                        path: 'customerId',
                        select: 'firstName lastName userId',
                        populate: { path: 'userId', select: 'phoneNumber' },
                    },
                    {
                        path: 'employeeId',
                        select: 'firstName lastName',
                        options: { includeDeleted: true },
                    },
                    {
                        path: 'serviceIds',
                        select: 'serviceName actualPrice offerPrice finalPrice duration',
                    },
                ],
            });
    }

    async findByMerchantOrderId(merchantOrderId) {
        return PaymentTransaction.findOne({ merchantOrderId });
    }

    async findAll(filter = {}, options = {}) {
        const query = PaymentTransaction.find(trustQueryOperators(filter))
            .sort({ createdAt: -1 })
            .populate('bookingId', 'date time status paymentStatus totalAmount')
            .populate('customerId', 'firstName lastName userId')
            .populate('shopId', 'shopName ownerId');

        if (options.skip !== undefined) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        return query.lean();
    }

    async findAllForEarnings(filter = {}, options = {}) {
        const query = PaymentTransaction.find(trustQueryOperators(filter))
            .sort({ createdAt: -1 })
            .populate({
                path: 'bookingId',
                select: 'date time status paymentStatus totalAmount customerId employeeId serviceIds',
                populate: [
                    {
                        path: 'customerId',
                        select: 'firstName lastName userId',
                        populate: { path: 'userId', select: 'phoneNumber' },
                    },
                    {
                        path: 'employeeId',
                        select: 'firstName lastName',
                        options: { includeDeleted: true },
                    },
                    {
                        path: 'serviceIds',
                        select: 'serviceName actualPrice offerPrice finalPrice duration',
                    },
                ],
            })
            .populate('customerId', 'firstName lastName userId')
            .populate('shopId', 'shopName ownerId');

        if (options.skip !== undefined) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        return query.lean();
    }

    async countAll(filter = {}) {
        return PaymentTransaction.countDocuments(trustQueryOperators(filter));
    }

    async findPendingByBookingId(bookingId) {
        return PaymentTransaction.findOne(trustQueryOperators({
            bookingId,
            status: {
                $in: [
                    PAYMENT_TRANSACTION_STATUS.INITIATED,
                    PAYMENT_TRANSACTION_STATUS.PENDING,
                ],
            },
        })).sort({ createdAt: -1 });
    }

    async findCompletedByBookingId(bookingId) {
        return PaymentTransaction.findOne(trustQueryOperators({
            bookingId,
            status: {
                $in: [
                    PAYMENT_TRANSACTION_STATUS.COMPLETED,
                    PAYMENT_TRANSACTION_STATUS.REFUND_FAILED,
                ],
            },
        })).sort({ createdAt: -1 });
    }

    async findCompletedByBookingIds(bookingIds) {
        return PaymentTransaction.find(trustQueryOperators({
            bookingId: { $in: bookingIds },
            status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
        }));
    }

    async findLatestByBookingId(bookingId) {
        return PaymentTransaction.findOne({ bookingId }).sort({ createdAt: -1 });
    }

    async updateById(id, updates) {
        return PaymentTransaction.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after' });
    }

    async updateStatus(id, status, additionalFields = {}) {
        return PaymentTransaction.findByIdAndUpdate(
            id,
            { $set: { status, ...additionalFields } },
            { returnDocument: 'after' },
        );
    }

    async markSettledByIds(ids, settledAt = new Date()) {
        return PaymentTransaction.updateMany(
            trustQueryOperators({ _id: { $in: ids } }),
            {
                $set: {
                    'settlement.settled': true,
                    'settlement.settledAt': settledAt,
                },
            },
        );
    }

    async markUnsettledByIds(ids) {
        return PaymentTransaction.updateMany(
            trustQueryOperators({ _id: { $in: ids } }),
            {
                $set: {
                    'settlement.settled': false,
                    'settlement.settledAt': null,
                },
            },
        );
    }

    async findStalePayments(olderThan, notOlderThan, maxAttempts) {
        return PaymentTransaction.find(trustQueryOperators({
            status: PAYMENT_TRANSACTION_STATUS.PENDING,
            createdAt: { $lt: olderThan, $gt: notOlderThan },
            pollAttempts: { $lt: maxAttempts },
        })).limit(50);
    }

    async findExpirablePendingPayments(expiresBefore, fallbackCreatedBefore = expiresBefore) {
        return PaymentTransaction.find(trustQueryOperators({
            status: {
                $in: [
                    PAYMENT_TRANSACTION_STATUS.INITIATED,
                    PAYMENT_TRANSACTION_STATUS.PENDING,
                ],
            },
            $or: [
                { expiresAt: { $lte: expiresBefore } },
                {
                    expiresAt: null,
                    createdAt: { $lt: fallbackCreatedBefore },
                },
            ],
        })).limit(50);
    }
}

export default new PaymentRepository();

import PayoutTransaction from '../models/payout-transaction.model.js';
import { PAYOUT_TRANSACTION_STATUS } from '../utils/constants.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class PayoutRepository {
    async create(data) {
        return PayoutTransaction.create(data);
    }

    async findById(id) {
        return PayoutTransaction.findById(id);
    }

    async findLatestByBookingId(bookingId) {
        return PayoutTransaction.findOne({
            bookingIds: bookingId,
        }).sort({ createdAt: -1 });
    }

    async findByTransferId(transferId) {
        return PayoutTransaction.findOne({ transferId });
    }

    async updateById(id, updates) {
        return PayoutTransaction.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after' });
    }

    async findStuckPayouts(olderThan) {
        return PayoutTransaction.find(trustQueryOperators({
            status: PAYOUT_TRANSACTION_STATUS.PENDING,
            createdAt: { $lt: olderThan },
        })).limit(50);
    }
}

export default new PayoutRepository();

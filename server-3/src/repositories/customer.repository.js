import Customer from '../models/customer.model.js';

class CustomerRepository {
    async create(data) {
        return Customer.create(data);
    }

    async findByUserId(userId) {
        return Customer.findOne({ userId });
    }

    async findById(id) {
        return Customer.findById(id);
    }

    async updateByUserId(userId, data) {
        return Customer.findOneAndUpdate(
            { userId },
            { $set: data },
            { returnDocument: 'after', runValidators: true },
        );
    }

    async addFavoriteBooking(userId, bookingId) {
        return Customer.findOneAndUpdate(
            { userId },
            { $addToSet: { favoriteBookings: bookingId } },
            { returnDocument: 'after' },
        );
    }

    async removeFavoriteBooking(userId, bookingId) {
        return Customer.findOneAndUpdate(
            { userId },
            { $pull: { favoriteBookings: bookingId } },
            { returnDocument: 'after' },
        );
    }

    async addFavoriteShop(userId, shopId) {
        return Customer.findOneAndUpdate(
            { userId },
            { $addToSet: { favoriteShops: shopId } },
            { returnDocument: 'after' },
        );
    }

    async removeFavoriteShop(userId, shopId) {
        return Customer.findOneAndUpdate(
            { userId },
            { $pull: { favoriteShops: shopId } },
            { returnDocument: 'after' },
        );
    }

    async findByUserIdPopulated(userId) {
        return Customer.findOne({ userId }).populate({
            path: 'favoriteBookings',
            populate: [
                { path: 'serviceIds' },
                {
                    path: 'employeeId',
                    select: 'firstName lastName photoUrl',
                    options: { includeDeleted: true },
                },
                { path: 'shopId', select: 'shopName address coverUrl' },
            ],
        }).lean();
    }

    async findFavoriteBookingsByUserId(userId) {
        return Customer.findOne({ userId }).populate({
            path: 'favoriteBookings',
            populate: [
                { path: 'serviceIds' },
                {
                    path: 'employeeId',
                    select: 'firstName lastName photoUrl',
                    options: { includeDeleted: true },
                },
                { path: 'shopId', select: 'shopName address coverUrl' },
            ],
        }).lean();
    }

    async findFavoriteShopsByUserId(userId) {
        return Customer.findOne({ userId }).populate({
            path: 'favoriteShops',
            select: 'shopName address coverUrl category targetCustomers facilities isOpen location',
        }).lean();
    }
}

export default new CustomerRepository();

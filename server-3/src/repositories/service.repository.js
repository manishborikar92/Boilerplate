import Service from '../models/service.model.js';
import { escapeRegex } from '../utils/regex.utils.js';
import { trustQueryOperators } from '../utils/mongoose-query.utils.js';

class ServiceRepository {
    async create(data) {
        return Service.create(data);
    }

    async findById(id) {
        return Service.findById(id);
    }

    async findByIds(ids, selectFields, options = {}) {
        const query = Service.find(
            trustQueryOperators({ _id: { $in: ids }, isActive: true }),
        ).session(options.session || null);
        if (selectFields) query.select(selectFields);
        return query.lean();
    }

    async findByShopId(shopId, filters = {}, options = {}) {
        const query = trustQueryOperators({ shopId, isActive: true, ...filters });
        const mongoQuery = Service.find(query);
        
        if (options.skip !== undefined) mongoQuery.skip(options.skip);
        if (options.limit !== undefined) mongoQuery.limit(options.limit);
        mongoQuery.sort({ createdAt: -1 });
        return mongoQuery;
    }

    async countByShopId(shopId, filters = {}) {
        const query = trustQueryOperators({ shopId, isActive: true, ...filters });
        return Service.countDocuments(query);
    }

    async findByShopIdAndType(shopId, serviceType, selectFields) {
        const query = Service.find({ shopId, serviceType, isActive: true });
        if (selectFields) query.select(selectFields);
        return query.sort({ createdAt: -1 }).lean();
    }

    async findByShopIdAndName(shopId, serviceName, filters = {}) {
        return Service.findOne(trustQueryOperators({
            shopId,
            serviceName: serviceName.trim(),
            isActive: true,
            ...filters,
        })).collation({ locale: 'en', strength: 2 });
    }

    async findByShopIds(shopIds, filters = {}, selectFields) {
        const query = Service.find(
            trustQueryOperators({ shopId: { $in: shopIds }, isActive: true, ...filters }),
        );
        if (selectFields) query.select(selectFields);
        return query.lean();
    }

    async searchByName(nameQuery, filters = {}, selectFields) {
        const query = Service.find(trustQueryOperators({
            serviceName: { $regex: new RegExp(escapeRegex(nameQuery), 'i') },
            isActive: true,
            ...filters,
        }));
        if (selectFields) query.select(selectFields);
        return query.populate('shopId', 'shopName address location category coverUrl').lean();
    }

    async findByGender(gender, selectFields) {
        const query = Service.find({ serviceFor: gender, isActive: true });
        if (selectFields) query.select(selectFields);
        return query.lean();
    }

    async updateById(id, shopId, data) {
        return Service.findOneAndUpdate(
            { _id: id, shopId },
            { $set: data },
            { returnDocument: 'after', runValidators: true },
        );
    }

    async softDelete(id, shopId) {
        return Service.findOneAndUpdate(
            { _id: id, shopId },
            { deletedAt: new Date(), isActive: false },
            { returnDocument: 'after' },
        );
    }
}

export default new ServiceRepository();

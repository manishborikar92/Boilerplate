import serviceRepository from '../repositories/service.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import cloudinary from '../config/cloudinary.config.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/api-error.js';
import { escapeRegex } from '../utils/regex.utils.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { calculateDiscountedPrice, normalizeServicePricing } from '../utils/service-pricing.utils.js';
import { serializeService, serializeServices } from '../serializers/service.serializer.js';
import { serializeShopSummary } from '../serializers/shop.serializer.js';

/**
 * Service-catalog service - manages the salon services (haircut, etc.)
 */

const normalizeBundledServices = (bundledServices = []) => (
    [...new Set(
        bundledServices
            .map((serviceName) => serviceName.trim())
            .filter(Boolean),
    )]
);

const assertValidDiscount = (actualPrice, offerPrice) => {
    const discountedPrice = calculateDiscountedPrice(actualPrice, offerPrice);
    if (discountedPrice < 0) {
        throw new BadRequestError('offerPrice cannot exceed actualPrice');
    }

    return discountedPrice;
};

const buildServiceFilters = (queryFilters = {}) => {
    const filters = {};

    if (queryFilters.serviceType) filters.serviceType = queryFilters.serviceType;
    if (queryFilters.serviceFor) filters.serviceFor = queryFilters.serviceFor;

    return filters;
};

const resolveServiceImage = async (serviceName, serviceType) => {
    const formattedName = serviceName.toLowerCase().replace(/\s+/g, '');
    const folderPath = serviceType === 'bundled' ? 'evercut/bundled' : 'evercut/single';
    const publicId = `${folderPath}/${formattedName}`;

    try {
        const resource = await cloudinary.api.resource(publicId);
        return resource.secure_url;
    } catch {
        return cloudinary.url('evercut/default/service.jpg', { secure: true, resource_type: 'image' });
    }
};

const buildServicePayload = (data, existingService = null) => {
    const existing = existingService ? normalizeServicePricing(existingService) : {};
    const serviceType = existing.serviceType || data.serviceType;
    const actualPrice = data.actualPrice ?? existing.actualPrice;
    const offerPrice = data.offerPrice ?? existing.offerPrice ?? 0;
    const finalPrice = assertValidDiscount(actualPrice, offerPrice);

    const serviceData = {
        serviceName: data.serviceName ?? existing.serviceName,
        serviceType,
        serviceFor: data.serviceFor ?? existing.serviceFor ?? 'unisex',
        actualPrice,
        offerPrice,
        finalPrice,
    };

    if (serviceType === 'single') {
        if (data.duration !== undefined || existing.duration !== undefined) {
            serviceData.duration = data.duration ?? existing.duration;
        }
        return serviceData;
    }

    const bundledServices = data.bundledServices !== undefined
        ? normalizeBundledServices(data.bundledServices)
        : normalizeBundledServices(existing.bundledServices || []);

    if (!bundledServices.length) {
        throw new BadRequestError('bundledServices must contain at least one service');
    }

    serviceData.bundledServices = bundledServices;
    serviceData.totalPrice = finalPrice;

    if (data.totalDuration !== undefined || existing.totalDuration !== undefined) {
        serviceData.totalDuration = data.totalDuration ?? existing.totalDuration;
    }

    return serviceData;
};

const ensureUniqueActiveService = async (shopId, serviceData, currentServiceId = null) => {
    const duplicateService = await serviceRepository.findByShopIdAndName(shopId, serviceData.serviceName, {
        serviceType: serviceData.serviceType,
        serviceFor: serviceData.serviceFor,
    });

    if (
        duplicateService
        && duplicateService._id.toString() !== currentServiceId?.toString()
    ) {
        throw new ConflictError('Service already exists for this service type and gender');
    }
};

const rethrowDuplicateServiceWrite = (error) => {
    if (error?.code === 11000) {
        throw new ConflictError('Service already exists for this service type and gender');
    }

    throw error;
};

export const addService = async (ownerId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const serviceData = buildServicePayload(data);
    await ensureUniqueActiveService(shop._id, serviceData);

    let createdService;
    try {
        createdService = await serviceRepository.create({
            shopId: shop._id,
            imageUrl: await resolveServiceImage(serviceData.serviceName, serviceData.serviceType),
            ...serviceData,
        });
    } catch (error) {
        rethrowDuplicateServiceWrite(error);
    }

    return serializeService(createdService);
};

export const getServices = async (ownerId, queryFilters = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const filters = buildServiceFilters(queryFilters);
    const total = await serviceRepository.countByShopId(shop._id, filters);
    const { skip, limit, pagination } = buildPagination(queryFilters, total);

    const items = serializeServices(await serviceRepository.findByShopId(shop._id, filters, { skip, limit }));
    return { items, pagination };
};

export const updateService = async (ownerId, serviceId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const existingService = await serviceRepository.findById(serviceId);
    if (!existingService || existingService.shopId.toString() !== shop._id.toString()) {
        throw new NotFoundError('Service');
    }

    const updateData = buildServicePayload(data, existingService);
    await ensureUniqueActiveService(shop._id, updateData, existingService._id);

    if (updateData.serviceName !== existingService.serviceName) {
        updateData.imageUrl = await resolveServiceImage(updateData.serviceName, updateData.serviceType);
    }

    let updated;
    try {
        updated = await serviceRepository.updateById(serviceId, shop._id, updateData);
    } catch (error) {
        rethrowDuplicateServiceWrite(error);
    }
    if (!updated) throw new NotFoundError('Service');
    return serializeService(updated);
};

export const deleteService = async (ownerId, serviceId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const deleted = await serviceRepository.softDelete(serviceId, shop._id);
    if (!deleted) throw new NotFoundError('Service');
    return { message: 'Service deleted successfully' };
};

export const searchServices = async (query, gender) => {
    const filters = {};
    if (gender) filters.serviceFor = { $regex: new RegExp(`^${escapeRegex(gender)}$`, 'i') };
    return serializeServices(
        await serviceRepository.searchByName(query, filters, 'serviceName serviceFor shopId'),
        { includeShop: true },
    );
};

export const searchShops = async (query) => {
    return (await shopRepository.searchByName(query, 'shopName address location category coverUrl'))
        .map(serializeShopSummary)
        .filter(Boolean);
};

export const getServicesByGender = async (gender) => {
    return serializeServices(
        await serviceRepository.findByGender(gender, 'serviceName shopId serviceFor serviceType'),
        { includeShop: true },
    );
};

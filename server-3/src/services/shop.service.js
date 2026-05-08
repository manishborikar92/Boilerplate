import shopRepository from '../repositories/shop.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import ratingRepository from '../repositories/rating.repository.js';
import { BadRequestError, NotFoundError } from '../utils/api-error.js';
import { serializeBarberProfile, serializeBankDetails } from '../utils/barber-profile.utils.js';
import { escapeRegex } from '../utils/regex.utils.js';
import { serializeRating } from '../utils/rating-response.utils.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { normalizeServicePricing } from '../utils/service-pricing.utils.js';
import { normalizeShopSchedule } from '../utils/shop-schedule.utils.js';
import notificationEvents from './notification-events.service.js';
import * as serviceCatalogService from './service-catalog.service.js';
import { serializeEmployee } from '../serializers/employee.serializer.js';
import { serializePhotos } from '../serializers/photo.serializer.js';
import { serializeServices } from '../serializers/service.serializer.js';
import { serializeShopProfile, serializeShopSummary } from '../serializers/shop.serializer.js';
import {
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    NEARBY_DISTANCE_METERS,
} from '../utils/constants.js';

/**
 * Shop service business logic for barber profile management and customer discovery.
 */

const paginateArray = (items, query = {}) => {
    const { skip, limit, pagination } = buildPagination(query, items.length);
    return {
        items: items.slice(skip, skip + limit),
        pagination,
    };
};

export const getShopByOwner = async (ownerId, userContext) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const photos = await photoRepository.findByShopId(shop._id, {});
    return serializeBarberProfile(shop, userContext, { photos });
};

const ALLOWED_UPDATE_FIELDS = [
    'shopName',
    'numberOfEmployees',
    'yearsOfExperience',
    'ownerName',
    'ownerFirstName',
    'ownerLastName',
    'ownerGender',
    'ownerDateOfBirth',
    'location',
    'bio',
    'address',
    'category',
    'targetCustomers',
    'facilities',
    'availableDays',
    'openTime',
    'closeTime',
    'breakTimes',
    'isOpen',
];

const parseJsonIfString = (value) => {
    if (typeof value !== 'string') return value;
    return JSON.parse(value);
};

const parseArrayField = (value, fieldName) => {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [trimmed];
        }
    }

    if (typeof value === 'object' && value !== null) return [value];

    throw new Error(`${fieldName} must be an array`);
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const parseBreakTimes = (value) => {
    const rawBreakTimes = parseArrayField(value, 'breakTimes');

    return rawBreakTimes.map((entry, index) => {
        const parsed = parseJsonIfString(entry);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error(`breakTimes[${index}] must be an object`);
        }

        const start = parsed.start;
        const end = parsed.end;
        if (!start || !end) {
            throw new Error(`breakTimes[${index}] must include start and end`);
        }

        return { start, end };
    });
};

const normalizeUpdateBody = (body = {}) => {
    const normalized = { ...body };

    normalized.ownerFirstName = normalized.firstName;
    normalized.ownerLastName = normalized.lastName;
    normalized.ownerGender = normalized.gender;
    normalized.ownerDateOfBirth = normalized.dateOfBirth;
    normalized.facilities = normalized.amenities;
    normalized.availableDays = normalized.workingDays;

    if (normalized.workingHours) {
        let parsedHours = normalized.workingHours;
        if (typeof normalized.workingHours === 'string') {
            try {
                parsedHours = JSON.parse(normalized.workingHours);
            } catch {
                parsedHours = {};
            }
        }
        normalized.openTime = normalized.openTime
            || parsedHours?.openTime;
        normalized.closeTime = normalized.closeTime
            || parsedHours?.closeTime;
    }

    return normalized;
};

const validateAndAssign = (key, value, updateData, errors) => {
    switch (key) {
        case 'category':
            if (!ALL_SHOP_CATEGORIES.includes(value)) {
                errors.push(`Invalid category. Must be one of: ${ALL_SHOP_CATEGORIES.join(', ')}`);
                return;
            }
            updateData[key] = value;
            return;

        case 'targetCustomers': {
            const targetRaw = String(value).trim().toLowerCase();
            const target = {
                men: 'male',
                women: 'female',
            }[targetRaw] || targetRaw;
            if (!ALL_SERVICE_FOR.includes(target)) {
                errors.push(`Invalid targetCustomers. Must be one of: ${ALL_SERVICE_FOR.join(', ')}`);
                return;
            }
            updateData[key] = target;
            return;
        }

        case 'numberOfEmployees': {
            const n = Number.parseInt(value, 10);
            if (Number.isNaN(n) || n < 1) {
                errors.push('numberOfEmployees must be >= 1');
                return;
            }
            updateData[key] = n;
            return;
        }

        case 'yearsOfExperience': {
            const n = Number.parseInt(value, 10);
            if (Number.isNaN(n) || n < 0) {
                errors.push('yearsOfExperience must be >= 0');
                return;
            }
            updateData[key] = n;
            return;
        }

        case 'availableDays': {
            try {
                const days = parseArrayField(value, 'availableDays');
                const invalid = days.filter((day) => !DAYS_OF_WEEK.includes(day));
                if (invalid.length) {
                    errors.push(`Invalid days: ${invalid.join(', ')}`);
                    return;
                }
                updateData[key] = days;
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'facilities': {
            try {
                const amenities = parseArrayField(value, 'facilities');
                const invalid = amenities.filter((item) => !ALL_SHOP_AMENITIES.includes(item));
                if (invalid.length) {
                    errors.push(`Invalid amenities: ${invalid.join(', ')}`);
                    return;
                }
                updateData[key] = amenities;
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'breakTimes': {
            try {
                updateData[key] = parseBreakTimes(value);
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'location': {
            try {
                const location = parseJsonIfString(value);
                if (
                    location?.type !== 'Point'
                    || !Array.isArray(location.coordinates)
                    || location.coordinates.length !== 2
                ) {
                    errors.push('Invalid location format');
                    return;
                }
                updateData[key] = location;
            } catch {
                errors.push('Invalid location format');
            }
            return;
        }

        case 'ownerDateOfBirth': {
            const dt = new Date(value);
            if (Number.isNaN(dt.getTime())) {
                errors.push('ownerDateOfBirth must be a valid date');
                return;
            }
            updateData[key] = dt;
            return;
        }

        default:
            updateData[key] = value;
    }
};

export const updateBusinessInfo = async (ownerId, body, userContext) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const normalizedBody = normalizeUpdateBody(body);
    const updateData = {};
    const errors = [];

    for (const [key, value] of Object.entries(normalizedBody)) {
        if (!ALLOWED_UPDATE_FIELDS.includes(key)) continue;
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value === '' && key !== 'bio') continue;

        // Remove email from update data - email updates must go through /account/email
        if (key === 'email') {
            continue;
        }

        validateAndAssign(key, value, updateData, errors);
    }

    if ((updateData.ownerFirstName || updateData.ownerLastName) && !updateData.ownerName) {
        const firstName = updateData.ownerFirstName || shop.ownerFirstName;
        const lastName = updateData.ownerLastName || shop.ownerLastName;
        updateData.ownerName = `${firstName || ''} ${lastName || ''}`.trim();
    }

    const scheduleFieldsTouched = ['openTime', 'closeTime', 'breakTimes']
        .some((field) => hasOwn(updateData, field));
    if (scheduleFieldsTouched) {
        const scheduleResult = normalizeShopSchedule({
            openTime: updateData.openTime ?? shop.openTime,
            closeTime: updateData.closeTime ?? shop.closeTime,
            breakTimes: updateData.breakTimes ?? shop.breakTimes ?? [],
        });

        if (scheduleResult.error) {
            errors.push(scheduleResult.error);
        } else {
            updateData.openTime = scheduleResult.value.openTime;
            updateData.closeTime = scheduleResult.value.closeTime;
            updateData.breakTimes = scheduleResult.value.breakTimes;
        }
    }

    if (errors.length) throw new BadRequestError('Validation failed', errors);
    if (Object.keys(updateData).length === 0) {
        throw new BadRequestError('No valid fields provided for update');
    }

    let updated = shop;
    if (Object.keys(updateData).length > 0) {
        updated = await shopRepository.updateByOwnerId(ownerId, updateData);
    }
    const photos = await photoRepository.findByShopId(updated._id, {});
    await notificationEvents.notifyAccountUpdated({
        userId: ownerId,
        updateType: 'shop_profile',
    });
    if (hasOwn(updateData, 'isOpen') && Boolean(shop.isOpen) !== Boolean(updated.isOpen)) {
        await notificationEvents.notifyShopStatusUpdated({
            ownerId,
            shopId: updated._id,
            isOpen: updated.isOpen,
        });
    }

    return {
        shop: serializeBarberProfile(updated, userContext, { photos }),
        updatedFields: Object.keys(updateData),
    };
};

export const getPayoutDetails = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    return serializeBankDetails(shop);
};

export const updatePayoutDetails = async (ownerId, body) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    // Validate required fields
    if (!body.accountHolderName || !body.bankName || !body.bankAccount || !body.ifsc || !body.upiId) {
        throw new BadRequestError('All bank details fields are required');
    }

    // Check if bank details are changing
    const currentPayoutConfig = shop.payoutConfig || {};
    const isBankAccountChanging = currentPayoutConfig.bankAccount !== body.bankAccount;
    const isIfscChanging = currentPayoutConfig.ifsc !== body.ifsc;
    const isBankDetailsChanging = isBankAccountChanging || isIfscChanging;

    const updateData = {
        accountHolderName: body.accountHolderName,
        bankName: body.bankName,
        upiId: body.upiId,
        payoutConfig: {
            ...(shop.payoutConfig || {}),
            bankAccount: body.bankAccount,
            ifsc: body.ifsc,
        },
    };

    // If bank details are changing, reset verification status
    if (isBankDetailsChanging) {
        updateData.payoutConfig.verificationStatus = 'pending';
        updateData.payoutConfig.verifiedAt = null;
        // Keep beneficiaryId for tracking, but it will need re-verification
    }

    const updated = await shopRepository.updateByOwnerId(ownerId, updateData);
    await notificationEvents.notifyAccountUpdated({
        userId: ownerId,
        updateType: 'payout_details',
    });

    // TODO: Trigger beneficiary creation/update in payout gateway
    // This should be handled by the payout service when needed
    // await payoutService.createOrUpdateBeneficiary(updated);

    return serializeBankDetails(updated);
};

export const getShopInfoForCustomer = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');

    const [singleServices, bundledServices, photos, ratingSummary] = await Promise.all([
        serviceRepository.findByShopIdAndType(
            shopId,
            'single',
            'serviceName duration finalPrice actualPrice offerPrice imageUrl serviceFor serviceType',
        ),
        serviceRepository.findByShopIdAndType(
            shopId,
            'bundled',
            'serviceName bundledServices totalDuration totalPrice finalPrice actualPrice offerPrice imageUrl serviceFor serviceType',
        ),
        photoRepository.findByShopId(shopId, {}),
        ratingRepository.getShopSummary(shopId),
    ]);

    const ratings = await ratingRepository.findByShop(shopId);
    const formattedRatings = ratings.map(serializeRating);

    return {
        shop: serializeShopProfile(shop, { privateView: false }),
        services: {
            single: serializeServices(singleServices.map(normalizeServicePricing)),
            bundled: serializeServices(bundledServices.map(normalizeServicePricing)),
        },
        photos: serializePhotos(photos),
        ratings: { ...ratingSummary, details: formattedRatings },
    };
};

export const getEmployeesByShopId = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');

    const employeeRepository = (await import('../repositories/employee.repository.js')).default;
    const employees = await employeeRepository.findByShopId(shopId, {});

    // Return only public employee information
    return employees
        .filter((emp) => emp.isActive && !emp.deletedAt)
        .map((emp) => serializeEmployee(emp, { publicView: true }))
        .filter(Boolean);
};

const loadCustomer = async (userId) => {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    return customer;
};

const assertShopExists = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');
    return undefined;
};

export const getFavoriteShops = async (userId, query = {}) => {
    const customer = await customerRepository.findFavoriteShopsByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile');
    return paginateArray((customer.favoriteShops || []).map(serializeShopSummary).filter(Boolean), query);
};

export const addFavoriteShop = async (userId, shopId) => {
    await loadCustomer(userId);
    await assertShopExists(shopId);
    await customerRepository.addFavoriteShop(userId, shopId);

    return {
        favorite: true,
        shopId,
    };
};

export const removeFavoriteShop = async (userId, shopId) => {
    await loadCustomer(userId);
    await customerRepository.removeFavoriteShop(userId, shopId);

    return {
        favorite: false,
        shopId,
    };
};

export const getShops = async (query = {}) => {
    if (query.query) {
        return serviceCatalogService.searchShops(query.query);
    }

    if (query.category) {
        return (await shopRepository.findByCategory(
            query.category,
            'shopName location coverUrl address',
        )).map(serializeShopSummary).filter(Boolean);
    }

    if (query.longitude !== undefined && query.latitude !== undefined) {
        return getNearbyShops([Number(query.longitude), Number(query.latitude)]);
    }

    return [];
};

export const getNearbyShops = async (coordinates) => {
    return (await shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl facilities',
    )).map(serializeShopSummary).filter(Boolean);
};

export const getNearbyServicesByGender = async (coordinates, gender, searchTerm) => {
    const nearbyShops = await shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl',
    );

    if (!nearbyShops.length) return { shops: [], services: [] };

    const shopIds = nearbyShops.map((shop) => shop._id);
    const serviceFilter = { serviceFor: { $regex: new RegExp(`^${escapeRegex(gender)}$`, 'i') } };
    if (searchTerm) serviceFilter.serviceName = { $regex: new RegExp(escapeRegex(searchTerm), 'i') };

    const services = await serviceRepository.findByShopIds(
        shopIds,
        serviceFilter,
        'serviceName shopId serviceFor imageUrl serviceType',
    );

    return {
        shops: nearbyShops.map(serializeShopSummary).filter(Boolean),
        services: serializeServices(services, { includeShop: true }),
    };
};

import customerRepository from '../repositories/customer.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import userRepository from '../repositories/user.repository.js';
import { serializeBarberProfile } from '../utils/barber-profile.utils.js';
import {
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    DAYS_OF_WEEK,
    ROLES,
} from '../utils/constants.js';
import { BadRequestError, ConflictError } from '../utils/api-error.js';
import { normalizeShopSchedule } from '../utils/shop-schedule.utils.js';
import * as authService from './auth.service.js';
import { hashPin, validatePinCreation } from './pin.service.js';
import { serializeCustomerProfile } from '../serializers/customer.serializer.js';
import { serializeUser } from '../serializers/user.serializer.js';

/**
 * Onboarding service - handles first-time user and barber profile creation.
 */

const normalizeVerifiedPhoneNumber = (phoneNumber) => String(phoneNumber ?? '').trim();

const issueAuthenticationTokens = async (user) => {
    const tokens = authService.generateTokenPair(user._id, user.roleType);
    const refreshHash = authService.hashToken(tokens.refreshToken);
    await userRepository.updateById(user._id, { refreshTokenHash: refreshHash });
    return tokens;
};

const parseJsonIfString = (value, fieldName) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        throw new BadRequestError(`Invalid ${fieldName} format`);
    }
};

const toArray = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return [];
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

    if (typeof value === 'object') return [value];

    throw new BadRequestError(`${fieldName} must be an array`);
};

const toPositiveInteger = (value, fallback = 1) => {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) throw new BadRequestError('numberOfEmployees must be >= 1');
    return n;
};

const toNonNegativeInteger = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) throw new BadRequestError('yearsOfExperience must be >= 0');
    return n;
};

const normalizeLocation = (value) => {
    const parsed = parseJsonIfString(value, 'location');
    if (!parsed || typeof parsed !== 'object') throw new BadRequestError('location is required');
    if (parsed.type !== 'Point') throw new BadRequestError('location.type must be "Point"');
    if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
        throw new BadRequestError('location.coordinates must contain [longitude, latitude]');
    }

    const [longitude, latitude] = parsed.coordinates;
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        throw new BadRequestError('location.coordinates must be numbers');
    }

    return parsed;
};

const parseBreakTimes = (value) => {
    const times = toArray(value, 'breakTimes');
    return times.map((entry, index) => {
        const raw = parseJsonIfString(entry, `breakTimes[${index}]`);
        if (!raw || typeof raw !== 'object') {
            throw new BadRequestError(`breakTimes[${index}] must be an object`);
        }

        const start = raw.start;
        const end = raw.end;

        if (!start || !end) {
            throw new BadRequestError(`breakTimes[${index}] must include start and end`);
        }

        return { start, end };
    });
};


const normalizeBarberOnboardingInput = (authUser, shopData) => {
    const firstName = String(shopData.firstName || '').trim();
    const lastName = String(shopData.lastName || '').trim();
    const ownerNameFromNameParts = `${firstName} ${lastName}`.trim();
    const ownerName = ownerNameFromNameParts;

    const email = String(shopData.email || authUser?.email || '').trim().toLowerCase();
    const phoneNumber = String(authUser?.phoneNumber || '').trim();
    const category = shopData.category;
    const address = String(shopData.address || '').trim();
    const upiId = String(shopData.upiId || '').trim();

    const workingHours = parseJsonIfString(shopData.workingHours, 'workingHours');
    const openTime = String(
        shopData.openTime
            || workingHours?.openTime
            || '',
    ).trim();
    const closeTime = String(
        shopData.closeTime
            || workingHours?.closeTime
            || '',
    ).trim();

    const facilities = toArray(shopData.amenities ?? [], 'amenities')
        .map((facility) => String(facility).trim())
        .filter(Boolean);
    const invalidFacilities = facilities.filter((facility) => !ALL_SHOP_AMENITIES.includes(facility));
    if (invalidFacilities.length) {
        throw new BadRequestError(`Invalid amenities: ${invalidFacilities.join(', ')}`);
    }

    const availableDays = toArray(shopData.workingDays ?? [], 'workingDays')
        .map((day) => String(day).trim())
        .filter(Boolean);
    const invalidDays = availableDays.filter((day) => !DAYS_OF_WEEK.includes(day));
    if (invalidDays.length) {
        throw new BadRequestError(`Invalid working days: ${invalidDays.join(', ')}`);
    }

    const breakTimes = parseBreakTimes(shopData.breakTimes ?? []);

    const targetCustomersRaw = String(shopData.targetCustomers || '').trim().toLowerCase();
    const targetCustomers = {
        men: 'male',
        women: 'female',
    }[targetCustomersRaw] || targetCustomersRaw;
    if (!ALL_SERVICE_FOR.includes(targetCustomers)) {
        throw new BadRequestError(`targetCustomers must be one of: ${ALL_SERVICE_FOR.join(', ')}`);
    }

    const accountHolderName = String(shopData.accountHolderName || '').trim();
    const bankName = String(shopData.bankName || '').trim();
    const location = normalizeLocation(shopData.location);

    if (!firstName || !lastName) {
        throw new BadRequestError('firstName and lastName are required');
    }
    if (!shopData.gender) {
        throw new BadRequestError('gender is required');
    }
    if (!shopData.dateOfBirth) {
        throw new BadRequestError('dateOfBirth is required');
    }
    if (!email) {
        throw new BadRequestError('email is required');
    }
    if (!phoneNumber) {
        throw new BadRequestError('phoneNumber is required');
    }
    if (!category) {
        throw new BadRequestError('category is required');
    }
    if (!address) {
        throw new BadRequestError('address is required');
    }
    if (!availableDays.length) {
        throw new BadRequestError('At least one working day is required');
    }
    if (!openTime || !closeTime) {
        throw new BadRequestError('openTime and closeTime are required');
    }
    if (!upiId) {
        throw new BadRequestError('upiId is required');
    }
    if (!accountHolderName || !bankName) {
        throw new BadRequestError('accountHolderName and bankName are required');
    }

    const normalizedSchedule = normalizeShopSchedule({ openTime, closeTime, breakTimes });
    if (normalizedSchedule.error) {
        throw new BadRequestError(normalizedSchedule.error);
    }

    return {
        firstName,
        lastName,
        gender: shopData.gender,
        dateOfBirth: shopData.dateOfBirth,
        ownerName,
        shopName: String(shopData.shopName || '').trim(),
        category,
        targetCustomers,
        phoneNumber,
        email,
        accountHolderName,
        bankName,
        upiId,
        bio: shopData.bio || '',
        address,
        location,
        numberOfEmployees: toPositiveInteger(shopData.numberOfEmployees, 1),
        yearsOfExperience: toNonNegativeInteger(shopData.yearsOfExperience, 0),
        facilities,
        availableDays,
        openTime: normalizedSchedule.value.openTime,
        closeTime: normalizedSchedule.value.closeTime,
        breakTimes: normalizedSchedule.value.breakTimes,
        pin: shopData.pin,
        confirmPin: shopData.confirmPin,
    };
};

const ensureUniqueUserIdentity = async ({ email, phoneNumber }) => {
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedPhoneNumber = phoneNumber ? String(phoneNumber).trim() : null;

    const [emailOwner, phoneOwner] = await Promise.all([
        normalizedEmail ? userRepository.findByEmail(normalizedEmail) : null,
        normalizedPhoneNumber ? userRepository.findByPhone(normalizedPhoneNumber) : null,
    ]);

    if (emailOwner) {
        throw new ConflictError('Email already registered');
    }

    if (phoneOwner) {
        throw new ConflictError('Phone number already registered');
    }
};

export const createCustomerOnboarding = async (phoneNumber, profileData, file) => {
    const verifiedPhoneNumber = normalizeVerifiedPhoneNumber(phoneNumber);
    if (!verifiedPhoneNumber) {
        throw new BadRequestError('Verified phone number is required');
    }
    if (!file) {
        throw new BadRequestError('Profile photo is required');
    }

    await ensureUniqueUserIdentity({
        email: profileData.email,
        phoneNumber: verifiedPhoneNumber,
    });
    const location = normalizeLocation(profileData.location);

    const user = await userRepository.create({
        phoneNumber: verifiedPhoneNumber,
        email: profileData.email,
        roleType: ROLES.CUSTOMER,
    });

    const profile = await customerRepository.create({
        userId: user._id,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        gender: profileData.gender,
        dateOfBirth: profileData.dateOfBirth,
        address: profileData.address,
        location,
        photoUrl: file.path,
        cloudinaryId: file.filename || file.public_id,
    });

    const tokens = await issueAuthenticationTokens(user);

    return {
        user: serializeUser(user),
        profile: serializeCustomerProfile(profile),
        tokens,
    };
};

export const createBarberOnboarding = async (phoneNumber, shopData, file) => {
    const verifiedPhoneNumber = normalizeVerifiedPhoneNumber(phoneNumber);
    if (!verifiedPhoneNumber) {
        throw new BadRequestError('Verified phone number is required');
    }

    const authContext = { phoneNumber: verifiedPhoneNumber, email: null };
    const normalized = normalizeBarberOnboardingInput(authContext, shopData);

    await ensureUniqueUserIdentity({
        email: normalized.email,
        phoneNumber: normalized.phoneNumber,
    });

    if (!file) {
        throw new BadRequestError('Shop image is required');
    }

    const pinResult = validatePinCreation(normalized.pin, normalized.confirmPin);
    if (!pinResult.isValid) {
        throw new BadRequestError(pinResult.message);
    }

    const pinHash = await hashPin(normalized.pin);

    const coverUrl = file.path;
    const coverCloudinaryId = file.public_id || file.filename;

    // Prepare payout config if bank details are provided
    const payoutConfig = {};
    if (shopData.bankAccount && shopData.ifsc) {
        payoutConfig.bankAccount = String(shopData.bankAccount).trim();
        payoutConfig.ifsc = String(shopData.ifsc).trim().toUpperCase();
        payoutConfig.verificationStatus = 'pending';
    }

    const user = await userRepository.create({
        phoneNumber: normalized.phoneNumber,
        email: normalized.email,
        roleType: ROLES.BARBER,
    });

    const shopCreateData = {
        ownerId: user._id,
        shopName: normalized.shopName,
        ownerName: normalized.ownerName,
        ownerFirstName: normalized.firstName,
        ownerLastName: normalized.lastName,
        ownerGender: normalized.gender,
        ownerDateOfBirth: normalized.dateOfBirth,
        category: normalized.category,
        targetCustomers: normalized.targetCustomers,
        accountHolderName: normalized.accountHolderName,
        bankName: normalized.bankName,
        upiId: normalized.upiId,
        bio: normalized.bio,
        address: normalized.address,
        location: normalized.location,
        numberOfEmployees: normalized.numberOfEmployees,
        yearsOfExperience: normalized.yearsOfExperience,
        facilities: normalized.facilities,
        availableDays: normalized.availableDays,
        openTime: normalized.openTime,
        closeTime: normalized.closeTime,
        breakTimes: normalized.breakTimes,
        coverUrl,
        coverCloudinaryId,
        pinHash,
    };

    // Only add payoutConfig if bank details were provided
    if (Object.keys(payoutConfig).length > 0) {
        shopCreateData.payoutConfig = payoutConfig;
    }

    const createdShop = await shopRepository.create(shopCreateData);

    const photo = await photoRepository.create({
        shopId: createdShop._id,
        photoUrl: file.path,
        cloudinaryId: file.public_id || file.filename,
        photoName: file.originalname || 'onboarding-shop-image',
        photoType: 'shop_interior',
        description: 'Uploaded during onboarding',
        fileSize: file.size,
        mimeType: file.mimetype,
    });

    const tokens = await issueAuthenticationTokens(user);

    return {
        user: serializeUser(user),
        shop: serializeBarberProfile(createdShop, user, { photos: [photo] }),
        tokens,
    };
};

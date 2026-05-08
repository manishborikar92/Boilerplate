import { sanitizeForResponse, toPlainObject } from './core.serializer.js';
import { serializePhotos } from './photo.serializer.js';
import { serializeUser } from './user.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

const maskBankAccount = (bankAccount) => {
    if (!bankAccount) return null;
    const digits = String(bankAccount).replace(/\D/g, '');
    if (digits.length <= 4) return digits || null;
    return `******${digits.slice(-4)}`;
};

const toBreakTimes = (breakTimes = []) => (
    Array.isArray(breakTimes)
        ? breakTimes.map((entry) => {
            const start = entry?.start ?? entry?.startsAt ?? null;
            const end = entry?.end ?? entry?.endsAt ?? null;
            return { start, end };
        })
        : []
);

const toWorkingHours = (plain = {}) => ({
    openTime: plain.openTime ?? null,
    closeTime: plain.closeTime ?? null,
});

const serializeOwner = (plain = {}, userContext = null, privateView = false) => {
    const user = userContext ? serializeUser(userContext) : {};

    return compact({
        id: user?.id,
        firstName: plain.ownerFirstName ?? null,
        lastName: plain.ownerLastName ?? null,
        gender: plain.ownerGender ?? null,
        dateOfBirth: privateView ? (plain.ownerDateOfBirth ?? null) : undefined,
        email: privateView ? (user?.email ?? null) : undefined,
        phoneNumber: privateView ? (user?.phoneNumber ?? null) : undefined,
        photoUrl: plain.ownerPhotoUrl ?? null,
    });
};

export const serializeBankDetails = (shop) => {
    const raw = toPlainObject(shop);
    const plain = sanitizeForResponse(raw);
    if (!plain) return null;

    const verificationStatus = plain.payoutConfig?.verificationStatus || 'pending';
    const isVerified = verificationStatus === 'verified';

    return {
        accountHolderName: plain.accountHolderName || null,
        bankName: plain.bankName || null,
        upiId: plain.upiId || null,
        bankAccountLast4: maskBankAccount(raw?.payoutConfig?.bankAccount),
        ifsc: plain.payoutConfig?.ifsc || null,
        verificationStatus,
        isVerified,
        verifiedAt: plain.payoutConfig?.verifiedAt || null,
        beneficiaryId: plain.payoutConfig?.beneficiaryId || null,
        beneficiaryCreatedAt: plain.payoutConfig?.beneficiaryCreatedAt || null,
        canReceivePayouts: isVerified,
    };
};

export const serializeShopSummary = (shop) => {
    const plain = sanitizeForResponse(toPlainObject(shop));
    if (!plain) return null;

    return compact({
        id: plain.id,
        shopName: plain.shopName ?? null,
        address: plain.address ?? null,
        location: plain.location ?? null,
        category: plain.category ?? null,
        targetCustomers: plain.targetCustomers ?? null,
        coverUrl: plain.coverUrl ?? null,
        amenities: plain.facilities ?? [],
        isOpen: plain.isOpen,
        workingDays: plain.availableDays,
        workingHours: toWorkingHours(plain),
    });
};

export const serializeShopProfile = (shop, options = {}) => {
    const plain = sanitizeForResponse(toPlainObject(shop));
    if (!plain) return null;

    const owner = serializeOwner(plain, options.userContext, options.privateView);

    return compact({
        id: plain.id,
        owner: Object.keys(owner).length > 0 ? owner : undefined,
        shopName: plain.shopName ?? null,
        category: plain.category ?? null,
        targetCustomers: plain.targetCustomers ?? null,
        payout: options.privateView ? serializeBankDetails(shop) : undefined,
        bio: plain.bio ?? '',
        address: plain.address ?? null,
        location: plain.location ?? null,
        numberOfEmployees: plain.numberOfEmployees ?? null,
        yearsOfExperience: plain.yearsOfExperience ?? null,
        amenities: plain.facilities ?? [],
        workingDays: plain.availableDays ?? [],
        workingHours: toWorkingHours(plain),
        breakTimes: toBreakTimes(plain.breakTimes),
        coverUrl: plain.coverUrl ?? null,
        isOpen: plain.isOpen ?? true,
        missedConfirmations: {
            count: plain.missedConfirmationCount || 0,
            lastMissedAt: plain.lastMissedConfirmationAt || null,
        },
        photos: options.photos ? serializePhotos(options.photos) : undefined,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

export const serializeBarberProfile = (shop, userContext = {}, { photos } = {}) => {
    const profile = serializeShopProfile(shop, {
        userContext,
        photos,
        privateView: true,
    });
    if (!profile) return null;

    return profile;
};

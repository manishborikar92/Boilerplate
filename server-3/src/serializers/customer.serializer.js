import { sanitizeForResponse, toIdString, toPlainObject } from './core.serializer.js';
import { serializeUser } from './user.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

const serializeIdList = (values = []) => (
    Array.isArray(values)
        ? values.map((value) => toIdString(value)).filter(Boolean)
        : []
);

export const serializeCustomerSummary = (customer) => {
    const plain = sanitizeForResponse(toPlainObject(customer));
    if (!plain) return null;

    return compact({
        id: plain.id,
        firstName: plain.firstName ?? null,
        lastName: plain.lastName ?? null,
        photoUrl: plain.photoUrl ?? null,
    });
};

export const serializeCustomerProfile = (customer) => {
    const plain = sanitizeForResponse(toPlainObject(customer));
    if (!plain) return null;

    return compact({
        id: plain.id,
        userId: plain.userId?.id || toIdString(plain.userId),
        user: plain.userId && typeof plain.userId === 'object' ? serializeUser(plain.userId) : undefined,
        firstName: plain.firstName ?? null,
        lastName: plain.lastName ?? null,
        gender: plain.gender ?? null,
        dateOfBirth: plain.dateOfBirth ?? null,
        address: plain.address ?? null,
        photoUrl: plain.photoUrl ?? null,
        location: plain.location ?? null,
        favoriteBookingIds: serializeIdList(plain.favoriteBookings),
        favoriteShopIds: serializeIdList(plain.favoriteShops),
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

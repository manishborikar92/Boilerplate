import { sanitizeForResponse, toPlainObject } from './core.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

export const serializeUser = (user) => {
    const plain = sanitizeForResponse(toPlainObject(user));
    if (!plain) return null;

    return compact({
        id: plain.id,
        phoneNumber: plain.phoneNumber ?? null,
        email: plain.email ?? null,
        emailVerified: plain.emailVerified ?? false,
        roleType: plain.roleType ?? null,
        isActive: plain.isActive ?? undefined,
        lastLoginAt: plain.lastLoginAt ?? null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

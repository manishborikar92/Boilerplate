const INTERNAL_KEYS = new Set([
    '$__',
    '$isNew',
    '$locals',
    '$op',
    '_doc',
    '__v',
    'parent',
    'populated',
]);

const SENSITIVE_KEYS = new Set([
    'pinHash',
    'refreshTokenHash',
    'cloudinaryId',
    'coverCloudinaryId',
    'ownerPhotoCloudinaryId',
    'sdkOrderToken',
    'gatewayResponse',
    'webhookEventId',
    'bankAccount',
]);

const isObjectIdLike = (value) => (
    value
    && typeof value === 'object'
    && (
        typeof value.toHexString === 'function'
        || value._bsontype === 'ObjectId'
    )
);

export const toIdString = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (isObjectIdLike(value)) return value.toHexString ? value.toHexString() : String(value);
    if (value?._id) return toIdString(value._id);
    return String(value);
};

export const toPlainObject = (value) => {
    if (!value) return value;

    if (typeof value.toObject === 'function') {
        return value.toObject({
            versionKey: false,
            virtuals: false,
            getters: false,
            depopulate: false,
            transform: false,
        });
    }

    if (
        typeof value === 'object'
        && value._doc
        && (value.$__ || Object.keys(value).every((key) => INTERNAL_KEYS.has(key) || key.startsWith('$')))
    ) {
        return toPlainObject(value._doc);
    }

    return value;
};

const shouldDropKey = (key) => (
    INTERNAL_KEYS.has(key)
    || SENSITIVE_KEYS.has(key)
    || key.startsWith('$')
);

export const sanitizeForResponse = (value, seen = new WeakSet()) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) return value;
    if (isObjectIdLike(value)) return toIdString(value);
    if (typeof value !== 'object') return value;

    const plainValue = toPlainObject(value);
    if (plainValue !== value) {
        return sanitizeForResponse(plainValue, seen);
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeForResponse(item, seen))
            .filter((item) => item !== undefined);
    }

    if (value instanceof Map) {
        return sanitizeForResponse(Object.fromEntries(value.entries()), seen);
    }

    if (seen.has(value)) return undefined;
    seen.add(value);

    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
        if (shouldDropKey(key)) continue;

        const outputKey = key === '_id' ? 'id' : key;
        const sanitizedValue = sanitizeForResponse(nestedValue, seen);
        if (sanitizedValue !== undefined) {
            output[outputKey] = sanitizedValue;
        }
    }

    return output;
};

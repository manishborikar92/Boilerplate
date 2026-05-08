import { sanitizeForResponse, toIdString, toPlainObject } from './core.serializer.js';

const compact = (value) => Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
);

export const serializePhoto = (photo) => {
    const plain = sanitizeForResponse(toPlainObject(photo));
    if (!plain) return null;

    return compact({
        id: plain.id,
        shopId: plain.shopId?.id || toIdString(plain.shopId),
        photoUrl: plain.photoUrl ?? null,
        photoName: plain.photoName ?? null,
        photoType: plain.photoType ?? null,
        description: plain.description ?? null,
        fileSize: plain.fileSize,
        mimeType: plain.mimeType,
        isActive: plain.isActive,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    });
};

export const serializePhotos = (photos = []) => (
    Array.isArray(photos) ? photos.map(serializePhoto).filter(Boolean) : []
);

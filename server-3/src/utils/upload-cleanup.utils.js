import cloudinary from '../config/cloudinary.config.js';
import logger from './logger.js';

const toFileArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (typeof value === 'object') {
        return Object.values(value)
            .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
            .filter(Boolean);
    }

    return [];
};

export const extractUploadedAssetIds = (req) => {
    const files = [
        ...(req?.file ? [req.file] : []),
        ...toFileArray(req?.files),
    ];

    return [...new Set(
        files
            .map((file) => file?.public_id || file?.filename)
            .filter(Boolean),
    )];
};

export const cleanupUploadedAssets = async (req, context = 'request-validation-failed') => {
    const publicIds = extractUploadedAssetIds(req);
    if (!publicIds.length) return;

    await Promise.all(
        publicIds.map(async (publicId) => {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                logger.warn('Uploaded asset cleanup failed', {
                    publicId,
                    context,
                    error: err.message,
                });
            }
        }),
    );
};

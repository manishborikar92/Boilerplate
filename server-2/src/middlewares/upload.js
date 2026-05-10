const multer = require('multer');
const { ValidationError } = require('../utils/errorHandler');
const { UPLOAD_PRESETS } = require('../config/fileUpload');
const { logger } = require('./logger');

// Use memory storage to process files before uploading to Cloudinary
const storage = multer.memoryStorage();

const createFileFilter = (allowedMimeTypes) => {
    return (req, file, cb) => {
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ValidationError(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`), false);
        }
    };
};

const createUploadMiddleware = (config = {}) => {
    const {
        allowedTypes = UPLOAD_PRESETS.GENERAL.allowedTypes,
        maxSize = UPLOAD_PRESETS.GENERAL.maxSize,
        maxFiles = 1
    } = config;

    return multer({
        storage,
        limits: {
            fileSize: maxSize,
            files: maxFiles
        },
        fileFilter: createFileFilter(allowedTypes)
    });
};

const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        logger.warn('Multer error', { error: err.message, code: err.code });
        return res.status(400).json({
            success: false,
            message: err.message === 'File too large'
                ? `File too large. Max limit is ${err.limit} bytes.`
                : err.message
        });
    }

    if (err instanceof ValidationError) {
        return res.status(400).json({ success: false, message: err.message });
    }

    next(err);
};

// Pre-configured middleware
const uploadAvatar = createUploadMiddleware(UPLOAD_PRESETS.AVATAR).single('file');
const uploadSingle = createUploadMiddleware(UPLOAD_PRESETS.GENERAL).single('file');
const uploadMultiple = (maxFiles = 5) => createUploadMiddleware({ ...UPLOAD_PRESETS.GENERAL, maxFiles }).array('files', maxFiles);

module.exports = {
    createUploadMiddleware,
    handleUploadError,
    uploadAvatar,
    uploadSingle,
    uploadMultiple
};

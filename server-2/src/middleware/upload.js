/**
 * File Upload Middleware
 * Handles file validation and multer configuration
 */
const multer = require('multer');
const { 
  ValidationError 
} = require('../utils/errorHandler');
const { 
  FILE_TYPES, 
  DOCUMENT_TYPES, 
  UPLOAD_PRESETS 
} = require('../config/fileUpload');
const { logger } = require('./logger');

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

/**
 * Create file filter based on allowed types
 * @param {Array<string>} allowedMimeTypes - Array of allowed MIME types
 * @returns {Function} File filter function
 */
const createFileFilter = (allowedMimeTypes) => {
  return (req, file, cb) => {
    logger.info('Validating file', { 
      filename: file.originalname, 
      mimetype: file.mimetype 
    });

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new ValidationError(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      );
      logger.warn('File type rejected', { 
        filename: file.originalname, 
        mimetype: file.mimetype 
      });
      cb(error, false);
    }
  };
};

/**
 * Create upload middleware with specific configuration
 * @param {Object} config - Upload configuration
 * @returns {Object} Multer middleware
 */
const createUploadMiddleware = (config = {}) => {
  const {
    allowedTypes = DOCUMENT_TYPES.ALL_FILES.mimeTypes,
    maxSize = DOCUMENT_TYPES.ALL_FILES.maxSize,
    maxFiles = 10
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

/**
 * Handle multer errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error', { error: err.message, code: err.code });

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the maximum allowed limit',
        error: err.message
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded',
        error: err.message
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field',
        error: err.message
      });
    }

    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: err.message
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next(err);
};

// Predefined upload middleware for common use cases

/**
 * Avatar upload middleware
 */
const uploadAvatar = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.AVATAR.allowedTypes,
  maxSize: UPLOAD_PRESETS.AVATAR.maxSize,
  maxFiles: 1
});

/**
 * Firm logo upload middleware
 */
const uploadFirmLogo = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.FIRM_LOGO.allowedTypes,
  maxSize: UPLOAD_PRESETS.FIRM_LOGO.maxSize,
  maxFiles: 1
});

/**
 * Firm profile completion upload middleware (for firmLogo + profilePhoto)
 */
const uploadFirmProfile = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.FIRM_LOGO.allowedTypes,
  maxSize: UPLOAD_PRESETS.FIRM_LOGO.maxSize,
  maxFiles: 2
});

/**
 * Document upload middleware
 */
const uploadDocument = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.DOCUMENT.allowedTypes,
  maxSize: UPLOAD_PRESETS.DOCUMENT.maxSize,
  maxFiles: 1
});

/**
 * Multiple documents upload middleware
 */
const uploadMultipleDocuments = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.DOCUMENT.allowedTypes,
  maxSize: UPLOAD_PRESETS.DOCUMENT.maxSize,
  maxFiles: 10
});

/**
 * All files upload middleware
 */
const uploadAllFiles = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.ALL_FILES.allowedTypes,
  maxSize: UPLOAD_PRESETS.ALL_FILES.maxSize,
  maxFiles: 1
});

/**
 * Multiple files upload middleware
 */
const uploadMultipleFiles = createUploadMiddleware({
  allowedTypes: UPLOAD_PRESETS.ALL_FILES.allowedTypes,
  maxSize: UPLOAD_PRESETS.ALL_FILES.maxSize,
  maxFiles: 20
});

/**
 * Image only upload middleware
 */
const uploadImage = createUploadMiddleware({
  allowedTypes: FILE_TYPES.IMAGES.mimeTypes,
  maxSize: FILE_TYPES.IMAGES.maxSize,
  maxFiles: 1
});

/**
 * Multiple images upload middleware
 */
const uploadMultipleImages = createUploadMiddleware({
  allowedTypes: FILE_TYPES.IMAGES.mimeTypes,
  maxSize: FILE_TYPES.IMAGES.maxSize,
  maxFiles: 10
});

module.exports = {
  createUploadMiddleware,
  handleUploadError,
  uploadAvatar,
  uploadFirmLogo,
  uploadFirmProfile,
  uploadDocument,
  uploadMultipleDocuments,
  uploadAllFiles,
  uploadMultipleFiles,
  uploadImage,
  uploadMultipleImages
};

/**
 * File Upload Configuration
 * Defines allowed file types, size limits, and folder structures
 */

const FILE_TYPES = {
    IMAGES: {
        mimeTypes: [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/webp', 'image/svg+xml'
        ],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    DOCUMENTS: {
        mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'text/plain',
            'text/csv'
        ],
        maxSize: 20 * 1024 * 1024, // 20MB
    }
};

const UPLOAD_PRESETS = {
    AVATAR: {
        allowedTypes: FILE_TYPES.IMAGES.mimeTypes,
        maxSize: 2 * 1024 * 1024, // 2MB
        folder: 'boilerplate/users/avatars'
    },
    GENERAL: {
        allowedTypes: [...FILE_TYPES.IMAGES.mimeTypes, ...FILE_TYPES.DOCUMENTS.mimeTypes],
        maxSize: 10 * 1024 * 1024, // 10MB
        folder: 'boilerplate/uploads'
    }
};

module.exports = {
    FILE_TYPES,
    UPLOAD_PRESETS
};

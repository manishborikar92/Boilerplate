/**
 * File Upload Configuration
 * Defines allowed file types, size limits, and folder structures
 */

// Comprehensive file type definitions
const FILE_TYPES = {
  // Images - all common formats
  IMAGES: {
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/x-icon'
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.tiff', '.ico'],
    maxSize: 10 * 1024 * 1024, // 10MB
    resourceType: 'image'
  },

  // PDF Documents
  PDF: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    maxSize: 50 * 1024 * 1024, // 50MB
    resourceType: 'raw'
  },

  // Microsoft Office Documents
  OFFICE: {
    mimeTypes: [
      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // PowerPoint
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ],
    extensions: [
      '.doc', '.docx',
      '.xls', '.xlsx',
      '.ppt', '.pptx'
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    resourceType: 'raw'
  },

  // Text Files
  TEXT: {
    mimeTypes: [
      'text/plain',
      'text/rtf',
      'application/rtf',
      'text/csv'
    ],
    extensions: ['.txt', '.rtf', '.csv'],
    maxSize: 10 * 1024 * 1024, // 10MB
    resourceType: 'raw'
  },

  // Compressed Files
  COMPRESSED: {
    mimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip'
    ],
    extensions: ['.zip', '.rar', '.7z', '.gz'],
    maxSize: 100 * 1024 * 1024, // 100MB
    resourceType: 'raw'
  }
};

// Combined document types for easy validation
const DOCUMENT_TYPES = {
  ALL_DOCUMENTS: {
    mimeTypes: [
      ...FILE_TYPES.PDF.mimeTypes,
      ...FILE_TYPES.OFFICE.mimeTypes,
      ...FILE_TYPES.TEXT.mimeTypes,
      ...FILE_TYPES.COMPRESSED.mimeTypes
    ],
    extensions: [
      ...FILE_TYPES.PDF.extensions,
      ...FILE_TYPES.OFFICE.extensions,
      ...FILE_TYPES.TEXT.extensions,
      ...FILE_TYPES.COMPRESSED.extensions
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    resourceType: 'raw'
  },

  ALL_FILES: {
    mimeTypes: [
      ...FILE_TYPES.IMAGES.mimeTypes,
      ...FILE_TYPES.PDF.mimeTypes,
      ...FILE_TYPES.OFFICE.mimeTypes,
      ...FILE_TYPES.TEXT.mimeTypes,
      ...FILE_TYPES.COMPRESSED.mimeTypes
    ],
    extensions: [
      ...FILE_TYPES.IMAGES.extensions,
      ...FILE_TYPES.PDF.extensions,
      ...FILE_TYPES.OFFICE.extensions,
      ...FILE_TYPES.TEXT.extensions,
      ...FILE_TYPES.COMPRESSED.extensions
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    resourceType: 'auto'
  }
};

// Folder structure for organized file storage
// All folders are under CA-Flow root folder
const FOLDER_STRUCTURE = {
  // User-related folders
  USERS: {
    AVATARS: 'CA-Flow/users/avatars',
    DOCUMENTS: 'CA-Flow/users/documents',
    PROFILES: 'CA-Flow/users/profiles'
  },

  // Firm-related folders
  FIRMS: {
    LOGOS: 'CA-Flow/firms/logos',
    DOCUMENTS: 'CA-Flow/firms/documents',
    CERTIFICATES: 'CA-Flow/firms/certificates',
    LICENSES: 'CA-Flow/firms/licenses'
  },

  // Client-related folders
  CLIENTS: {
    DOCUMENTS: 'CA-Flow/clients/documents',
    TAX_RETURNS: 'CA-Flow/clients/tax-returns',
    FINANCIAL_STATEMENTS: 'CA-Flow/clients/financial-statements',
    INVOICES: 'CA-Flow/clients/invoices',
    RECEIPTS: 'CA-Flow/clients/receipts',
    CONTRACTS: 'CA-Flow/clients/contracts'
  },

  // General uploads
  GENERAL: {
    UPLOADS: 'CA-Flow/uploads',
    TEMP: 'CA-Flow/temp'
  }
};

// File size limits (in bytes)
const SIZE_LIMITS = {
  TINY: 1 * 1024 * 1024,      // 1MB
  SMALL: 5 * 1024 * 1024,     // 5MB
  MEDIUM: 10 * 1024 * 1024,   // 10MB
  LARGE: 50 * 1024 * 1024,    // 50MB
  XLARGE: 100 * 1024 * 1024   // 100MB
};

// Upload presets for different use cases
const UPLOAD_PRESETS = {
  AVATAR: {
    allowedTypes: FILE_TYPES.IMAGES.mimeTypes,
    maxSize: SIZE_LIMITS.SMALL,
    folder: FOLDER_STRUCTURE.USERS.AVATARS,
    transformation: {
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto'
    }
  },

  FIRM_LOGO: {
    allowedTypes: FILE_TYPES.IMAGES.mimeTypes,
    maxSize: SIZE_LIMITS.SMALL,
    folder: FOLDER_STRUCTURE.FIRMS.LOGOS,
    transformation: {
      width: 800,
      height: 400,
      crop: 'fit',
      quality: 'auto'
    }
  },

  DOCUMENT: {
    allowedTypes: DOCUMENT_TYPES.ALL_DOCUMENTS.mimeTypes,
    maxSize: SIZE_LIMITS.LARGE,
    folder: FOLDER_STRUCTURE.GENERAL.UPLOADS
  },

  ALL_FILES: {
    allowedTypes: DOCUMENT_TYPES.ALL_FILES.mimeTypes,
    maxSize: SIZE_LIMITS.XLARGE,
    folder: FOLDER_STRUCTURE.GENERAL.UPLOADS
  }
};

module.exports = {
  FILE_TYPES,
  DOCUMENT_TYPES,
  FOLDER_STRUCTURE,
  SIZE_LIMITS,
  UPLOAD_PRESETS
};

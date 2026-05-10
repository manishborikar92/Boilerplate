const mongoose = require('mongoose');
const {
  DOCUMENT_SOURCE_VALUES,
  inferDocumentSource,
  buildWorkspaceStorageRoot
} = require('../services/documentWorkspaceService');

/**
 * Document Schema
 * Stores metadata for all documents uploaded to the system
 * Organized by client company with predefined folder categories
 */
const documentSchema = new mongoose.Schema({
  // File Information
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  fileExtension: {
    type: String,
    required: [true, 'File extension is required']
  },

  // Cloudinary Information
  cloudinaryPublicId: {
    type: String,
    required: [true, 'Cloudinary public ID is required'],
    unique: true
  },
  cloudinaryUrl: {
    type: String,
    required: [true, 'Cloudinary URL is required']
  },
  cloudinaryFolder: {
    type: String,
    required: [true, 'Cloudinary folder path is required']
  },

  // Document Category (as per requirement)
  category: {
    type: String,
    required: [true, 'Document category is required'],
    default: 'Miscellaneous',
    enum: [
      'GST_Filings',
      'Income_Tax',
      'Audit_Reports',
      'Financial_Statements',
      'Miscellaneous'
    ]
  },

  // Associations
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm ID is required']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader ID is required']
  },
  documentSource: {
    type: String,
    enum: DOCUMENT_SOURCE_VALUES,
    required: [true, 'Document source is required']
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },

  // Optional Metadata
  description: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  financialYear: {
    type: String,
    trim: true
  },
  month: {
    type: String,
    trim: true
  },

  // Payment Requirements (NEW)
  requiresPayment: {
    type: Boolean,
    default: false
  },
  paymentAmount: {
    type: Number, // Amount in paise (₹100 = 10000 paise)
    default: 0
  },
  paymentDescription: {
    type: String,
    trim: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes for faster queries
documentSchema.index({ firmId: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ isDeleted: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ folderId: 1 });
documentSchema.index({ clientId: 1, documentSource: 1, isDeleted: 1 });
documentSchema.index({ clientId: 1, documentSource: 1, folderId: 1, isDeleted: 1 });

// Compound index for common queries
documentSchema.index({ clientId: 1, category: 1, isDeleted: 1 });
documentSchema.index({ clientId: 1, folderId: 1, isDeleted: 1 });
documentSchema.index({ requiresPayment: 1, isPaid: 1 });
documentSchema.index({ paymentId: 1 });

// Virtual for human-readable category name
documentSchema.virtual('categoryName').get(function() {
  const categoryMap = {
    'GST_Filings': 'GST Filings',
    'Income_Tax': 'Income Tax',
    'Audit_Reports': 'Audit Reports',
    'Financial_Statements': 'Financial Statements',
    'Miscellaneous': 'Miscellaneous / Others'
  };
  return categoryMap[this.category] || this.category;
});

// Virtual for file size in human-readable format
documentSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for payment amount in rupees
documentSchema.virtual('paymentAmountInRupees').get(function() {
  return this.paymentAmount / 100;
});

// Virtual for access status
documentSchema.virtual('accessStatus').get(function() {
  if (!this.requiresPayment) return 'free';
  if (this.isPaid) return 'paid';
  return 'locked';
});

// Ensure virtuals are included in JSON
documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

documentSchema.pre('validate', function(next) {
  if (!this.displayName || !this.displayName.trim()) {
    this.displayName = this.originalName || this.fileName;
  } else {
    this.displayName = this.displayName.trim();
  }

  if (!this.category) {
    this.category = 'Miscellaneous';
  }

  this.documentSource = inferDocumentSource({
    documentSource: this.documentSource,
    folderId: this.folderId,
    cloudinaryFolder: this.cloudinaryFolder,
    tags: this.tags,
    description: this.description
  });

  next();
});

// Static method to get all categories
documentSchema.statics.getCategories = function() {
  return [
    { value: 'GST_Filings', label: 'GST Filings' },
    { value: 'Income_Tax', label: 'Income Tax' },
    { value: 'Audit_Reports', label: 'Audit Reports' },
    { value: 'Financial_Statements', label: 'Financial Statements' },
    { value: 'Miscellaneous', label: 'Miscellaneous / Others' }
  ];
};

documentSchema.statics.getWorkspaceStorageRoot = function(firmId, clientId) {
  return buildWorkspaceStorageRoot({ firmId, clientId });
};

module.exports = mongoose.model('Document', documentSchema);

const mongoose = require('mongoose');
const { normalizeFolderName } = require('../services/documentWorkspaceService');

/**
 * Folder Schema
 * Organizes documents into custom folders within categories
 */
const folderSchema = new mongoose.Schema({
  // Folder Information
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    maxlength: [100, 'Folder name cannot exceed 100 characters']
  },

  // Optional category association
  category: {
    type: String,
    enum: [
      'GST_Filings',
      'Income_Tax',
      'Audit_Reports',
      'Financial_Statements',
      'Miscellaneous',
      null
    ],
    default: null
  },

  // Associations
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required'],
    index: true
  },

  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm ID is required'],
    index: true
  },

  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
    index: true
  },

  ancestorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  }],

  depth: {
    type: Number,
    default: 0,
    min: 0
  },

  normalizedName: {
    type: String,
    trim: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },

  // Metadata
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  color: {
    type: String,
    default: '#3B82F6' // Default blue color
  },

  // Document count (denormalized for performance)
  documentCount: {
    type: Number,
    default: 0,
    min: 0
  },

  directDocumentCount: {
    type: Number,
    default: 0,
    min: 0
  },

  childFolderCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Status
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  deletedAt: {
    type: Date
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
folderSchema.index({ clientId: 1, isDeleted: 1 });
folderSchema.index({ firmId: 1, isDeleted: 1 });
folderSchema.index({ clientId: 1, category: 1, isDeleted: 1 });
folderSchema.index({ clientId: 1, parentId: 1, isDeleted: 1 });
folderSchema.index({ clientId: 1, ancestorIds: 1, isDeleted: 1 });
folderSchema.index({ createdAt: -1 });

// Compound unique index to prevent duplicate folder names among siblings
folderSchema.index(
  { clientId: 1, parentId: 1, normalizedName: 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);

folderSchema.pre('validate', function(next) {
  this.parentId = this.parentId || null;
  this.ancestorIds = Array.isArray(this.ancestorIds) ? this.ancestorIds : [];
  this.normalizedName = normalizeFolderName(this.name);

  if (this.depth === undefined || this.depth === null) {
    this.depth = this.ancestorIds.length;
  }

  if (this.parentId === null && this.ancestorIds.length > 0) {
    this.invalidate('ancestorIds', 'Root folders cannot have ancestors');
  }

  if (this.depth !== this.ancestorIds.length) {
    this.invalidate('depth', 'Folder depth must match ancestorIds length');
  }

  if (this.directDocumentCount === undefined || this.directDocumentCount === null) {
    this.directDocumentCount = this.documentCount || 0;
  }

  if (this.childFolderCount === undefined || this.childFolderCount === null) {
    this.childFolderCount = 0;
  }

  if (this.documentCount === undefined || this.documentCount === null) {
    this.documentCount = this.directDocumentCount || 0;
  }

  next();
});

folderSchema.pre('save', async function(next) {
  if (this.isDeleted) {
    return next();
  }

  const shouldCheckDuplicates =
    this.isNew ||
    this.isModified('name') ||
    this.isModified('parentId') ||
    this.isModified('clientId') ||
    this.isModified('isDeleted');

  if (!shouldCheckDuplicates) {
    return next();
  }

  const existingFolder = await this.constructor.findOne({
    _id: { $ne: this._id },
    clientId: this.clientId,
    parentId: this.parentId || null,
    normalizedName: this.normalizedName,
    isDeleted: false
  })
    .select('_id')
    .lean();

  if (!existingFolder) {
    return next();
  }

  const validationError = new mongoose.Error.ValidationError(this);
  validationError.addError(
    'name',
    new mongoose.Error.ValidatorError({
      path: 'name',
      message: 'A folder with this name already exists in this location'
    })
  );

  return next(validationError);
});

// Virtual for category name
folderSchema.virtual('categoryName').get(function() {
  if (!this.category) return 'General';
  
  const categoryMap = {
    'GST_Filings': 'GST Filings',
    'Income_Tax': 'Income Tax',
    'Audit_Reports': 'Audit Reports',
    'Financial_Statements': 'Financial Statements',
    'Miscellaneous': 'Miscellaneous / Others'
  };
  return categoryMap[this.category] || this.category;
});

// Instance Methods
folderSchema.methods.incrementDocumentCount = async function() {
  this.documentCount += 1;
  this.directDocumentCount += 1;
  return this.save();
};

folderSchema.methods.decrementDocumentCount = async function() {
  if (this.documentCount > 0) {
    this.documentCount -= 1;
  }

  if (this.directDocumentCount > 0) {
    this.directDocumentCount -= 1;
  }

  return this.save();
};

folderSchema.methods.incrementChildFolderCount = async function() {
  this.childFolderCount += 1;
  return this.save();
};

folderSchema.methods.decrementChildFolderCount = async function() {
  if (this.childFolderCount > 0) {
    this.childFolderCount -= 1;
  }

  return this.save();
};

folderSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Static Methods
folderSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

folderSchema.statics.findByClient = function(clientId, conditions = {}) {
  return this.find({ ...conditions, clientId, isDeleted: false });
};

folderSchema.statics.findByClientAndCategory = function(clientId, category) {
  return this.find({ clientId, category, isDeleted: false });
};

folderSchema.statics.findByParent = function(clientId, parentId = null) {
  return this.find({
    clientId,
    parentId: parentId || null,
    isDeleted: false
  });
};

module.exports = mongoose.model('Folder', folderSchema);

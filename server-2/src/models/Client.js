const mongoose = require('mongoose');
const phoneNumberUtil = require('../utils/phoneNumber');

/**
 * Client Schema - Redesigned with Best Practices
 * 
 * Improvements:
 * - Removed password duplication (stored only in User model)
 * - Added proper validation for company details
 * - Added compound indexes for performance
 * - Added audit trail fields
 * - Added soft delete support
 * - Improved business metrics tracking
 * - Better status management
 * - Added client lifecycle tracking
 */
const clientSchema = new mongoose.Schema({
  // ==================== COMPANY INFORMATION ====================
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters'],
    maxlength: [200, 'Company name cannot exceed 200 characters'],
    index: true
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    index: true
  },
  
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return phoneNumberUtil.isValidFormat(v);
      },
      message: 'Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)'
    }
  },
  
  alternatePhoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return phoneNumberUtil.isValidFormat(v);
      },
      message: 'Please provide a valid alternate phone number (e.g., +91 9822685547, 919822685547, or 9822685547)'
    }
  },
  
  companyType: {
    type: String,
    required: [true, 'Company type is required'],
    enum: {
      values: ['Proprietorship', 'Partnership', 'Pvt. Ltd.', 'LLP', 'Public Ltd.', 'NGO', 'Trust', 'Society'],
      message: '{VALUE} is not a valid company type'
    },
    index: true
  },
  
  // ==================== AUTO-GENERATED CREDENTIALS ====================
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    index: true
  },
  
  // ==================== ASSOCIATIONS ====================
  // Reference to User account (created when client is added)
  userAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    validate: {
      validator: async function(value) {
        if (!value) return true; // Can be null initially
        const User = mongoose.model('User');
        const user = await User.findById(value);
        return user && user.role === 'Client';
      },
      message: 'Invalid user account reference or user is not a Client'
    }
  },
  
  // Firm Association
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm ID is required'],
    index: true
  },
  
  // ==================== BUSINESS DETAILS ====================
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // GSTIN format: 22AAAAA0000A1Z5
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Please provide a valid GSTIN (15 characters)'
    },
    index: true
  },
  
  pan: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // PAN format: AAAAA9999A
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
      },
      message: 'Please provide a valid PAN (10 characters)'
    },
    index: true
  },
  
  tan: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // TAN format: AAAA99999A
        return /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/.test(v);
      },
      message: 'Please provide a valid TAN (10 characters)'
    }
  },
  
  cin: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // CIN format: 21 characters
        return /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v);
      },
      message: 'Please provide a valid CIN (21 characters)'
    }
  },
  
  // ==================== ADDRESS ====================
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City name cannot exceed 100 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, 'State name cannot exceed 100 characters']
    },
    pinCode: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // Indian PIN code format (6 digits)
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: 'Please provide a valid PIN code (6 digits)'
      }
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    }
  },
  
  // ==================== CONTACT PERSON ====================
  contactPerson: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Contact person name cannot exceed 100 characters']
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Please provide a valid email'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return phoneNumberUtil.isValidFormat(v);
        },
        message: 'Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)'
      }
    }
  },
  
  // ==================== BUSINESS METRICS ====================
  totalDocuments: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalPayments: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalAmountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  
  outstandingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastPaymentDate: {
    type: Date
  },
  
  lastDocumentUploadDate: {
    type: Date
  },
  
  // ==================== STATUS & FLAGS ====================
  accountCreated: {
    type: Boolean,
    default: false,
    index: true
  },
  
  accountActivatedAt: {
    type: Date
  },
  
  invitationSent: {
    type: Boolean,
    default: false
  },
  
  invitationSentAt: {
    type: Date
  },
  
  lastInvitationSentAt: {
    type: Date
  },
  
  invitationCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  firstLoginAt: {
    type: Date
  },
  
  lastActivityAt: {
    type: Date,
    index: true
  },
  
  // ==================== PREFERENCES ====================
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    whatsapp: {
      type: Boolean,
      default: false
    }
  },
  
  // ==================== NOTES & TAGS ====================
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  
  // ==================== AUDIT TRAIL ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Soft delete support
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

// ==================== INDEXES ====================
// Compound indexes for common queries
clientSchema.index({ firmId: 1, isDeleted: 1 });
clientSchema.index({ firmId: 1, companyType: 1, isDeleted: 1 });
clientSchema.index({ email: 1, isDeleted: 1 });
clientSchema.index({ userId: 1, isDeleted: 1 });
clientSchema.index({ userAccountId: 1, isDeleted: 1 });
clientSchema.index({ gstin: 1, isDeleted: 1 });
clientSchema.index({ pan: 1, isDeleted: 1 });
clientSchema.index({ accountCreated: 1, isDeleted: 1 });
clientSchema.index({ lastActivityAt: -1 });
clientSchema.index({ createdAt: -1 });

// Text index for search
clientSchema.index({ 
  companyName: 'text', 
  email: 'text', 
  userId: 'text',
  'contactPerson.name': 'text'
});

// ==================== VIRTUALS ====================
clientSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.pinCode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

clientSchema.virtual('accountStatus').get(function() {
  if (this.isDeleted) return 'deleted';
  if (!this.accountCreated) return 'pending';
  if (!this.firstLoginAt) return 'invited';
  return 'active';
});

clientSchema.virtual('daysSinceCreation').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

clientSchema.virtual('daysSinceLastActivity').get(function() {
  if (!this.lastActivityAt) return null;
  const now = new Date();
  const lastActivity = new Date(this.lastActivityAt);
  return Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
});

clientSchema.virtual('averagePaymentAmount').get(function() {
  if (this.totalPayments === 0) return 0;
  return (this.totalAmountPaid / this.totalPayments).toFixed(2);
});

// ==================== MIDDLEWARE ====================
// Update timestamps on save
clientSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// ==================== INSTANCE METHODS ====================
// Update activity timestamp
clientSchema.methods.updateActivity = async function() {
  this.lastActivityAt = new Date();
  return this.save();
};

// Increment document count
clientSchema.methods.incrementDocumentCount = async function() {
  this.totalDocuments += 1;
  this.lastDocumentUploadDate = new Date();
  this.lastActivityAt = new Date();
  return this.save();
};

// Add payment
clientSchema.methods.addPayment = async function(amount) {
  this.totalPayments += 1;
  this.totalAmountPaid += amount;
  this.lastPaymentDate = new Date();
  this.lastActivityAt = new Date();
  
  // Reduce outstanding amount
  if (this.outstandingAmount >= amount) {
    this.outstandingAmount -= amount;
  } else {
    this.outstandingAmount = 0;
  }
  
  return this.save();
};

// Add outstanding amount
clientSchema.methods.addOutstanding = async function(amount) {
  this.outstandingAmount += amount;
  return this.save();
};

// Mark account as created
clientSchema.methods.activateAccount = async function(userAccountId) {
  this.accountCreated = true;
  this.accountActivatedAt = new Date();
  this.userAccountId = userAccountId;
  return this.save();
};

// Record invitation sent
clientSchema.methods.recordInvitation = async function() {
  this.invitationSent = true;
  this.invitationSentAt = this.invitationSentAt || new Date();
  this.lastInvitationSentAt = new Date();
  this.invitationCount += 1;
  return this.save();
};

// Record first login
clientSchema.methods.recordFirstLogin = async function() {
  if (!this.firstLoginAt) {
    this.firstLoginAt = new Date();
    this.lastActivityAt = new Date();
    return this.save();
  }
};

// Soft delete
clientSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Remove sensitive data from JSON response
clientSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  
  // Remove deleted records from responses
  if (obj.isDeleted) {
    return null;
  }
  
  return obj;
};

// ==================== STATIC METHODS ====================
// Generate unique user ID with improved collision handling
clientSchema.statics.generateUserId = async function(firmId) {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Readable Character Set (Crockford's Base32)
    // Removed: 0, O, 1, I, L to avoid confusion
    // Pool size: 32^6 = ~1.07 Billion combinations
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; 
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }

    const userId = `CA-CLT-${suffix}`;

    // Check if userId already exists
    const existing = await this.exists({ userId });

    if (!existing) {
      return userId;
    }
    
    // If collision detected, try again
    // Add small delay on retries to reduce contention
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  // If we still can't generate unique ID after max attempts, throw error
  throw new Error(`Failed to generate unique Client ID after ${maxAttempts} attempts. This is extremely rare.`);
};

// Generate secure random password
clientSchema.statics.generatePassword = function() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';
  const specialChars = '@#$%&*!';
  const numbers = '0123456789';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  
  let password = '';
  
  // Ensure at least one of each type
  password += specialChars[Math.floor(Math.random() * specialChars.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Find active (non-deleted) clients only
clientSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

// Find by firm ID (excluding deleted)
clientSchema.statics.findByFirm = function(firmId, conditions = {}) {
  return this.find({ ...conditions, firmId, isDeleted: false });
};

// Find by user account ID (excluding deleted)
clientSchema.statics.findByUserAccount = function(userAccountId) {
  return this.findOne({ userAccountId, isDeleted: false });
};

// Find by userId (excluding deleted)
clientSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, isDeleted: false });
};

// Find by email (excluding deleted)
clientSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

module.exports = mongoose.model('Client', clientSchema);

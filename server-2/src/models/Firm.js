const mongoose = require('mongoose');
const phoneNumberUtil = require('../utils/phoneNumber');

/**
 * Firm Schema - Redesigned with Best Practices
 * 
 * Improvements:
 * - Added proper validation for PAN, GSTIN, IFSC, PIN codes
 * - Added compound indexes for performance
 * - Added audit trail fields
 * - Added soft delete support
 * - Improved bank details validation
 * - Added business metrics tracking
 * - Better address structure with validation
 * - Added subscription tracking
 */
const firmSchema = new mongoose.Schema({
  // ==================== FIRM INFORMATION ====================
  firmName: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true,
    minlength: [2, 'Firm name must be at least 2 characters'],
    maxlength: [200, 'Firm name cannot exceed 200 characters'],
    index: true
  },
  
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    trim: true
  },
  
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // GSTIN format: 22AAAAA0000A1Z5
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Please provide a valid GSTIN (15 characters)'
    }
  },
  
  pan: {
    type: String,
    required: [true, 'PAN is required'],
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // PAN format: AAAAA9999A
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
      },
      message: 'Please provide a valid PAN (10 characters)'
    }
  },
  
  // ==================== CONTACT INFORMATION ====================
  officialEmail: {
    type: String,
    required: [true, 'Official email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return phoneNumberUtil.isValidFormat(v);
      },
      message: 'Please provide a valid contact number (e.g., +91 9822685547, 919822685547, or 9822685547)'
    }
  },
  
  alternateContactNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return phoneNumberUtil.isValidFormat(v);
      },
      message: 'Please provide a valid alternate contact number (e.g., +91 9822685547, 919822685547, or 9822685547)'
    }
  },
  
  firmLogo: {
    type: String,
    trim: true
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
  
  websiteUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
      },
      message: 'Please provide a valid website URL'
    }
  },
  
  // ==================== BANK DETAILS ====================
  bankDetails: {
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      maxlength: [100, 'Account holder name cannot exceed 100 characters']
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      set: v => (typeof v === 'string' ? v.replace(/\D/g, '') : v),
      validate: {
        validator: function(v) {
          // Account number should be 9-18 digits
          return /^[0-9]{9,18}$/.test(v);
        },
        message: 'Please provide a valid account number (9-18 digits)'
      }
    },
    accountNumberLast4: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          // IFSC format: ABCD0123456
          return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
        },
        message: 'Please provide a valid IFSC code (11 characters)'
      }
    },
    accountType: {
      type: String,
      enum: ['Savings', 'Current', 'Overdraft'],
      default: 'Current'
    },
    branchName: {
      type: String,
      trim: true,
      maxlength: [100, 'Branch name cannot exceed 100 characters']
    }
  },
  
  // ==================== SERVICES ====================
  primaryServices: [{
    type: String,
    enum: [
      'Audit & Assurance',
      'Taxation & GST',
      'Accounting & Bookkeeping',
      'Company Incorporation',
      'Compliance & Legal',
      'Financial Advisory',
      'Others'
    ]
  }],
  
  customServices: [{
    type: String,
    trim: true,
    maxlength: [100, 'Custom service name cannot exceed 100 characters']
  }],
  
  // ==================== PREFERENCES ====================
  whatsappNotification: {
    type: Boolean,
    default: false
  },
  
  emailNotification: {
    type: Boolean,
    default: true
  },
  
  smsNotification: {
    type: Boolean,
    default: false
  },
  
  // ==================== ASSOCIATIONS ====================
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin ID is required']
  },
  
  // ==================== SUBSCRIPTION ====================
  // As per Subscription Development Guide - 2-Tier Model (Starter & Pro)
  // 'plan_ca_flow_free' is the default state (no Razorpay subscription needed)
  // 'plan_ca_flow_pro' requires active Razorpay subscription
  subscription: {
    planId: {
      type: String,
      enum: ['plan_ca_flow_free', 'plan_ca_flow_pro'],
      default: 'plan_ca_flow_free'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'past_due', 'cancelled'],
      default: 'active'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'half-yearly']
    },
    validity: {
      startDate: {
        type: Date
      },
      endDate: {
        type: Date
      }
    },
    razorpaySubscriptionId: {
      type: String
    },
    razorpayCustomerId: {
      type: String
    }
  },

  // Legacy fields - kept for backward compatibility during migration
  // TODO: Migrate data and remove these fields
  currentSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },

  // ==================== BUSINESS METRICS ====================
  totalClients: {
    type: Number,
    default: 0,
    min: 0
  },
  
  activeClients: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalDocuments: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ==================== STATUS & FLAGS ====================
  setupCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  verifiedAt: {
    type: Date
  },
  
  // ==================== AUDIT TRAIL ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
firmSchema.index(
  { adminId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
firmSchema.index(
  { registrationNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, registrationNumber: { $exists: true, $ne: '' } } }
);
firmSchema.index(
  { pan: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
firmSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, gstin: { $exists: true, $ne: '' } } }
);
firmSchema.index(
  { officialEmail: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
firmSchema.index({ 'subscription.status': 1, 'subscription.planId': 1, isDeleted: 1 });
firmSchema.index({ 'address.city': 1, 'address.state': 1 });

// ==================== VIRTUALS ====================
firmSchema.virtual('fullAddress').get(function() {
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

firmSchema.virtual('clientRetentionRate').get(function() {
  if (this.totalClients === 0) return 0;
  return ((this.activeClients / this.totalClients) * 100).toFixed(2);
});

firmSchema.virtual('averageRevenuePerClient').get(function() {
  if (this.activeClients === 0) return 0;
  return (this.totalRevenue / this.activeClients).toFixed(2);
});

// ==================== MIDDLEWARE ====================
// Update timestamps on save
firmSchema.pre('save', function(next) {
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountNumberLast4 = this.bankDetails.accountNumber.slice(-4);
  }
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// ==================== INSTANCE METHODS ====================
// Increment client count
firmSchema.methods.incrementClientCount = async function() {
  this.totalClients += 1;
  this.activeClients += 1;
  return this.save();
};

// Decrement client count
firmSchema.methods.decrementClientCount = async function() {
  if (this.activeClients > 0) {
    this.activeClients -= 1;
  }
  return this.save();
};

// Update revenue
firmSchema.methods.addRevenue = async function(amount) {
  this.totalRevenue += amount;
  return this.save();
};

// Soft delete
firmSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Remove sensitive data from JSON response
firmSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  
  // Remove deleted records from responses
  if (obj.isDeleted) {
    return null;
  }
  
  return obj;
};

// ==================== STATIC METHODS ====================
// Find active (non-deleted) firms only
firmSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

// Find by admin ID (excluding deleted)
firmSchema.statics.findByAdmin = function(adminId) {
  return this.findOne({ adminId, isDeleted: false });
};

// Find by PAN (excluding deleted)
firmSchema.statics.findByPAN = function(pan) {
  return this.findOne({ pan: pan.toUpperCase(), isDeleted: false });
};

// Find by GSTIN (excluding deleted)
firmSchema.statics.findByGSTIN = function(gstin) {
  return this.findOne({ gstin: gstin.toUpperCase(), isDeleted: false });
};

module.exports = mongoose.model('Firm', firmSchema);

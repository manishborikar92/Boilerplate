const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const phoneNumberUtil = require('../utils/phoneNumber');

/**
 * User Schema - Redesigned with Best Practices
 * 
 * Improvements:
 * - Removed password duplication (single source of truth)
 * - Added proper indexes for performance
 * - Added audit fields (createdBy, updatedBy, deletedBy)
 * - Added soft delete support
 * - Improved validation with custom validators
 * - Added account status tracking
 * - Better security with token expiration
 */
const userSchema = new mongoose.Schema({
  // ==================== AUTHENTICATION ====================
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    index: true
  },
  
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Never return password in queries by default
  },
  
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
    index: true
  },
  
  // ==================== PROFILE ====================
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  photoURL: {
    type: String,
    trim: true
  },
  
  phoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return phoneNumberUtil.isValidFormat(v);
      },
      message: 'Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)'
    }
  },
  
  professionalTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Professional title cannot exceed 100 characters']
  },
  
  // ==================== ROLE & PERMISSIONS ====================
  role: {
    type: String,
    enum: {
      values: ['CA-Admin', 'Client'],
      message: '{VALUE} is not a valid role'
    },
    default: 'CA-Admin',
    required: true,
    index: true
  },
  
  // ==================== ASSOCIATIONS ====================
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    index: true,
    validate: {
      validator: async function(value) {
        if (!value) return true; // Optional for new CA-Admins
        const Firm = mongoose.model('Firm');
        const firm = await Firm.findById(value);
        return !!firm;
      },
      message: 'Invalid firm reference'
    }
  },
  
  // For Client users - reference to Client profile
  clientProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    index: true,
    validate: {
      validator: function(value) {
        // Only Client role should have clientProfileId
        if (this.role === 'Client') {
          return !!value;
        }
        return !value; // CA-Admin should not have clientProfileId
      },
      message: 'Client role must have clientProfileId, CA-Admin must not'
    }
  },
  
  // ==================== STATUS & FLAGS ====================
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  profileCompleted: {
    type: Boolean,
    default: false
  },
  
  // ==================== SECURITY TOKENS ====================
  emailVerificationToken: {
    type: String,
    select: false,
    index: true
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false,
    index: true
  },
  
  resetPasswordToken: {
    type: String,
    select: false,
    index: true
  },
  
  resetPasswordExpires: {
    type: Date,
    select: false,
    index: true
  },
  
  // ==================== ACTIVITY TRACKING ====================
  lastLogin: {
    type: Date,
    index: true
  },
  
  lastPasswordChange: {
    type: Date
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
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
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ firmId: 1, role: 1, isDeleted: 1 });
userSchema.index({ firebaseUid: 1, isDeleted: 1 });
userSchema.index({ isEmailVerified: 1, isDeleted: 1 });

// ==================== VIRTUALS ====================
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('accountAge').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24)); // Days
});

// ==================== MIDDLEWARE ====================
// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps on save
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// ==================== INSTANCE METHODS ====================
// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  return token;
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Soft delete
userSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Remove sensitive data from JSON response
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.__v;
  
  // Remove deleted records from responses
  if (obj.isDeleted) {
    return null;
  }
  
  return obj;
};

// ==================== STATIC METHODS ====================
// Find active (non-deleted) users only
userSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

// Find by email (excluding deleted)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isDeleted: false });
};

// Find by Firebase UID (excluding deleted)
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid, isDeleted: false });
};

module.exports = mongoose.model('User', userSchema);

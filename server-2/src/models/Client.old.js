const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // Company Information
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  companyType: {
    type: String,
    required: [true, 'Company type is required'],
    enum: ['Proprietorship', 'Partnership', 'Pvt. Ltd.', 'LLP', 'Public Ltd.', 'NGO']
  },
  
  // Auto-generated credentials
  userId: {
    type: String,
    unique: true,
    required: true
  },
  generatedPassword: {
    type: String,
    required: true,
    select: false // Don't return in queries by default
  },
  
  // Associated User Account (created after client is added)
  userAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Firm Association
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },
  
  // Additional Information
  gstin: {
    type: String,
    trim: true,
    uppercase: true
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pinCode: {
      type: String,
      trim: true
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  accountCreated: {
    type: Boolean,
    default: false
  },
  invitationSent: {
    type: Boolean,
    default: false
  },
  invitationSentAt: {
    type: Date
  }
}, { 
  timestamps: true 
});

// Indexes for faster queries
clientSchema.index({ firmId: 1 });

// Generate unique user ID
clientSchema.statics.generateUserId = async function(firmId) {
  // Get the count of clients for this firm
  const count = await this.countDocuments({ firmId });
  const nextNumber = count + 1;
  
  // Format: CA-CLT-XXX (e.g., CA-CLT-001, CA-CLT-002)
  return `CA-CLT-${String(nextNumber).padStart(3, '0')}`;
};

// Generate secure random password
clientSchema.statics.generatePassword = function() {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
  const specialChars = '@#$%&*';
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

// Remove sensitive data from JSON response
clientSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.generatedPassword;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Client', clientSchema);

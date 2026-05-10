const mongoose = require('mongoose');

const firmSchema = new mongoose.Schema({
  // Section 1: Firm Information
  firmName: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    trim: true
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true
  },
  pan: {
    type: String,
    required: [true, 'PAN is required'],
    trim: true,
    uppercase: true
  },
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
    trim: true
  },
  firmLogo: {
    type: String // URL to uploaded logo
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
  websiteUrl: {
    type: String,
    trim: true
  },
  
  // Bank Details
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required'],
    trim: true,
    uppercase: true
  },
  
  // Section 3: Firm Setup Preferences
  primaryServices: [{
    type: String,
    enum: [
      'Audit & Assurance',
      'Taxation & GST',
      'Accounting & Bookkeeping',
      'Company Incorporation',
      'Compliance & Legal',
      'Others'
    ]
  }],
  customServices: [{
    type: String,
    trim: true
  }],
  whatsappNotification: {
    type: Boolean,
    default: false
  },
  
  // Admin reference
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  setupCompleted: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Index for faster queries
firmSchema.index({ adminId: 1 });

// Remove sensitive data from JSON response
firmSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Firm', firmSchema);

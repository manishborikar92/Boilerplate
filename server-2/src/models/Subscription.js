const mongoose = require('mongoose');


const subscriptionSchema = new mongoose.Schema({
  // Plan Details
  planName: {
    type: String,
    required: true
  },

  planDescription: {
    type: String
  },

  // Razorpay Plan ID
  razorpayPlanId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Pricing
  amount: {
    type: Number,
    required: true // Amount in paise (discounted price)
  },

  originalAmount: {
    type: Number // Original amount in paise before discount
  },

  discount: {
    type: Number // Discount percentage (e.g., 29 for 29% OFF)
  },

  currency: {
    type: String,
    default: 'INR'
  },

  // Billing
  billingPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly'],
    required: true
  },

  interval: {
    type: Number,
    default: 1 // 1 month, 1 quarter, 1 half-year
  },

  // Features
  features: [{
    type: String
  }],

  // Limits
  maxClients: {
    type: Number,
    default: 100 // Default to Pro plan limit
  },

  maxStorage: {
    type: Number, // in GB
    default: 50 // Default to Pro plan limit
  },

  maxUsers: {
    type: Number,
    default: -1
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  isPopular: {
    type: Boolean,
    default: false
  },

  isDeleted: {
    type: Boolean,
    default: false
  },


  // REMOVED: createdBy field
  // Plans are created by Platform Owner via seed script, not by individual users
  // No need to track which user created the plan
}, {
  timestamps: true
});

// Virtual for amount in rupees
subscriptionSchema.virtual('amountInRupees').get(function () {
  return this.amount / 100;
});

// Virtual for original amount in rupees
subscriptionSchema.virtual('originalAmountInRupees').get(function () {
  return this.originalAmount ? this.originalAmount / 100 : null;
});

// Method to get discount display
subscriptionSchema.methods.getDiscountDisplay = function () {
  if (this.discount) {
    return `${this.discount}% OFF`;
  }
  return null;
};

// Method to get billing period display name
subscriptionSchema.methods.getBillingPeriodDisplay = function () {
  const periods = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    'half-yearly': 'Half-Yearly',
    yearly: 'Yearly'
  };
  return periods[this.billingPeriod] || this.billingPeriod;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);

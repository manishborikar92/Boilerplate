const mongoose = require('mongoose');
const Counter = require('./Counter');

const paymentSchema = new mongoose.Schema({
  // Payment Type
  paymentType: {
    type: String,
    enum: ['invoice', 'subscription', 'document', 'chat-message'],
    required: true
  },

  // Document Payment (NEW)
  documentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],

  // Chat payment (message-based)
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread'
  },

  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Client Information
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },

  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true
  },

  // Razorpay IDs
  razorpayOrderId: {
    type: String,
    sparse: true // For invoices
  },

  razorpayPaymentId: {
    type: String,
    sparse: true
  },

  razorpaySubscriptionId: {
    type: String,
    sparse: true // For subscriptions
  },

  razorpayInvoiceId: {
    type: String,
    sparse: true
  },

  razorpayPaymentLinkId: {
    type: String,
    sparse: true
  },

  razorpayPaymentLinkUrl: {
    type: String,
    sparse: true
  },

  // Payment Details
  amount: {
    type: Number,
    required: true // Amount in paise (₹100 = 10000 paise)
  },

  currency: {
    type: String,
    default: 'INR'
  },

  // Invoice/Subscription Details
  description: {
    type: String,
    required: true
  },

  invoiceNumber: {
    type: String,
    sparse: true
    // Uniqueness is enforced by compound index with firmId
  },

  // For subscription payments
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },

  billingPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly', 'yearly']
  },

  // Status
  status: {
    type: String,
    enum: ['created', 'pending', 'paid', 'failed', 'cancelled', 'refunded'],
    default: 'created'
  },

  // Payment Method
  paymentMethod: {
    type: String // card, netbanking, wallet, upi, etc.
  },

  // Timestamps
  paidAt: {
    type: Date
  },

  dueDate: {
    type: Date
  },

  // GST Details
  gstAmount: {
    type: Number,
    default: 0
  },

  gstPercentage: {
    type: Number,
    default: 18
  },

  // Additional Info
  notes: {
    type: Map,
    of: String
  },

  // Webhook data
  webhookData: {
    type: mongoose.Schema.Types.Mixed
  },

  webhookEventIds: {
    type: [String],
    default: []
  },

  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Recurring billing fields
  nextBillingDate: {
    type: Date
  },

  billingHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'completed']
    },
    razorpayPaymentId: String,
    razorpayPaymentLinkId: String,
    razorpayPaymentLinkUrl: String,
    notes: String
  }],

  // Razorpay customer ID for automatic billing
  razorpayCustomerId: {
    type: String,
    sparse: true
  },

  // Subscription status tracking
  subscriptionStatus: {
    type: String,
    enum: ['created', 'authenticated', 'pending', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created'
  },

  // Total billing cycles
  totalCount: {
    type: Number,
    default: 12
  },

  // Completed billing cycles
  paidCount: {
    type: Number,
    default: 0
  },

  // Remaining billing cycles
  remainingCount: {
    type: Number,
    default: 12
  },

  // Subscription start and end dates
  subscriptionStartAt: {
    type: Date
  },

  subscriptionEndAt: {
    type: Date
  },

  // Current billing cycle dates
  currentPeriodStart: {
    type: Date
  },

  currentPeriodEnd: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
// Compound unique index: invoiceNumber must be unique within each firm
// partialFilterExpression allows multiple null values but enforces uniqueness for non-null
paymentSchema.index(
  { firmId: 1, invoiceNumber: 1 },
  { 
    unique: true, 
    partialFilterExpression: { invoiceNumber: { $type: 'string' } }
  }
);

paymentSchema.index({ clientId: 1, firmId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ messageId: 1 });

// Virtual for amount in rupees
paymentSchema.virtual('amountInRupees').get(function() {
  return this.amount / 100;
});

// Generate invoice number using atomic counter
paymentSchema.pre('save', async function(next) {
  if (this.isNew && this.paymentType === 'invoice' && !this.invoiceNumber) {
    try {
      const year = new Date().getFullYear();
      const sequence = await Counter.getNextSequence(this.firmId, year, 'invoice');
      this.invoiceNumber = `INV-${year}-${String(sequence).padStart(5, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);

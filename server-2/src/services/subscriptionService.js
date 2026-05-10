/**
 * Subscription Service (REFACTORED)
 * 
 * Centralized business logic for subscription management
 * 
 * Last Updated: January 29, 2026
 * Version: 5.0 - Refactored for clarity and single responsibility
 * 
 * RESPONSIBILITIES:
 * - Calculate and enforce subscription limits
 * - Provide plan configuration and limits
 * - Calculate billing dates and periods
 * - Check notification channel permissions
 * - Generate usage statistics
 */

const { PLAN_CONFIG } = require('../constants/plans');
const Firm = require('../models/Firm');
const Client = require('../models/Client');
const Document = require('../models/Document');
const Payment = require('../models/Payment');
const { AuthorizationError } = require('../utils/errorHandler');

// ============================================
// PLAN CONFIGURATION & LIMITS
// ============================================

/**
 * Get plan limits for a firm
 * Automatically downgrades expired Pro subscriptions to Starter
 * 
 * @param {Object} firm - Firm document
 * @returns {Object} Plan limits configuration
 */
function getPlanLimits(firm) {
  const planId = firm.subscription?.planId || 'plan_ca_flow_free';
  const limits = PLAN_CONFIG[planId];

  if (!limits) {
    console.warn(`Unknown planId "${planId}", defaulting to free plan limits`);
    return PLAN_CONFIG['plan_ca_flow_free'];
  }

  // Check if Pro subscription has expired
  if (planId === 'plan_ca_flow_pro' && firm.subscription?.validity?.endDate) {
    const now = new Date();
    const endDate = new Date(firm.subscription.validity.endDate);
    
    if (now > endDate) {
      // Subscription expired - return Starter limits and trigger async downgrade
      console.warn(`Firm ${firm._id} has expired Pro subscription, treating as Starter`);
      
      // Trigger async downgrade (non-blocking)
      downgradeFirmToStarter(firm._id);
      
      // Return Starter limits immediately
      return PLAN_CONFIG['plan_ca_flow_free'];
    }
  }

  return limits;
}

/**
 * Downgrade firm to Starter plan asynchronously
 * @param {string} firmId - Firm ID
 */
function downgradeFirmToStarter(firmId) {
  setImmediate(async () => {
    try {
      const expiredFirm = await Firm.findById(firmId);
      
      // Double-check firm still needs downgrade
      if (!expiredFirm || expiredFirm.subscription?.planId !== 'plan_ca_flow_pro') {
        return;
      }
      
      // Preserve customer ID for future upgrades
      const razorpayCustomerId = expiredFirm.subscription.razorpayCustomerId;
      
      // Downgrade to Starter
      expiredFirm.subscription = {
        planId: 'plan_ca_flow_free',
        status: 'active',
        billingCycle: undefined,
        validity: undefined,
        razorpaySubscriptionId: undefined,
        razorpayCustomerId: razorpayCustomerId
      };
      
      await expiredFirm.save();
      
      console.log(`Auto-downgraded firm ${firmId} to Starter plan`);
    } catch (error) {
      console.error(`Failed to auto-downgrade firm ${firmId}:`, error.message);
    }
  });
}

/**
 * Get plan name for display
 * @param {string} planId - Plan identifier
 * @returns {string} Plan display name
 */
function getPlanName(planId) {
  const config = PLAN_CONFIG[planId];
  return config ? config.name : 'Unknown';
}

/**
 * Check if plan is Pro
 * @param {string} planId - Plan identifier
 * @returns {boolean} True if Pro plan
 */
function isProPlan(planId) {
  return planId === 'plan_ca_flow_pro';
}

// ============================================
// DATE & BILLING CALCULATIONS
// ============================================

/**
 * Get start of current month (for monthly limit calculations)
 * @returns {Date} Start of current month (1st day, 00:00:00)
 */
function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get days until next month (for UI display)
 * @returns {number} Days remaining in current month
 */
function getDaysUntilMonthReset() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diffTime = nextMonth - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate next billing date based on billing period
 * @param {Date} currentDate - Current date
 * @param {string} billingPeriod - 'monthly', 'quarterly', 'half-yearly', 'yearly'
 * @returns {Date} Next billing date
 */
function calculateNextBillingDate(currentDate, billingPeriod) {
  const date = new Date(currentDate);

  switch (billingPeriod) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'half-yearly':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date;
}

/**
 * Format billing cycle for display
 * @param {string} billingCycle - 'monthly', 'quarterly', 'half-yearly'
 * @returns {string} Formatted billing cycle
 */
function formatBillingCycle(billingCycle) {
  const formats = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    'half-yearly': 'Half-Yearly',
    yearly: 'Yearly'
  };
  return formats[billingCycle] || billingCycle;
}

/**
 * Get billing display info (price and period)
 * @param {Object} firm - Firm document
 * @returns {Object} { price, period }
 */
function resolveBillingDisplay(firm) {
  const planId = firm.subscription?.planId || 'plan_ca_flow_free';

  if (planId !== 'plan_ca_flow_pro') {
    return { price: 0, period: 'forever' };
  }

  // For Pro plan, we need to look up the actual billing amount
  // This is a simplified version - in production, you'd fetch from Subscription model
  const billingCycle = firm.subscription?.billingCycle || 'monthly';
  
  const priceMap = {
    monthly: 349,
    quarterly: 799,
    'half-yearly': 1299
  };

  const periodMap = {
    monthly: 'month',
    quarterly: 'quarter',
    'half-yearly': 'half-year'
  };

  return {
    price: priceMap[billingCycle] || 349,
    period: periodMap[billingCycle] || 'month'
  };
}

// ============================================
// FIRM & USAGE QUERIES
// ============================================

/**
 * Get firm with subscription data
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>} Firm document
 */
async function getFirmWithSubscription(firmId) {
  const firm = await Firm.findById(firmId);
  if (!firm) {
    throw new AuthorizationError('Firm not found');
  }
  return firm;
}

/**
 * Get usage statistics for a firm
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>} Usage statistics
 */
async function getFirmUsageStats(firmId) {
  const firm = await getFirmWithSubscription(firmId);
  const planId = firm.subscription?.planId || 'plan_ca_flow_free';
  const limits = getPlanLimits(firm);

  const monthStart = getMonthStart();
  const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1, 0, 0, 0, 0);

  // Get current usage counts in parallel
  const [clientCount, documentCount, paymentCount] = await Promise.all([
    Client.countDocuments({ firmId: firm._id, isDeleted: false }),
    Document.countDocuments({ 
      firmId: firm._id, 
      isDeleted: false, 
      createdAt: { $gte: monthStart } 
    }),
    Payment.countDocuments({
      firmId: firm._id,
      paymentType: { $in: ['invoice', 'document', 'chat-message'] },
      createdAt: { $gte: monthStart }
    })
  ]);

  const { price, period } = resolveBillingDisplay(firm);

  // Get active subscription payment if Pro
  let activeSubscription = null;
  if (planId === 'plan_ca_flow_pro') {
    activeSubscription = await Payment.findOne({
      firmId: firm._id,
      paymentType: 'subscription',
      subscriptionStatus: { $in: ['active', 'authenticated'] }
    })
    .populate('planId', 'planName billingPeriod')
    .sort({ createdAt: -1 });
  }

  return {
    plan: {
      id: planId,
      name: limits.name,
      price,
      period
    },
    limits: {
      clients: {
        used: clientCount,
        total: limits.maxClients,
        percentage: Math.round((clientCount / limits.maxClients) * 100)
      },
      documents: {
        used: documentCount,
        total: limits.monthlyRecords,
        percentage: Math.round((documentCount / limits.monthlyRecords) * 100),
        resetsAt: nextMonthStart
      },
      payments: {
        used: paymentCount,
        total: limits.monthlyRecords,
        percentage: Math.round((paymentCount / limits.monthlyRecords) * 100),
        resetsAt: nextMonthStart
      }
    },
    notifications: {
      allowed: limits.notifications,
      email: true,
      whatsapp: limits.notifications.includes('whatsapp'),
      sms: limits.notifications.includes('sms')
    },
    status: firm.subscription?.status || 'active',
    validity: firm.subscription?.validity || null,
    activeSubscription: activeSubscription ? {
      id: activeSubscription._id,
      planName: activeSubscription.planId?.planName,
      billingCycle: activeSubscription.billingPeriod,
      nextBillingDate: activeSubscription.nextBillingDate,
      paidCount: activeSubscription.paidCount,
      totalCount: activeSubscription.totalCount
    } : null
  };
}

// ============================================
// LIMIT ENFORCEMENT
// ============================================

/**
 * Get model by type (for monthly limit checks)
 * @param {string} modelType - 'Document' or 'Payment'
 * @returns {Model} Mongoose model
 */
function getModelByType(modelType) {
  switch (modelType) {
    case 'Document':
      return Document;
    case 'Payment':
      return Payment;
    default:
      throw new Error(`Unknown model type: ${modelType}`);
  }
}

/**
 * Resolve monthly usage for a model type
 * @param {string} firmId - Firm ID
 * @param {string} modelType - 'Document' or 'Payment'
 * @returns {Promise<Object>} Usage data
 */
async function resolveMonthlyUsage(firmId, modelType) {
  const firm = await getFirmWithSubscription(firmId);
  const limits = getPlanLimits(firm);
  const Model = getModelByType(modelType);
  const monthStart = getMonthStart();

  const query = {
    firmId: firm._id,
    createdAt: { $gte: monthStart }
  };

  if (modelType === 'Document') {
    query.isDeleted = false;
  }

  if (modelType === 'Payment') {
    query.paymentType = { $in: ['invoice', 'document', 'chat-message'] };
  }

  const monthlyCount = await Model.countDocuments(query);

  return {
    firm,
    limits,
    monthStart,
    monthlyCount,
    planId: firm.subscription?.planId || 'plan_ca_flow_free'
  };
}

/**
 * Assert monthly limit is not exceeded
 * Throws AuthorizationError if limit reached
 * 
 * @param {Object} params
 * @param {string} params.firmId - Firm ID
 * @param {string} params.modelType - 'Document' or 'Payment'
 * @param {number} params.increment - Number of items to add (default: 0)
 * @returns {Promise<Object>} Usage data if allowed
 */
async function assertMonthlyLimit({ firmId, modelType, increment = 0 }) {
  if (!firmId) {
    throw new AuthorizationError('Please complete your firm profile first');
  }

  const { limits, monthlyCount, monthStart, planId } = await resolveMonthlyUsage(firmId, modelType);
  const projectedCount = monthlyCount + increment;
  const limitReached = increment === 0
    ? monthlyCount >= limits.monthlyRecords
    : projectedCount > limits.monthlyRecords;

  if (limitReached) {
    const planName = planId === 'plan_ca_flow_pro' ? 'Pro' : 'Starter';
    const resourceName = modelType.toLowerCase() + 's';
    const remaining = Math.max(0, limits.monthlyRecords - monthlyCount);
    const actionVerb = modelType === 'Document' ? 'upload' : 'create';

    throw new AuthorizationError(
      `Monthly ${resourceName} limit reached (${monthlyCount}/${limits.monthlyRecords}). ` +
      `You can ${actionVerb} ${remaining} more ${modelType.toLowerCase()}(s). ` +
      `You are on the ${planName} plan. ` +
      (planId === 'plan_ca_flow_free'
        ? 'Upgrade to Pro for up to 500 records/month.'
        : 'Wait for the next billing cycle or contact support.') +
      ` Limits reset on the 1st of each month.`
    );
  }

  return { limits, monthlyCount, monthStart };
}

/**
 * Assert client limit is not exceeded
 * Throws AuthorizationError if limit reached
 * 
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>} Usage data if allowed
 */
async function assertClientLimit(firmId) {
  if (!firmId) {
    throw new AuthorizationError('Please complete your firm profile first');
  }

  const firm = await getFirmWithSubscription(firmId);
  const limits = getPlanLimits(firm);
  const planId = firm.subscription?.planId || 'plan_ca_flow_free';

  const clientCount = await Client.countDocuments({
    firmId: firm._id,
    isDeleted: false
  });

  if (clientCount >= limits.maxClients) {
    const planName = planId === 'plan_ca_flow_pro' ? 'Pro' : 'Starter';

    throw new AuthorizationError(
      `Client limit reached (${clientCount}/${limits.maxClients}). ` +
      `You are on the ${planName} plan. ` +
      (planId === 'plan_ca_flow_free'
        ? 'Upgrade to Pro for up to 100 clients.'
        : 'Contact support for enterprise options.')
    );
  }

  return { limits, clientCount };
}

// ============================================
// NOTIFICATION PERMISSIONS
// ============================================

/**
 * Check if notification channel is allowed for firm's plan
 * @param {string} firmId - Firm ID
 * @param {string} channel - 'email', 'whatsapp', or 'sms'
 * @returns {Promise<boolean>} True if channel is allowed
 */
async function isNotificationChannelAllowed(firmId, channel) {
  try {
    const firm = await getFirmWithSubscription(firmId);
    const limits = getPlanLimits(firm);
    return limits.notifications.includes(channel);
  } catch (error) {
    console.error('Error checking notification channel:', error.message);
    return channel === 'email'; // Default to email only on error
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Plan configuration
  getPlanLimits,
  getPlanName,
  isProPlan,
  
  // Date & billing
  getMonthStart,
  getDaysUntilMonthReset,
  calculateNextBillingDate,
  formatBillingCycle,
  resolveBillingDisplay,
  
  // Firm & usage
  getFirmWithSubscription,
  getFirmUsageStats,
  
  // Limit enforcement
  resolveMonthlyUsage,
  assertMonthlyLimit,
  assertClientLimit,
  
  // Notifications
  isNotificationChannelAllowed
};

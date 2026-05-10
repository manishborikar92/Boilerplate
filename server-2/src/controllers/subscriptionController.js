/**
 * Subscription Controller (REFACTORED)
 * 
 * Handles subscription-related operations for CA Flow
 * 
 * Last Updated: January 29, 2026
 * Version: 5.0 - Refactored for clarity and maintainability
 * 
 * RESPONSIBILITIES:
 * - Manage subscription plans (list, get)
 * - Handle subscription purchases and upgrades
 * - Process subscription cancellations
 * - Track subscription usage and limits
 * - Coordinate with Razorpay for billing
 * - Update firm subscription status (called by webhooks)
 */

const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const Firm = require('../models/Firm');
const razorpayService = require('../services/razorpayService');
const subscriptionService = require('../services/subscriptionService');
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../utils/errorHandler');
const { logger } = require('../middleware/logger');

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * @desc    Get all subscription plans (Pro billing options)
 * @route   GET /api/subscriptions/plans
 * @access  Public
 */
exports.getPlans = asyncHandler(async (req, res) => {
  const plans = await Subscription.find({ 
    isActive: true, 
    isDeleted: false,
    billingPeriod: { $in: ['monthly', 'quarterly'] }
  }).sort({ amount: 1 });

  res.json({
    success: true,
    data: { plans }
  });
});

/**
 * @desc    Get single plan by ID
 * @route   GET /api/subscriptions/plans/:id
 * @access  Public
 */
exports.getPlan = asyncHandler(async (req, res) => {
  const plan = await Subscription.findById(req.params.id);

  if (!plan || plan.isDeleted) {
    throw new NotFoundError('Plan not found');
  }

  res.json({
    success: true,
    data: { plan }
  });
});

// ============================================
// PROTECTED ENDPOINTS - CA-Admin only
// ============================================

/**
 * @desc    Purchase/Upgrade subscription (from Starter to Pro)
 * @route   POST /api/subscriptions/purchase
 * @access  Private (CA-Admin only)
 * 
 * Request body:
 *   - planId: MongoDB ObjectId of the Subscription document (billing option)
 *   - totalCount: Number of billing cycles (default: 12)
 * 
 * Flow:
 * 1. Validate plan exists and has razorpayPlanId
 * 2. Check firm doesn't already have active Pro subscription
 * 3. Create/Get Razorpay customer
 * 4. Create Razorpay subscription
 * 5. Create Payment record for tracking
 * 6. Return subscription with payment URL
 * 7. Webhook will update Firm.subscription when payment succeeds
 */
exports.purchase = asyncHandler(async (req, res) => {
  const { planId, totalCount = 12 } = req.body;
  const userId = req.user._id;
  const firmId = req.user.firmId;

  // Validate inputs
  if (!planId) {
    throw new ValidationError('Plan ID is required');
  }

  if (!firmId) {
    throw new ValidationError('Please complete your firm profile before purchasing subscription');
  }

  // Normalize totalCount (1-120 billing cycles)
  const normalizedTotalCount = Math.max(1, Math.min(120, parseInt(totalCount, 10) || 12));

  // Get plan from database
  const plan = await Subscription.findById(planId);
  if (!plan || plan.isDeleted || !plan.isActive) {
    throw new NotFoundError('Plan not found or inactive');
  }

  // Half-yearly plan is temporarily deactivated
  if (plan.billingPeriod === 'half-yearly') {
    throw new ValidationError('The 6-month plan is temporarily unavailable. Please choose Monthly or Quarterly.');
  }

  // Validate Razorpay plan ID exists
  if (!plan.razorpayPlanId) {
    logger.error('Plan missing razorpayPlanId', { planId: plan._id, planName: plan.planName });
    throw new ValidationError('Plan is not configured for payments. Please contact support.');
  }

  // Get firm
  const firm = await Firm.findById(firmId);
  if (!firm) {
    throw new NotFoundError('Firm not found');
  }

  // Check for existing active Pro subscription
  if (firm.subscription?.planId === 'plan_ca_flow_pro' && firm.subscription?.status === 'active') {
    throw new ValidationError('You already have an active Pro subscription. Cancel it first to change billing cycle.');
  }

  // Check for pending subscription (prevent duplicate purchases)
  const existingPendingPayment = await Payment.findOne({
    firmId: firm._id,
    paymentType: 'subscription',
    subscriptionStatus: { $in: ['created', 'authenticated', 'pending'] }
  });

  if (existingPendingPayment) {
    return handleExistingPendingSubscription(existingPendingPayment, planId, res);
  }

  // Create or fetch Razorpay customer
  const razorpayCustomerId = await getOrCreateRazorpayCustomer(firm, userId);

  // Create Razorpay subscription
  const razorpaySubscription = await createRazorpaySubscription(
    plan,
    normalizedTotalCount,
    razorpayCustomerId,
    firm,
    userId
  );

  // Create payment record for tracking
  const payment = await createSubscriptionPaymentRecord(
    plan,
    razorpaySubscription,
    firm,
    userId,
    normalizedTotalCount,
    razorpayCustomerId
  );

  logger.info('Subscription purchase initiated', {
    paymentId: payment._id,
    firmId: firm._id,
    razorpaySubscriptionId: razorpaySubscription.id,
    planName: plan.planName
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created. Complete the payment to activate your Pro plan.',
    data: {
      payment,
      subscription: {
        id: razorpaySubscription.id,
        status: razorpaySubscription.status,
        short_url: razorpaySubscription.short_url,
        total_count: razorpaySubscription.total_count,
        paid_count: razorpaySubscription.paid_count,
        remaining_count: razorpaySubscription.remaining_count
      },
      keyId: process.env.RAZORPAY_KEY_ID
    }
  });
});

/**
 * @desc    Verify and sync subscription status from Razorpay
 * @route   POST /api/subscriptions/verify
 * @access  Private (CA-Admin only)
 * 
 * Request body:
 *   - subscriptionId: Razorpay subscription ID (optional)
 *   - paymentId: Payment record ID (optional)
 * 
 * This endpoint:
 * 1. Fetches subscription status from Razorpay
 * 2. Updates Payment record in our DB
 * 3. Activates firm subscription if payment successful
 * 4. Returns updated subscription status
 * 
 * Use cases:
 * - Called by client after Razorpay redirect (PRIMARY - solves webhook failure)
 * - Called manually if user reports subscription not activated
 * - Called by dashboard to sync status
 */
exports.verifySubscription = asyncHandler(async (req, res) => {
  const { subscriptionId, paymentId } = req.body;
  const firmId = req.user.firmId;

  if (!firmId) {
    throw new ValidationError('Please complete your firm profile first');
  }

  // Find payment record
  let payment;
  if (paymentId) {
    payment = await Payment.findById(paymentId);
  } else if (subscriptionId) {
    payment = await Payment.findOne({ razorpaySubscriptionId: subscriptionId });
  } else {
    // Find most recent pending subscription for this firm
    payment = await Payment.findOne({
      firmId: firmId,
      paymentType: 'subscription',
      subscriptionStatus: { $in: ['created', 'authenticated', 'pending'] }
    }).sort({ createdAt: -1 });
  }

  if (!payment) {
    throw new NotFoundError('Subscription payment not found');
  }

  // Verify firm ownership
  if (payment.firmId.toString() !== firmId.toString()) {
    throw new AuthorizationError('Not authorized to verify this subscription');
  }

  // Fetch latest status from Razorpay
  const razorpaySubscription = await razorpayService.getSubscription(
    payment.razorpaySubscriptionId
  );

  logger.info('Subscription verification initiated', {
    paymentId: payment._id,
    firmId: firmId,
    razorpaySubscriptionId: payment.razorpaySubscriptionId,
    currentStatus: payment.subscriptionStatus,
    razorpayStatus: razorpaySubscription.status
  });

  // Update payment record with latest data
  payment.subscriptionStatus = razorpaySubscription.status;
  payment.paidCount = razorpaySubscription.paid_count;
  payment.remainingCount = razorpaySubscription.remaining_count;
  payment.currentPeriodStart = razorpaySubscription.current_start 
    ? new Date(razorpaySubscription.current_start * 1000) 
    : null;
  payment.currentPeriodEnd = razorpaySubscription.current_end 
    ? new Date(razorpaySubscription.current_end * 1000) 
    : null;
  payment.nextBillingDate = razorpaySubscription.charge_at 
    ? new Date(razorpaySubscription.charge_at * 1000) 
    : null;
  payment.webhookData = razorpaySubscription;
  await payment.save();

  // Check if subscription is active/authenticated and firm needs activation
  const firm = await Firm.findById(firmId);
  
  // Razorpay subscription states:
  // - 'created': Subscription created but not authenticated
  // - 'authenticated': Payment method verified, ready to charge (ACTIVATE HERE)
  // - 'active': First payment successful (ACTIVATE HERE)
  // - 'pending': Payment pending
  const isSubscriptionReady = ['authenticated', 'active'].includes(razorpaySubscription.status);
  const needsActivation = 
    isSubscriptionReady && 
    firm.subscription?.planId !== 'plan_ca_flow_pro';

  logger.info('Subscription verification check', {
    firmId: firmId,
    razorpayStatus: razorpaySubscription.status,
    currentFirmPlan: firm.subscription?.planId,
    isSubscriptionReady,
    needsActivation
  });

  if (needsActivation) {
    // Activate firm subscription
    const plan = await Subscription.findById(payment.planId);
    
    await activateFirmSubscription(payment, plan, razorpaySubscription);
    
    logger.info('Firm subscription activated via verification', {
      firmId: firmId,
      paymentId: payment._id,
      razorpaySubscriptionId: payment.razorpaySubscriptionId,
      razorpayStatus: razorpaySubscription.status
    });

    // Update payment status
    payment.status = 'paid';
    if (!payment.paidAt) {
      payment.paidAt = new Date();
    }
    await payment.save();
  }

  res.json({
    success: true,
    message: needsActivation 
      ? 'Subscription verified and activated successfully' 
      : 'Subscription status synced',
    data: {
      payment,
      razorpaySubscription,
      firmActivated: needsActivation
    }
  });
});

/**
 * @desc    Cancel subscription
 * @route   POST /api/subscriptions/:id/cancel
 * @access  Private (CA-Admin only)
 * 
 * Request body:
 *   - cancelAtCycleEnd: boolean (default: true) - If true, cancel at end of billing cycle
 */
exports.cancel = asyncHandler(async (req, res) => {
  const { cancelAtCycleEnd = true } = req.body;
  const paymentId = req.params.id;
  const firmId = req.user.firmId;

  const payment = await Payment.findById(paymentId);

  if (!payment || payment.paymentType !== 'subscription') {
    throw new NotFoundError('Subscription not found');
  }

  // Authorization check
  if (payment.firmId.toString() !== firmId.toString()) {
    throw new AuthorizationError('Not authorized to cancel this subscription');
  }

  // Prevent cancelling already cancelled subscriptions
  if (payment.subscriptionStatus === 'cancelled') {
    throw new ValidationError('Subscription is already cancelled');
  }

  // Cancel on Razorpay
  if (payment.razorpaySubscriptionId) {
    try {
      await razorpayService.cancelSubscription(payment.razorpaySubscriptionId, cancelAtCycleEnd);
      logger.info('Razorpay subscription cancelled', { 
        subscriptionId: payment.razorpaySubscriptionId,
        cancelAtCycleEnd 
      });
    } catch (error) {
      logger.error('Razorpay cancellation failed', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        subscriptionId: payment.razorpaySubscriptionId
      });
      // Continue with local cancellation even if Razorpay fails
      // This handles cases where subscription doesn't exist (e.g., after account migration)
    }
  }

  // Update payment status
  payment.status = 'cancelled';
  payment.subscriptionStatus = 'cancelled';
  payment.billingHistory.push({
    date: new Date(),
    amount: 0,
    status: 'cancelled',
    notes: cancelAtCycleEnd 
      ? 'Subscription will end at current billing cycle' 
      : 'Subscription cancelled immediately'
  });
  await payment.save();

  // Revert Firm to Starter plan (immediate or at cycle end based on cancelAtCycleEnd)
  if (!cancelAtCycleEnd) {
    await deactivateFirmSubscription(payment);
  }

  res.json({
    success: true,
    message: cancelAtCycleEnd
      ? 'Subscription will be cancelled at the end of the current billing cycle. You can continue using Pro features until then.'
      : 'Subscription cancelled immediately. Your plan has been reverted to Starter.',
    data: { payment }
  });
});

/**
 * @desc    Get subscription details by Payment ID
 * @route   GET /api/subscriptions/:id
 * @access  Private (CA-Admin only)
 */
exports.getSubscription = asyncHandler(async (req, res) => {
  const paymentId = req.params.id;
  const firmId = req.user.firmId;

  const payment = await Payment.findById(paymentId)
    .populate('planId')
    .populate('createdBy', 'name email');

  if (!payment || payment.paymentType !== 'subscription') {
    throw new NotFoundError('Subscription not found');
  }

  // Authorization check
  if (payment.firmId.toString() !== firmId.toString()) {
    throw new AuthorizationError('Not authorized to view this subscription');
  }

  // Fetch latest status from Razorpay
  let razorpaySubscription = null;
  if (payment.razorpaySubscriptionId) {
    try {
      razorpaySubscription = await razorpayService.getSubscription(payment.razorpaySubscriptionId);

      // Sync status if different
      if (razorpaySubscription.status !== payment.subscriptionStatus) {
        payment.subscriptionStatus = razorpaySubscription.status;
        payment.paidCount = razorpaySubscription.paid_count;
        payment.remainingCount = razorpaySubscription.remaining_count;
        if (razorpaySubscription.current_end) {
          payment.currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
        }
        await payment.save();
        logger.info('Synced subscription status from Razorpay', { 
          paymentId: payment._id, 
          status: razorpaySubscription.status 
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch Razorpay subscription', { error: error.message });
    }
  }

  res.json({
    success: true,
    data: {
      payment,
      razorpaySubscription
    }
  });
});

/**
 * @desc    Get subscription usage stats for dashboard
 * @route   GET /api/subscriptions/usage
 * @access  Private (CA-Admin only)
 * 
 * Primary endpoint for SubscriptionSettings component
 */
exports.getUsage = asyncHandler(async (req, res) => {
  const firmId = req.user.firmId;

  if (!firmId) {
    throw new NotFoundError('Please complete your firm profile first');
  }

  const usage = await subscriptionService.getFirmUsageStats(firmId);

  res.json({
    success: true,
    data: usage
  });
});

// ============================================
// HELPER FUNCTIONS (Private)
// ============================================

/**
 * Handle existing pending subscription
 */
async function handleExistingPendingSubscription(existingPayment, newPlanId, res) {
  // If it's the same plan, return the existing one
  if (existingPayment.planId.toString() === newPlanId.toString()) {
    logger.info('Returning existing pending subscription for same plan', { 
      paymentId: existingPayment._id 
    });

    let subscriptionDetails = null;
    if (existingPayment.razorpaySubscriptionId) {
      try {
        subscriptionDetails = await razorpayService.getSubscription(
          existingPayment.razorpaySubscriptionId
        );
      } catch (error) {
        logger.warn('Failed to fetch existing subscription', { error: error.message });
      }
    }

    return res.json({
      success: true,
      message: 'You have a pending subscription. Please complete the payment.',
      data: {
        payment: existingPayment,
        keyId: process.env.RAZORPAY_KEY_ID,
        subscription: subscriptionDetails ? {
          id: subscriptionDetails.id,
          status: subscriptionDetails.status,
          short_url: subscriptionDetails.short_url,
          total_count: subscriptionDetails.total_count,
          paid_count: subscriptionDetails.paid_count
        } : null
      }
    });
  }

  // If it's a different plan, cancel the old one and proceed
  logger.info('Cancelling old pending subscription to switch plans', {
    oldPaymentId: existingPayment._id,
    newPlanId: newPlanId
  });

  if (existingPayment.razorpaySubscriptionId) {
    try {
      await razorpayService.cancelSubscription(existingPayment.razorpaySubscriptionId, false);
    } catch (error) {
      logger.warn('Failed to cancel old Razorpay subscription during plan switch', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code
      });
      // Continue with local cancellation even if Razorpay fails
      // This handles cases where subscription doesn't exist in new Razorpay account
    }
  }

  existingPayment.status = 'cancelled';
  existingPayment.subscriptionStatus = 'cancelled';
  
  // Initialize notes Map if it doesn't exist
  if (!existingPayment.notes) {
    existingPayment.notes = new Map();
  }
  existingPayment.notes.set('cancelReason', 'User switched to a different plan');
  await existingPayment.save();

  // Return null to indicate we should proceed with creating new subscription
  return null;
}

/**
 * Get or create Razorpay customer for firm
 */
async function getOrCreateRazorpayCustomer(firm, userId) {
  let razorpayCustomerId = firm.subscription?.razorpayCustomerId || null;
  
  if (!razorpayCustomerId) {
    try {
      const customer = await razorpayService.createCustomer({
        name: firm.firmName,
        email: firm.officialEmail,
        contact: firm.contactNumber,
        notes: {
          firmId: firm._id.toString(),
          adminId: userId.toString()
        }
      });
      razorpayCustomerId = customer.id;
      
      // Save customer ID to firm for future use
      if (!firm.subscription) {
        firm.subscription = {};
      }
      firm.subscription.razorpayCustomerId = razorpayCustomerId;
      await firm.save();
      
      logger.info('Created Razorpay customer', { 
        customerId: razorpayCustomerId, 
        firmId: firm._id 
      });
    } catch (error) {
      logger.warn('Customer creation failed, proceeding without customer', { 
        error: error.message 
      });
    }
  }

  return razorpayCustomerId;
}

/**
 * Create Razorpay subscription
 */
async function createRazorpaySubscription(plan, totalCount, customerId, firm, userId) {
  try {
    return await razorpayService.createSubscription({
      planId: plan.razorpayPlanId,
      totalCount: totalCount,
      quantity: 1,
      customerId: customerId,
      notes: {
        firmId: firm._id.toString(),
        adminId: userId.toString(),
        subscriptionPlanId: plan._id.toString(),
        billingCycle: plan.billingPeriod,
        planName: plan.planName
      }
    });
  } catch (error) {
    logger.error('Failed to create Razorpay subscription', { 
      error: error.message, 
      planId: plan.razorpayPlanId,
      firmId: firm._id 
    });
    throw new ValidationError(`Failed to create subscription: ${error.message}`);
  }
}

/**
 * Create payment record for subscription tracking
 */
async function createSubscriptionPaymentRecord(
  plan, 
  razorpaySubscription, 
  firm, 
  userId, 
  totalCount,
  customerId
) {
  const subscriptionStartDate = new Date();
  const nextBillingDate = subscriptionService.calculateNextBillingDate(
    subscriptionStartDate, 
    plan.billingPeriod
  );

  return await Payment.create({
    paymentType: 'subscription',
    clientId: firm._id, // For firm subscriptions, clientId references the firm
    firmId: firm._id,
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayCustomerId: customerId,
    amount: plan.amount,
    description: `Pro Subscription: ${plan.planName} (${plan.billingPeriod})`,
    planId: plan._id,
    billingPeriod: plan.billingPeriod,
    status: 'created',
    subscriptionStatus: razorpaySubscription.status,
    totalCount: totalCount,
    paidCount: 0,
    remainingCount: totalCount,
    subscriptionStartAt: subscriptionStartDate,
    nextBillingDate: nextBillingDate,
    currentPeriodStart: razorpaySubscription.current_start 
      ? new Date(razorpaySubscription.current_start * 1000) 
      : null,
    currentPeriodEnd: razorpaySubscription.current_end 
      ? new Date(razorpaySubscription.current_end * 1000) 
      : null,
    createdBy: userId
  });
}

// ============================================
// WEBHOOK HELPER FUNCTIONS
// Called by paymentController webhook handlers
// ============================================

/**
 * Activate firm subscription after successful payment
 * Called by webhook handlers when subscription payment succeeds
 * 
 * @param {Object} payment - Payment record
 * @param {Object} subscription - Subscription plan from db
 * @param {Object} razorpayData - Razorpay webhook data
 */
async function activateFirmSubscription(payment, subscription, razorpayData) {
  try {
    const firm = await Firm.findById(payment.firmId);
    if (!firm) {
      logger.error('Firm not found for subscription activation', { firmId: payment.firmId });
      return null;
    }

    const startDate = new Date();
    const endDate = subscriptionService.calculateNextBillingDate(
      startDate, 
      subscription?.billingPeriod || 'monthly'
    );

    // Update Firm's subscription to Pro
    firm.subscription = {
      planId: 'plan_ca_flow_pro',
      status: 'active',
      billingCycle: subscription?.billingPeriod || 'monthly',
      validity: {
        startDate: startDate,
        endDate: endDate
      },
      razorpaySubscriptionId: razorpayData?.id || payment.razorpaySubscriptionId,
      razorpayCustomerId: payment.razorpayCustomerId
    };

    await firm.save();
    
    logger.info('Firm subscription activated', {
      firmId: firm._id,
      planId: 'plan_ca_flow_pro',
      billingCycle: subscription?.billingPeriod,
      razorpaySubscriptionId: razorpayData?.id
    });

    return firm;
  } catch (error) {
    logger.error('Error activating firm subscription', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Deactivate firm subscription (revert to Starter)
 * Called when subscription expires, is cancelled, or halted
 * 
 * @param {Object} payment - Payment record
 */
async function deactivateFirmSubscription(payment) {
  try {
    const firm = await Firm.findById(payment.firmId);
    if (!firm) {
      logger.error('Firm not found for subscription deactivation', { firmId: payment.firmId });
      return null;
    }

    // Revert to Starter plan
    firm.subscription = {
      planId: 'plan_ca_flow_free',
      status: 'active',
      billingCycle: undefined,
      validity: undefined,
      razorpaySubscriptionId: undefined,
      razorpayCustomerId: firm.subscription?.razorpayCustomerId // Keep customer ID
    };

    await firm.save();
    
    logger.info('Firm subscription deactivated', {
      firmId: firm._id,
      previousSubscriptionId: payment.razorpaySubscriptionId
    });

    return firm;
  } catch (error) {
    logger.error('Error deactivating firm subscription', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Update firm subscription validity (for renewals)
 * Called when subscription is charged for a new billing cycle
 * 
 * @param {Object} payment - Payment record
 */
async function renewFirmSubscription(payment) {
  try {
    const firm = await Firm.findById(payment.firmId);
    if (!firm) {
      logger.error('Firm not found for subscription renewal', { firmId: payment.firmId });
      return null;
    }

    // Only update if currently on Pro plan
    if (firm.subscription?.planId !== 'plan_ca_flow_pro') {
      logger.warn('Firm not on Pro plan during renewal', { firmId: firm._id });
      return null;
    }

    const startDate = new Date();
    const endDate = subscriptionService.calculateNextBillingDate(
      startDate, 
      payment.billingPeriod
    );

    // Update validity dates
    firm.subscription.status = 'active';
    firm.subscription.validity = {
      startDate: startDate,
      endDate: endDate
    };

    await firm.save();
    
    logger.info('Firm subscription renewed', {
      firmId: firm._id,
      newEndDate: endDate
    });

    return firm;
  } catch (error) {
    logger.error('Error renewing firm subscription', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

// Export functions
exports.activateFirmSubscription = activateFirmSubscription;
exports.deactivateFirmSubscription = deactivateFirmSubscription;
exports.renewFirmSubscription = renewFirmSubscription;

module.exports = exports;

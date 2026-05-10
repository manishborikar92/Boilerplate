const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Firm = require('../models/Firm');
const razorpayService = require('../services/razorpayService');
const { initiatePaymentOrder, markChatMessagePaymentPaid } = require('../services/chatMessagePaymentService');
const notificationService = require('../services/notificationService');
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../utils/errorHandler');
const { logger } = require('../middleware/logger');

/**
 * @desc    Verify payment
 * @route   POST /api/payments/verify
 * @access  Public (webhook or client callback)
 */
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ValidationError('Missing payment verification parameters');
  }

  // Verify signature
  const isValid = razorpayService.verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature
  });

  if (!isValid) {
    throw new ValidationError('Invalid payment signature');
  }

  // Find payment by order ID
  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Get payment details from Razorpay
  const paymentDetails = await razorpayService.getPayment(razorpay_payment_id);

  // Update payment status
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.status = 'paid';
  payment.paidAt = new Date();
  payment.paymentMethod = paymentDetails.method;
  payment.webhookData = paymentDetails;
  await payment.save();

  if (payment.paymentType === 'chat-message') {
    await markChatMessagePaymentPaid(payment);
  }

  // Create payment notification (non-blocking)
  try {
    if (!payment.clientId) return;

    const client = await Client.findById(payment.clientId);
    if (client) {
      await notificationService.notifyPaymentReceived(payment, client);
    }
  } catch (notificationError) {
    // Silently fail - notification errors should not break payment verification
  }

  res.json({
    success: true,
    message: 'Payment verified successfully',
    data: { payment }
  });
});

/**
 * @desc    Initiate payment order for chat message payment (Razorpay)
 * @route   POST /api/payments/initiate-order
 * @access  Private (Client)
 */
exports.initiatePaymentOrder = asyncHandler(async (req, res) => {
  const { threadId, messageId } = req.body;
  const result = await initiatePaymentOrder({ user: req.user, threadId, messageId });

  res.status(201).json({
    success: true,
    message: 'Payment initiated successfully',
    data: {
      payment: result.payment,
      razorpayOrder: result.razorpayOrder,
      keyId: result.keyId
    }
  });
});

/**
 * @desc    Get all payments for firm
 * @route   GET /api/payments
 * @access  Private (CA-Admin)
 */
exports.getPayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    clientId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const query = { firmId: req.user.firmId, isActive: true };

  if (clientId) query.clientId = clientId;

  if (search) {
    const searchText = String(search).trim();
    if (searchText) {
      const rx = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const clientMatches = await Client.find({
        firmId: req.user.firmId,
        $or: [
          { companyName: rx },
          { email: rx },
          { phoneNumber: rx },
          { userId: rx }
        ]
      }).select('_id');

      const clientIds = clientMatches.map((c) => c._id);

      query.$or = [
        { description: rx },
        { invoiceNumber: rx },
        { razorpayOrderId: rx },
        { razorpayPaymentId: rx },
        { razorpayInvoiceId: rx },
        { razorpayPaymentLinkId: rx }
      ];

      if (clientIds.length > 0) {
        query.$or.push({ clientId: { $in: clientIds } });
      }
    }
  }

  const allowedSortFields = ['createdAt', 'paidAt', 'amount'];
  if (!allowedSortFields.includes(sortBy)) throw new ValidationError('Invalid sortBy');
  const normalizedSortOrder = String(sortOrder).toLowerCase();
  if (!['asc', 'desc'].includes(normalizedSortOrder)) throw new ValidationError('Invalid sortOrder');
  const sort = { [sortBy]: normalizedSortOrder === 'asc' ? 1 : -1 };

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);

  const payments = await Payment.find(query)
    .select('-webhookData -billingHistory')
    .populate('clientId', 'companyName email phoneNumber userId')
    .populate('createdBy', 'name email')
    .sort(sort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber);

  const count = await Payment.countDocuments(query);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        total: count,
        page: pageNumber,
        pages: Math.ceil(count / limitNumber),
        limit: limitNumber
      }
    }
  });
});

/**
 * @desc    Get single payment
 * @route   GET /api/payments/:id
 * @access  Private (CA-Admin or Client)
 */
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('clientId', 'companyName email phoneNumber userId')
    .populate('createdBy', 'name email')
    .populate('planId');

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Authorization check
  if (req.user.role === 'CA-Admin') {
    if (payment.firmId.toString() !== req.user.firmId.toString()) {
      throw new AuthorizationError('Not authorized to access this payment');
    }
  } else if (req.user.role === 'Client') {
    const client = await Client.findOne({ userAccountId: req.user._id });
    // Handle both populated and non-populated clientId
    const paymentClientId = payment.clientId._id ? payment.clientId._id.toString() : payment.clientId.toString();
    if (!client || paymentClientId !== client._id.toString()) {
      throw new AuthorizationError('Not authorized to access this payment');
    }
  }

  res.json({
    success: true,
    data: { payment }
  });
});

/**
 * @desc    Get client payments
 * @route   GET /api/payments/client/my-payments
 * @access  Private (Client)
 */
exports.getMyPayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Get client
  const client = await Client.findOne({ userAccountId: req.user._id });
  if (!client) {
    throw new NotFoundError('Client profile not found');
  }

  const query = { clientId: client._id, isActive: true };

  if (search) {
    const searchText = String(search).trim();
    if (searchText) {
      const rx = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { description: rx },
        { invoiceNumber: rx },
        { razorpayOrderId: rx },
        { razorpayPaymentId: rx },
        { razorpayInvoiceId: rx },
        { razorpayPaymentLinkId: rx }
      ];
    }
  }

  const allowedSortFields = ['createdAt', 'paidAt', 'amount'];
  if (!allowedSortFields.includes(sortBy)) throw new ValidationError('Invalid sortBy');
  const normalizedSortOrder = String(sortOrder).toLowerCase();
  if (!['asc', 'desc'].includes(normalizedSortOrder)) throw new ValidationError('Invalid sortOrder');
  const sort = { [sortBy]: normalizedSortOrder === 'asc' ? 1 : -1 };

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);

  const payments = await Payment.find(query)
    .select('-webhookData -billingHistory')
    .populate('createdBy', 'name email')
    .populate('planId')
    .sort(sort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber);

  const count = await Payment.countDocuments(query);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        total: count,
        page: pageNumber,
        pages: Math.ceil(count / limitNumber),
        limit: limitNumber
      }
    }
  });
});

/**
 * @desc    Razorpay webhook handler
 * @route   POST /api/payments/webhook
 * @access  Public (Razorpay webhook)
 * 
 * Best Practices Implemented:
 * - Signature verification for security
 * - Idempotency using x-razorpay-event-id to prevent duplicate processing
 * - Comprehensive event handling for all subscription lifecycle events
 * - Proper error handling and logging
 */
exports.handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const eventId = req.headers['x-razorpay-event-id'];

  const rawBody = req.rawBody || req.body;

  const isValid = razorpayService.verifyWebhookSignature(
    rawBody,
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET
  );

  if (!isValid) {
    throw new ValidationError('Invalid webhook signature');
  }

  let parsed = req.body;
  if (Buffer.isBuffer(rawBody)) {
    parsed = JSON.parse(rawBody.toString('utf8'));
  }
  const event = parsed.event;
  const payload = parsed.payload;
  if (!event || !payload) {
    throw new ValidationError('Invalid webhook payload');
  }

  logger.info('Webhook received', { event, eventId });

  // Idempotency check: Prevent duplicate processing using event ID
  if (eventId && await isEventAlreadyProcessed(eventId)) {
    return res.json({ success: true, message: 'Event already processed' });
  }

  try {
    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity, eventId);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity, eventId);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(payload.subscription.entity, payload.payment?.entity, eventId);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload.subscription.entity, payload.payment.entity, eventId);
        break;

      case 'subscription.pending':
        await handleSubscriptionPending(payload.subscription.entity, eventId);
        break;

      case 'subscription.halted':
        await handleSubscriptionHalted(payload.subscription.entity, eventId);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload.subscription.entity, eventId);
        break;

      case 'subscription.completed':
        await handleSubscriptionCompleted(payload.subscription.entity, eventId);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(payload.subscription.entity, eventId);
        break;

      case 'subscription.resumed':
        await handleSubscriptionResumed(payload.subscription.entity, eventId);
        break;

      case 'subscription.authenticated':
        await handleSubscriptionAuthenticated(payload.subscription.entity, eventId);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(payload.subscription.entity, eventId);
        break;

      default:
        logger.info('Unhandled webhook event', { event });
    }

    logger.info('Webhook processed successfully', { event, eventId });
  } catch (error) {
    logger.error('Webhook processing error', { 
      event, 
      eventId, 
      error: error.message, 
      stack: error.stack 
    });
  }

  res.json({ success: true });
});

const shouldProcessSubscriptionEvent = (payment, subscriptionEntity) => {
  if (!payment || !subscriptionEntity) return false;
  if (!subscriptionEntity.updated_at || !payment.webhookData?.updated_at) return true;
  return subscriptionEntity.updated_at >= payment.webhookData.updated_at;
};

// ============================================
// WEBHOOK HELPER FUNCTIONS (REFACTORED)
// ============================================

/**
 * Check if event has already been processed (idempotency)
 */
async function isEventAlreadyProcessed(eventId) {
  if (!eventId) return false;
  const existingEvent = await Payment.findOne({ webhookEventIds: eventId });
  return !!existingEvent;
}

/**
 * Update payment with webhook data and event ID
 */
async function updatePaymentWebhookData(payment, webhookData, eventId) {
  payment.webhookData = { ...webhookData, eventId };
  if (eventId && !payment.webhookEventIds?.includes(eventId)) {
    payment.webhookEventIds = [...(payment.webhookEventIds || []), eventId];
  }
  await payment.save();
}

/**
 * Find payment by Razorpay subscription ID
 */
async function findPaymentBySubscriptionId(subscriptionId) {
  return await Payment.findOne({ razorpaySubscriptionId: subscriptionId });
}

/**
 * Add entry to payment billing history
 */
async function addBillingHistoryEntry(payment, entry) {
  payment.billingHistory.push({
    date: new Date(),
    ...entry
  });
  await payment.save();
}

/**
 * Send payment notification (non-blocking)
 */
async function sendPaymentNotification(payment, type) {
  try {
    if (!payment.clientId) return;
    
    const client = await Client.findById(payment.clientId);
    if (!client) return;
    
    switch (type) {
      case 'received':
        await notificationService.notifyPaymentReceived(payment, client);
        break;
      case 'failed':
        await notificationService.notifyPaymentFailed(payment, client);
        break;
    }
  } catch (error) {
    // Silently fail - notification errors should not break payment processing
  }
}

/**
 * Send subscription notification (non-blocking)
 */
async function sendSubscriptionNotification(payment, type) {
  try {
    const Subscription = require('../models/Subscription');
    
    const plan = await Subscription.findById(payment.planId);
    if (!plan) return;
    
    if (type === 'activated') {
      await notificationService.notifySubscriptionActivated(payment, plan);
    }
  } catch (error) {
    // Silently fail
  }
}

/**
 * Unlock documents after payment
 */
async function unlockDocuments(payment) {
  if (payment.paymentType !== 'document' || !payment.documentIds?.length) {
    return;
  }
  
  const Document = require('../models/Document');
  await Document.updateMany(
    { _id: { $in: payment.documentIds } },
    {
      $set: {
        isPaid: true,
        paidAt: new Date(),
        paymentId: payment._id
      }
    }
  );
  console.log(`[Webhook] Unlocked ${payment.documentIds.length} documents for payment ${payment._id}`);
}

/**
 * Update firm revenue and client stats (non-subscription payments only)
 */
async function updateFirmAndClientStats(payment) {
  if (payment.paymentType === 'subscription') {
    return; // Don't count subscription payments as revenue
  }
  
  try {
    const firm = await Firm.findById(payment.firmId);
    if (firm) {
      await firm.addRevenue(payment.amount);
    }
    
    const client = await Client.findById(payment.clientId);
    if (client) {
      await client.addPayment(payment.amount);
    }
  } catch (error) {
    console.error('[Webhook] Error updating firm/client stats:', error);
  }
}

// Helper functions for webhook handlers
async function handlePaymentCaptured(paymentEntity, eventId) {
  const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
  if (!payment) return;
  
  // Update payment status
  payment.razorpayPaymentId = paymentEntity.id;
  payment.status = 'paid';
  payment.paidAt = new Date(paymentEntity.created_at * 1000);
  payment.paymentMethod = paymentEntity.method;
  await updatePaymentWebhookData(payment, paymentEntity, eventId);
  
  // Handle payment type specific logic
  if (payment.paymentType === 'chat-message') {
    await markChatMessagePaymentPaid(payment);
  }
  
  await unlockDocuments(payment);
  await updateFirmAndClientStats(payment);
  await sendPaymentNotification(payment, 'received');
  
  logger.info('Payment captured', { 
    paymentId: payment._id, 
    amount: payment.amount,
    type: payment.paymentType 
  });
}

async function handlePaymentFailed(paymentEntity, eventId) {
  const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
  if (!payment) return;
  
  payment.status = 'failed';
  await updatePaymentWebhookData(payment, paymentEntity, eventId);
  await sendPaymentNotification(payment, 'failed');
  
  logger.warn('Payment failed', { 
    paymentId: payment._id, 
    razorpayPaymentId: paymentEntity.id 
  });
}

async function handleSubscriptionActivated(subscriptionEntity, paymentEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  // Update payment status
  payment.subscriptionStatus = 'active';
  payment.status = 'paid';
  payment.paidCount = subscriptionEntity.paid_count || 1;
  payment.remainingCount = subscriptionEntity.remaining_count;
  payment.currentPeriodStart = subscriptionEntity.current_start 
    ? new Date(subscriptionEntity.current_start * 1000) 
    : null;
  payment.currentPeriodEnd = subscriptionEntity.current_end 
    ? new Date(subscriptionEntity.current_end * 1000) 
    : null;
  payment.nextBillingDate = subscriptionEntity.charge_at 
    ? new Date(subscriptionEntity.charge_at * 1000) 
    : null;
  
  if (paymentEntity) {
    payment.razorpayPaymentId = paymentEntity.id;
    payment.paidAt = new Date(paymentEntity.created_at * 1000);
    payment.paymentMethod = paymentEntity.method;
  }
  
  await addBillingHistoryEntry(payment, {
    amount: subscriptionEntity.amount || payment.amount,
    status: 'paid',
    razorpayPaymentId: paymentEntity?.id,
    notes: 'Subscription activated - First payment successful'
  });
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription activated', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    firmId: payment.firmId 
  });
  
  // Activate firm subscription
  try {
    const subscriptionController = require('./subscriptionController');
    const Subscription = require('../models/Subscription');
    const subscription = await Subscription.findById(payment.planId);
    await subscriptionController.activateFirmSubscription(payment, subscription, subscriptionEntity);
  } catch (activationError) {
    logger.error('Failed to activate firm subscription', { error: activationError.message });
  }
  
  await sendSubscriptionNotification(payment, 'activated');
}

async function handleSubscriptionCharged(subscriptionEntity, paymentEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  // Update subscription details
  payment.subscriptionStatus = subscriptionEntity.status;
  payment.paidCount = subscriptionEntity.paid_count;
  payment.remainingCount = subscriptionEntity.remaining_count;
  payment.currentPeriodStart = subscriptionEntity.current_start 
    ? new Date(subscriptionEntity.current_start * 1000) 
    : null;
  payment.currentPeriodEnd = subscriptionEntity.current_end 
    ? new Date(subscriptionEntity.current_end * 1000) 
    : null;
  payment.nextBillingDate = subscriptionEntity.charge_at 
    ? new Date(subscriptionEntity.charge_at * 1000) 
    : null;
  
  await addBillingHistoryEntry(payment, {
    amount: paymentEntity.amount,
    status: 'paid',
    razorpayPaymentId: paymentEntity.id,
    notes: `Recurring payment ${subscriptionEntity.paid_count} of ${subscriptionEntity.total_count}`
  });
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription charged', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    cycle: `${subscriptionEntity.paid_count}/${subscriptionEntity.total_count}` 
  });
  
  // Renew firm subscription validity
  try {
    const subscriptionController = require('./subscriptionController');
    await subscriptionController.renewFirmSubscription(payment);
  } catch (renewError) {
    logger.error('Failed to renew firm subscription', { error: renewError.message });
  }
}

async function handleSubscriptionPending(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'pending';
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription pending', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id 
  });
}

async function handleSubscriptionHalted(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'halted';
  await addBillingHistoryEntry(payment, {
    amount: payment.amount,
    status: 'failed',
    notes: 'Subscription halted due to payment failure'
  });
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.warn('Subscription halted', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    firmId: payment.firmId 
  });
  
  // Deactivate firm subscription (revert to Starter)
  try {
    const subscriptionController = require('./subscriptionController');
    await subscriptionController.deactivateFirmSubscription(payment);
  } catch (deactivationError) {
    logger.error('Failed to deactivate firm subscription', { error: deactivationError.message });
  }
}

async function handleSubscriptionCancelled(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'cancelled';
  payment.status = 'cancelled';
  await addBillingHistoryEntry(payment, {
    amount: 0,
    status: 'cancelled',
    notes: 'Subscription cancelled'
  });
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription cancelled', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    firmId: payment.firmId 
  });
  
  // Deactivate firm subscription (revert to Starter)
  try {
    const subscriptionController = require('./subscriptionController');
    await subscriptionController.deactivateFirmSubscription(payment);
  } catch (deactivationError) {
    logger.error('Failed to deactivate firm subscription', { error: deactivationError.message });
  }
}

async function handleSubscriptionCompleted(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'completed';
  payment.status = 'paid';
  payment.subscriptionEndAt = new Date();
  await addBillingHistoryEntry(payment, {
    amount: 0,
    status: 'completed',
    notes: `Subscription completed - All ${subscriptionEntity.total_count} billing cycles paid`
  });
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription completed', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    totalCycles: subscriptionEntity.total_count 
  });
  
  // Revert to Starter plan
  try {
    const subscriptionController = require('./subscriptionController');
    await subscriptionController.deactivateFirmSubscription(payment);
  } catch (deactivationError) {
    logger.error('Failed to deactivate firm subscription after completion', { error: deactivationError.message });
  }
}

async function handleSubscriptionPaused(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'paused';
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription paused', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id 
  });
}

async function handleSubscriptionResumed(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = subscriptionEntity.status;
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription resumed', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id 
  });
}

async function handleSubscriptionAuthenticated(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  payment.subscriptionStatus = 'authenticated';
  payment.status = 'paid'; // Mark as paid since payment method is verified
  payment.currentPeriodStart = subscriptionEntity.current_start 
    ? new Date(subscriptionEntity.current_start * 1000) 
    : null;
  payment.currentPeriodEnd = subscriptionEntity.current_end 
    ? new Date(subscriptionEntity.current_end * 1000) 
    : null;
  payment.nextBillingDate = subscriptionEntity.charge_at 
    ? new Date(subscriptionEntity.charge_at * 1000) 
    : null;
  
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription authenticated', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    firmId: payment.firmId 
  });
  
  // Activate firm subscription (payment method verified, ready to charge)
  try {
    const subscriptionController = require('./subscriptionController');
    const Subscription = require('../models/Subscription');
    const subscription = await Subscription.findById(payment.planId);
    await subscriptionController.activateFirmSubscription(payment, subscription, subscriptionEntity);
    
    logger.info('Firm subscription activated after authentication', {
      paymentId: payment._id,
      firmId: payment.firmId,
      subscriptionId: subscriptionEntity.id
    });
  } catch (activationError) {
    logger.error('Failed to activate firm subscription after authentication', { 
      error: activationError.message,
      stack: activationError.stack 
    });
  }
}

async function handleSubscriptionUpdated(subscriptionEntity, eventId) {
  const payment = await findPaymentBySubscriptionId(subscriptionEntity.id);
  if (!payment || !shouldProcessSubscriptionEvent(payment, subscriptionEntity)) {
    return;
  }
  
  // Sync status and counts from Razorpay
  payment.subscriptionStatus = subscriptionEntity.status;
  payment.paidCount = subscriptionEntity.paid_count;
  payment.remainingCount = subscriptionEntity.remaining_count;
  payment.currentPeriodStart = subscriptionEntity.current_start 
    ? new Date(subscriptionEntity.current_start * 1000) 
    : null;
  payment.currentPeriodEnd = subscriptionEntity.current_end 
    ? new Date(subscriptionEntity.current_end * 1000) 
    : null;
  payment.nextBillingDate = subscriptionEntity.charge_at 
    ? new Date(subscriptionEntity.charge_at * 1000) 
    : null;
  await updatePaymentWebhookData(payment, subscriptionEntity, eventId);
  
  logger.info('Subscription updated', { 
    paymentId: payment._id,
    subscriptionId: subscriptionEntity.id,
    status: subscriptionEntity.status 
  });
}

module.exports = exports;

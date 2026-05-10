/**
 * Chat Message Payment Service
 * 
 * Handles payment processing for paid chat messages.
 * 
 * IMPORTANT: The Payment record is now created when the CA-Admin sends the 
 * payment-required message (in messageController.js). This ensures that:
 * 1. Payments count toward the firm's subscription limits immediately
 * 2. The limit check happens when CA-Admin creates the request (not when Client pays)
 * 
 * When a Client calls initiatePaymentOrder, we:
 * 1. Find the existing Payment record (created by CA-Admin)
 * 2. Create a Razorpay order for that payment
 * 3. Return the order details for the Client to complete payment
 */

const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Thread = require('../models/Thread');
const Message = require('../models/Message');
const { assertMonthlyLimit } = require('./subscriptionService');
const razorpayService = require('./razorpayService');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errorHandler');

/**
 * Mark a chat message payment as paid
 * Called after payment verification (typically from webhook)
 */
async function markChatMessagePaymentPaid(payment) {
  if (!payment?.messageId) return;
  const message = await Message.findById(payment.messageId);
  if (!message || message.isDeleted) return;
  if (!message.paymentRequired || message.paymentStatus !== 'pending') return;
  await message.markPaymentComplete(payment._id);
}

/**
 * Create a new Payment requirement for a chat message (CA-Admin side)
 * 
 * This checks subscription limits and creates the Payment record.
 * 
 * @param {Object} params
 * @param {string} params.firmId - ID of the firm
 * @param {string} params.clientId - ID of the client
 * @param {string} params.threadId - ID of the thread
 * @param {number} params.amount - Amount in paise
 * @param {string} params.description - Payment description
 * @param {string} params.createdBy - ID of the user creating the request (CA-Admin)
 * @param {Array} params.documentIds - Array of document IDs attached
 * @returns {Promise<Payment>} The created payment record
 */
async function createChatMessagePaymentRequirement({ firmId, clientId, threadId, amount, description, createdBy, documentIds = [] }) {
  if (!firmId || !clientId || !threadId || !amount || !createdBy) {
    throw new ValidationError('Missing required fields for payment creation');
  }

  await assertMonthlyLimit({ firmId, modelType: 'Payment', increment: 1 });

  // Create Payment record
  const payment = await Payment.create({
    paymentType: 'chat-message',
    clientId,
    firmId,
    threadId,
    documentIds,
    amount,
    currency: 'INR',
    description: description || 'Chat payment',
    gstAmount: 0,
    gstPercentage: 0,
    createdBy,
    status: 'created',
    notes: new Map([
      ['threadId', threadId.toString()],
      ['createdByRole', 'CA-Admin']
    ])
  });

  return payment;
}

/**
 * Create a Razorpay order for an existing chat message payment
 * 
 * The Payment record was already created by CA-Admin when they sent the message.
 * This function creates the Razorpay order so the Client can complete payment.
 * 
 * @param {Object} params
 * @param {Object} params.user - The Client user initiating payment
 * @param {string} params.threadId - Thread containing the message
 * @param {string} params.messageId - Message requiring payment
 * @returns {Object} Payment and Razorpay order details
 */
async function initiatePaymentOrder({ user, threadId, messageId }) {
  if (!threadId || !messageId) {
    throw new ValidationError('Thread ID and message ID are required');
  }

  if (user?.role !== 'Client') {
    throw new AuthorizationError('Only Client can initiate chat payments');
  }

  // Verify thread exists and is accessible
  const thread = await Thread.findById(threadId);
  if (!thread || thread.isDeleted) {
    throw new NotFoundError('Thread not found');
  }

  // Find the client
  const client = await Client.findOne({
    userAccountId: user._id,
    isDeleted: false,
  });

  if (!client || thread.clientId.toString() !== client._id.toString()) {
    throw new AuthorizationError('You do not have access to this thread');
  }

  // Find the message
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted || message.threadId.toString() !== thread._id.toString()) {
    throw new NotFoundError('Message not found');
  }

  // Validate message is eligible for payment
  if (message.senderRole !== 'CA-Admin' || !message.paymentRequired || message.paymentStatus !== 'pending') {
    throw new ValidationError('This message is not eligible for payment');
  }

  // Validate there are attachments
  const attachmentCount = (message.attachments?.length || 0) + (message.inlineFiles?.length || 0);
  if (attachmentCount === 0) {
    throw new ValidationError('No file attachment found for this payment request');
  }

  // Validate payment amount
  if (!message.paymentAmount || message.paymentAmount <= 0) {
    throw new ValidationError('Invalid payment amount');
  }

  // Check Razorpay configuration
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new ValidationError('Payments are not configured');
  }

  // Find the existing Payment record (created when CA-Admin sent the message)
  // The Payment record should be linked to the message via paymentId on message
  // or via messageId on payment
  let payment = null;

  // First, check if message has a paymentId reference
  if (message.paymentId) {
    payment = await Payment.findOne({
      _id: message.paymentId,
      paymentType: 'chat-message',
      messageId: message._id,
      isActive: true,
    });
  }

  // Fallback: Find by messageId (for legacy or edge cases)
  if (!payment) {
    payment = await Payment.findOne({
      paymentType: 'chat-message',
      messageId: message._id,
      isActive: true,
    }).sort({ createdAt: -1 });
  }

  // If no payment record exists, it means this is a legacy message created before the fix
  // In this case, we should NOT create a new payment (the message was invalid)
  if (!payment) {
    throw new ValidationError(
      'Payment record not found for this message. ' +
      'Please contact your CA to resend the payment request.'
    );
  }

  // If payment already has a Razorpay order and is pending, return it
  if (payment.razorpayOrderId && ['created', 'pending'].includes(payment.status)) {
    return {
      payment,
      razorpayOrder: {
        id: payment.razorpayOrderId,
        amount: payment.amount,
        currency: payment.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  // If payment was already completed or failed, don't allow new order
  if (!['created', 'pending'].includes(payment.status)) {
    throw new ValidationError(`Payment is already ${payment.status}`);
  }

  // Create Razorpay order
  const razorpayOrder = await razorpayService.createOrder({
    amount: payment.amount,
    currency: payment.currency,
    receipt: `CHAT-${payment._id.toString()}`,
    notes: {
      paymentId: payment._id.toString(),
      paymentType: 'chat-message',
      threadId: thread._id.toString(),
      messageId: message._id.toString(),
      clientId: client._id.toString(),
      firmId: thread.firmId.toString(),
    },
  });

  // Update payment with Razorpay order ID
  payment.razorpayOrderId = razorpayOrder.id;
  payment.status = 'pending';
  await payment.save();

  return {
    payment,
    razorpayOrder: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}

module.exports = {
  createChatMessagePaymentRequirement,
  initiatePaymentOrder,
  markChatMessagePaymentPaid,
};

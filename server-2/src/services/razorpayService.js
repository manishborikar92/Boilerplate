/**
 * Razorpay Service
 * Handles all Razorpay API interactions
 */
const crypto = require('crypto');
const { razorpay } = require('../config/razorpay');
const { logger } = require('../middleware/logger');
const { InternalError } = require('../utils/errorHandler');

class RazorpayService {
  /**
   * Create Razorpay Order for one-time payment
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const options = {
        amount: Math.round(amount), // amount in paise
        currency,
        receipt,
        notes
      };

      const order = await razorpay.orders.create(options);
      logger.info('Razorpay order created', { orderId: order.id });
      
      return order;
    } catch (error) {
      logger.error('Failed to create Razorpay order', { error: error.message });
      throw new InternalError('Failed to create payment order');
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    try {
      const text = `${orderId}|${paymentId}`;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      return generated_signature === signature;
    } catch (error) {
      logger.error('Failed to verify payment signature', { error: error.message });
      return false;
    }
  }

  /**
   * Fetch payment details
   */
  async getPayment(paymentId) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      logger.error('Failed to fetch payment', { error: error.message });
      throw new InternalError('Failed to fetch payment details');
    }
  }

  /**
   * Create Razorpay Subscription Plan
   * 
   * @param {Object} planData - Plan configuration
   * @param {string} planData.period - Billing period (daily, weekly, monthly, yearly)
   * @param {number} planData.interval - Billing interval (e.g., 1, 3, 6)
   * @param {Object} planData.item - Item details
   * @param {string} planData.item.name - Plan name
   * @param {number} planData.item.amount - Amount in paise
   * @param {string} planData.item.currency - Currency code (INR)
   * @param {string} planData.item.description - Plan description
   * @param {Object} [planData.notes] - Optional notes
   */
  async createPlan(planData) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      // Validate required fields
      if (!planData.period || !planData.interval || !planData.item) {
        throw new Error('Missing required fields: period, interval, or item');
      }

      if (!planData.item.name || !planData.item.amount) {
        throw new Error('Missing required item fields: name or amount');
      }

      // Construct the API request with correct Razorpay format
      const options = {
        period: planData.period,
        interval: planData.interval,
        item: {
          name: planData.item.name,
          amount: Math.round(planData.item.amount),
          currency: planData.item.currency || 'INR',
          description: planData.item.description
        }
      };

      // Add notes if provided
      if (planData.notes) {
        options.notes = planData.notes;
      }

      const plan = await razorpay.plans.create(options);
      logger.info('Razorpay plan created', { planId: plan.id });
      
      return plan;
    } catch (error) {
      logger.error('Failed to create Razorpay plan', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        field: error.error?.field,
        statusCode: error.statusCode
      });
      
      // Re-throw the original error with details preserved
      throw error;
    }
  }

  /**
   * Create Razorpay Subscription with automatic billing
   */
  async createSubscription({ planId, totalCount, customerId, notes = {}, startAt, addons = [], quantity = 1 }) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const options = {
        plan_id: planId,
        total_count: totalCount || 12, // Number of billing cycles
        quantity: quantity,
        customer_notify: 1, // Send email/SMS to customer
        notes
      };

      if (customerId) {
        options.customer_id = customerId;
      }

      if (startAt) {
        options.start_at = Math.floor(startAt.getTime() / 1000); // Unix timestamp
      }

      if (addons && addons.length > 0) {
        options.addons = addons;
      }

      const subscription = await razorpay.subscriptions.create(options);
      logger.info('Razorpay subscription created', { subscriptionId: subscription.id });
      
      return subscription;
    } catch (error) {
      logger.error('Failed to create Razorpay subscription', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        statusCode: error.statusCode,
        fullError: JSON.stringify(error)
      });
      throw new InternalError(`Failed to create subscription: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const subscription = await razorpay.subscriptions.update(subscriptionId, updates);
      logger.info('Razorpay subscription updated', { subscriptionId });
      
      return subscription;
    } catch (error) {
      logger.error('Failed to update subscription', { error: error.message });
      throw new InternalError('Failed to update subscription');
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(subscriptionId) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const subscription = await razorpay.subscriptions.pause(subscriptionId);
      logger.info('Razorpay subscription paused', { subscriptionId });
      
      return subscription;
    } catch (error) {
      logger.error('Failed to pause subscription', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        subscriptionId
      });
      throw new InternalError(`Failed to pause subscription: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const subscription = await razorpay.subscriptions.resume(subscriptionId);
      logger.info('Razorpay subscription resumed', { subscriptionId });
      
      return subscription;
    } catch (error) {
      logger.error('Failed to resume subscription', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        subscriptionId
      });
      throw new InternalError(`Failed to resume subscription: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Fetch subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Failed to fetch subscription', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        subscriptionId
      });
      throw new InternalError(`Failed to fetch subscription: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, cancelAtCycleEnd = false) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const subscription = await razorpay.subscriptions.cancel(subscriptionId, {
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0
      });
      
      logger.info('Razorpay subscription cancelled', { subscriptionId });
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        statusCode: error.statusCode,
        subscriptionId
      });
      throw new InternalError(`Failed to cancel subscription: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Create Razorpay Customer
   */
  async createCustomer({ name, email, contact, notes = {} }) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const options = {
        name,
        email,
        contact,
        notes
      };

      const customer = await razorpay.customers.create(options);
      logger.info('Razorpay customer created', { customerId: customer.id });
      
      return customer;
    } catch (error) {
      logger.error('Failed to create Razorpay customer', { error: error.message });
      throw new InternalError('Failed to create customer');
    }
  }

  /**
   * Create Payment Link (for invoices)
   */
  async createPaymentLink({ amount, currency = 'INR', description, customerId, notes = {}, callbackUrl, callbackMethod = 'get' }) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const options = {
        amount: Math.round(amount), // amount in paise
        currency,
        description,
        customer: {
          contact: customerId?.phoneNumber,
          email: customerId?.email,
          name: customerId?.companyName
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes,
        callback_url: callbackUrl,
        callback_method: callbackMethod
      };

      const paymentLink = await razorpay.paymentLink.create(options);
      logger.info('Razorpay payment link created', { linkId: paymentLink.id });
      
      return paymentLink;
    } catch (error) {
      logger.error('Failed to create payment link', { 
        error: error.message,
        description: error.error?.description,
        code: error.error?.code,
        statusCode: error.statusCode,
        fullError: JSON.stringify(error)
      });
      throw new InternalError(`Failed to create payment link: ${error.error?.description || error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body, signature, secret) {
    try {
      let message;
      if (Buffer.isBuffer(body)) {
        message = body.toString('utf8');
      } else if (typeof body === 'string') {
        message = body;
      } else {
        message = JSON.stringify(body);
      }

      if (!signature) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret || process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(message)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (error) {
      logger.error('Failed to verify webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, amount = null, notes = {}) {
    try {
      if (!razorpay) {
        throw new InternalError('Razorpay not configured');
      }

      const options = { notes };
      if (amount) {
        options.amount = Math.round(amount); // Partial refund
      }

      const refund = await razorpay.payments.refund(paymentId, options);
      logger.info('Payment refunded', { paymentId, refundId: refund.id });
      
      return refund;
    } catch (error) {
      logger.error('Failed to refund payment', { error: error.message });
      throw new InternalError('Failed to process refund');
    }
  }
}

module.exports = new RazorpayService();

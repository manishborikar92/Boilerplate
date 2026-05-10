import crypto from 'node:crypto';

import { PaymentGatewayAdapter } from '../payment-gateway.adapter.js';
import { PaymentModuleError } from '../payment-error.js';

export class RazorpayAdapter extends PaymentGatewayAdapter {
  constructor({ client, keySecret, logger = console } = {}) {
    super();
    if (!client) throw new Error('RazorpayAdapter requires an initialized Razorpay client');
    if (!keySecret) throw new Error('RazorpayAdapter requires keySecret');
    this.client = client;
    this.keySecret = keySecret;
    this.logger = logger;
  }

  getProviderName() {
    return 'razorpay';
  }

  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const order = await this.client.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      notes,
    });

    this.logger.info?.('Razorpay order created', { orderId: order.id });
    return {
      provider: this.getProviderName(),
      providerOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      raw: order,
    };
  }

  async getOrderStatus(providerOrderId) {
    const order = await this.client.orders.fetch(providerOrderId);
    return {
      provider: this.getProviderName(),
      providerOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      raw: order,
    };
  }

  async refundPayment({ paymentId, amount, notes = {} }) {
    const refund = await this.client.payments.refund(paymentId, {
      ...(amount ? { amount: Math.round(amount) } : {}),
      notes,
    });

    return {
      provider: this.getProviderName(),
      providerRefundId: refund.id,
      paymentId,
      amount: refund.amount,
      status: refund.status,
      raw: refund,
    };
  }

  verifyPaymentSignature({ orderId, paymentId, signature }) {
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return safeEqual(expected, signature);
  }

  verifyWebhook({ rawBody, signature, webhookSecret }) {
    if (!signature || !webhookSecret) return false;
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    return safeEqual(expected, signature);
  }

  parseWebhook(payload = {}) {
    return {
      provider: this.getProviderName(),
      event: payload.event || null,
      entity: payload.payload || {},
      raw: payload,
    };
  }
}

const safeEqual = (left, right) => {
  try {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
};

export const createRazorpayAdapter = (options) => new RazorpayAdapter(options);

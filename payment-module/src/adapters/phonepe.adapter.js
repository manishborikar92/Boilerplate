import crypto from 'node:crypto';

import { PaymentGatewayAdapter } from '../payment-gateway.adapter.js';
import { PaymentModuleError } from '../payment-error.js';

export class PhonePeAdapter extends PaymentGatewayAdapter {
  constructor({
    baseUrl,
    tokenProvider,
    webhookUsername,
    webhookPassword,
    fetchImpl = globalThis.fetch,
    logger = console,
  } = {}) {
    super();
    if (!baseUrl) throw new Error('PhonePeAdapter requires baseUrl');
    if (!tokenProvider) throw new Error('PhonePeAdapter requires tokenProvider');
    if (!fetchImpl) throw new Error('PhonePeAdapter requires fetch');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.tokenProvider = tokenProvider;
    this.webhookUsername = webhookUsername;
    this.webhookPassword = webhookPassword;
    this.fetch = fetchImpl;
    this.logger = logger;
  }

  getProviderName() {
    return 'phonepe';
  }

  async createOrder({ merchantOrderId, amount, metadata = {}, expiresInSeconds = 1200, paymentModeConfig }) {
    const body = {
      merchantOrderId,
      amount: Math.round(amount),
      expireAfter: expiresInSeconds,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        ...(paymentModeConfig ? { paymentModeConfig } : {}),
      },
      ...(Object.keys(metadata).length ? { metaInfo: mapMetadata(metadata) } : {}),
    };

    const data = await this.#request('POST', '/checkout/v2/sdk/order', body);
    if (!data.token) {
      throw new PaymentModuleError('PhonePe order token was not returned');
    }

    this.logger.info?.('PhonePe order created', { merchantOrderId, orderId: data.orderId });
    return {
      provider: this.getProviderName(),
      providerOrderId: data.orderId,
      merchantOrderId,
      token: data.token,
      status: data.state,
      expiresAt: data.expireAt || null,
      raw: data,
    };
  }

  async getOrderStatus(merchantOrderId) {
    const data = await this.#request('GET', `/checkout/v2/order/${merchantOrderId}/status?details=true&errorContext=true`);
    return {
      provider: this.getProviderName(),
      providerOrderId: data.orderId,
      merchantOrderId,
      amount: data.amount,
      status: data.state,
      payments: data.paymentDetails || [],
      raw: data,
    };
  }

  async refundPayment({ merchantRefundId, originalMerchantOrderId, amount }) {
    const data = await this.#request('POST', '/payments/v2/refund', {
      merchantRefundId,
      originalMerchantOrderId,
      amount: Math.round(amount),
    });

    return {
      provider: this.getProviderName(),
      providerRefundId: data.refundId,
      merchantRefundId,
      status: data.state,
      raw: data,
    };
  }

  verifyWebhook({ headers = {} }) {
    if (!this.webhookUsername || !this.webhookPassword) return false;
    const received = headers.authorization || headers.Authorization;
    if (!received) return false;

    const expected = crypto
      .createHash('sha256')
      .update(`${this.webhookUsername}:${this.webhookPassword}`)
      .digest('hex');

    return safeEqual(expected, received);
  }

  parseWebhook(payload = {}) {
    const data = payload.payload || {};
    return {
      provider: this.getProviderName(),
      event: payload.event || null,
      merchantOrderId: data.merchantOrderId || data.originalMerchantOrderId || null,
      merchantRefundId: data.merchantRefundId || null,
      status: data.state || data.paymentDetails?.[0]?.state || null,
      amount: data.amount || data.paymentDetails?.[0]?.amount || null,
      raw: payload,
    };
  }

  async #request(method, endpoint, body) {
    const token = await this.tokenProvider.getToken();
    const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `O-Bearer ${token}`,
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    const data = await safeJson(response);
    if (!response.ok) {
      throw new PaymentModuleError(data?.message || `PhonePe request failed with ${response.status}`, {
        statusCode: response.status,
        providerCode: data?.code || null,
        providerMessage: data?.message || response.statusText,
      });
    }

    return data || {};
  }
}

const mapMetadata = (metadata) => Object.fromEntries(
  Object.entries(metadata)
    .slice(0, 15)
    .map(([key, value], index) => [`udf${index + 1}`, String(value ?? key)]),
);

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const safeEqual = (left, right) => {
  try {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
};

export const createPhonePeAdapter = (options) => new PhonePeAdapter(options);

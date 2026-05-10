import crypto from 'node:crypto';

import { PayoutGatewayAdapter } from '../payout-gateway.adapter.js';
import { PayoutModuleError } from '../payout-error.js';

export class CashfreePayoutAdapter extends PayoutGatewayAdapter {
  constructor({
    baseUrl,
    clientId,
    clientSecret,
    apiVersion = '2024-01-01',
    fetchImpl = globalThis.fetch,
    logger = console,
  } = {}) {
    super();
    if (!baseUrl) throw new Error('CashfreePayoutAdapter requires baseUrl');
    if (!clientId || !clientSecret) throw new Error('CashfreePayoutAdapter requires credentials');
    if (!fetchImpl) throw new Error('CashfreePayoutAdapter requires fetch');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiVersion = apiVersion;
    this.fetch = fetchImpl;
    this.logger = logger;
  }

  getProviderName() {
    return 'cashfree';
  }

  async createBeneficiary({ beneficiaryId, name, phone, email, vpa, bankAccount, ifsc }) {
    const body = {
      beneficiary_id: beneficiaryId,
      beneficiary_name: name,
      ...(buildContactDetails({ phone, email }) ? { beneficiary_contact_details: buildContactDetails({ phone, email }) } : {}),
      beneficiary_instrument_details: buildInstrumentDetails({ vpa, bankAccount, ifsc }),
    };

    await this.#request('POST', '/beneficiary', body);
    this.logger.info?.('Cashfree beneficiary created', { beneficiaryId });
    return { provider: this.getProviderName(), beneficiaryId, created: true };
  }

  async getBeneficiary(beneficiaryId) {
    try {
      return await this.#request('GET', `/beneficiary/${encodeURIComponent(beneficiaryId)}`);
    } catch (error) {
      if (error.statusCode === 404 || error.providerCode === 'BENE_NOT_FOUND') return null;
      throw error;
    }
  }

  async removeBeneficiary(beneficiaryId) {
    await this.#request('DELETE', `/beneficiary/${encodeURIComponent(beneficiaryId)}`);
    return true;
  }

  async initiateTransfer({ transferId, amount, beneficiaryId, transferMode, remarks }) {
    const data = await this.#request('POST', '/transfers', {
      transfer_id: transferId,
      transfer_amount: amount,
      beneficiary_details: { beneficiary_id: beneficiaryId },
      ...(transferMode ? { transfer_mode: transferMode } : {}),
      ...(remarks ? { remarks } : {}),
    });

    return {
      provider: this.getProviderName(),
      transferId: data.transfer_id || transferId,
      providerTransferId: data.cf_transfer_id || null,
      status: data.status || null,
      raw: data,
    };
  }

  async getTransferStatus(transferId) {
    const data = await this.#request('GET', `/transfers/${encodeURIComponent(transferId)}`);
    return {
      provider: this.getProviderName(),
      transferId: data.transfer_id || transferId,
      providerTransferId: data.cf_transfer_id || null,
      status: data.status || null,
      utr: data.transfer_utr || null,
      raw: data,
    };
  }

  async verifyBankAccount({ bankAccount, ifsc, name }) {
    const query = new URLSearchParams({
      bankAccount,
      ifsc,
      ...(name ? { name } : {}),
    });
    const data = await this.#request('GET', `/validation/bankDetails?${query.toString()}`);

    return {
      accountExists: Boolean(data.account_exists),
      nameMatch: Boolean(data.name_match),
      registeredName: data.registered_name || null,
      raw: data,
    };
  }

  verifyWebhook({ headers = {}, rawBody = '' }) {
    const receivedSignature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!receivedSignature || !timestamp) return false;

    const expected = crypto
      .createHmac('sha256', this.clientSecret)
      .update(`${timestamp}${rawBody}`)
      .digest('base64');

    return safeEqual(expected, receivedSignature);
  }

  parseWebhook(payload = {}) {
    const data = payload.data?.transfer || payload.data || {};
    return {
      provider: this.getProviderName(),
      event: payload.type || payload.event || null,
      transferId: data.transfer_id || null,
      providerTransferId: data.cf_transfer_id || null,
      status: data.status || null,
      utr: data.transfer_utr || null,
      amount: data.transfer_amount || null,
      raw: payload,
    };
  }

  async #request(method, endpoint, body) {
    const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId,
        'x-client-secret': this.clientSecret,
        'x-api-version': this.apiVersion,
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    const data = await safeJson(response);
    if (!response.ok) {
      throw new PayoutModuleError(data?.message || `Cashfree request failed with ${response.status}`, {
        statusCode: response.status,
        providerCode: data?.code || null,
        providerMessage: data?.message || response.statusText,
      });
    }

    return data || {};
  }
}

const buildContactDetails = ({ phone, email }) => {
  const contact = {};
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    contact.beneficiary_phone = digits.slice(2);
    contact.beneficiary_country_code = '+91';
  } else if (digits.length === 10) {
    contact.beneficiary_phone = digits;
    contact.beneficiary_country_code = '+91';
  } else if (phone) {
    contact.beneficiary_phone = String(phone);
  }
  if (email) contact.beneficiary_email = email;
  return Object.keys(contact).length ? contact : null;
};

const buildInstrumentDetails = ({ vpa, bankAccount, ifsc }) => {
  if (vpa) return { vpa };
  if (bankAccount && ifsc) return { bank_account_number: bankAccount, bank_ifsc: ifsc };
  throw new PayoutModuleError('Either UPI VPA or bank account details are required', { statusCode: 400 });
};

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

export const createCashfreePayoutAdapter = (options) => new CashfreePayoutAdapter(options);

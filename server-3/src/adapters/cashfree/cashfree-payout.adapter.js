import crypto from 'crypto';

import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { PayoutError } from '../../utils/api-error.js';
import { PayoutGatewayAdapter } from '../payout-gateway.adapter.js';
import { CASHFREE_ENDPOINTS } from './cashfree.constants.js';

const safeReadJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const buildBeneficiaryContactDetails = ({ phone, email }) => {
    const details = {};
    const digits = String(phone || '').replace(/\D/g, '');

    if (digits.length === 12 && digits.startsWith('91')) {
        details.beneficiary_phone = digits.slice(2);
        details.beneficiary_country_code = '+91';
    } else if (digits.length === 10) {
        details.beneficiary_phone = digits;
        details.beneficiary_country_code = '+91';
    } else if (phone) {
        details.beneficiary_phone = String(phone);
    }

    if (email) {
        details.beneficiary_email = email;
    }

    return Object.keys(details).length > 0 ? details : null;
};

class CashfreePayoutAdapter extends PayoutGatewayAdapter {
    constructor() {
        super();
        this._baseUrl = config.cashfree.payoutBaseUrl;
    }

    getProviderName() {
        return 'cashfree';
    }

    async createBeneficiary({ beneficiaryId, name, phone, email, vpa, bankAccount, ifsc }) {
        const requestBody = {
            beneficiary_id: beneficiaryId,
            beneficiary_name: name,
        };

        const contactDetails = buildBeneficiaryContactDetails({ phone, email });
        if (contactDetails) {
            requestBody.beneficiary_contact_details = contactDetails;
        }

        if (vpa) {
            requestBody.beneficiary_instrument_details = { vpa };
        } else if (bankAccount && ifsc) {
            requestBody.beneficiary_instrument_details = {
                bank_account_number: bankAccount,
                bank_ifsc: ifsc,
            };
        } else {
            throw new PayoutError('Either UPI VPA or bank account details are required for beneficiary creation');
        }

        await this._makeRequest('POST', CASHFREE_ENDPOINTS.CREATE_BENEFICIARY, requestBody);

        logger.info('[CashfreePayoutAdapter] Beneficiary created', {
            beneficiaryId,
            hasVpa: Boolean(vpa),
            hasBankAccount: Boolean(bankAccount),
        });

        return {
            beneficiaryId,
            created: true,
        };
    }

    async getBeneficiary(beneficiaryId) {
        try {
            return await this._makeRequest('GET', CASHFREE_ENDPOINTS.GET_BENEFICIARY(beneficiaryId));
        } catch (error) {
            if (
                error?.providerCode === 'BENE_NOT_FOUND'
                || error?.providerCode === 'beneficiary_not_found'
                || error?.statusCode === 404
            ) {
                return null;
            }
            throw error;
        }
    }

    async removeBeneficiary(beneficiaryId) {
        await this._makeRequest('DELETE', CASHFREE_ENDPOINTS.REMOVE_BENEFICIARY(beneficiaryId));
        logger.info('[CashfreePayoutAdapter] Beneficiary removed', { beneficiaryId });
        return true;
    }

    async initiateTransfer({ transferId, amountInRupees, beneficiaryId, transferMode, remarks }) {
        const requestBody = {
            transfer_id: transferId,
            transfer_amount: amountInRupees,
            beneficiary_details: {
                beneficiary_id: beneficiaryId,
            },
        };

        if (transferMode) {
            requestBody.transfer_mode = transferMode;
        }

        if (remarks) {
            requestBody.remarks = remarks;
        }

        const data = await this._makeRequest('POST', CASHFREE_ENDPOINTS.STANDARD_TRANSFER, requestBody);

        logger.info('[CashfreePayoutAdapter] Transfer initiated', {
            transferId,
            gatewayTransferId: data.cf_transfer_id,
            status: data.status,
        });

        return {
            gatewayTransferId: data.cf_transfer_id,
            transferId: data.transfer_id,
            status: data.status,
        };
    }

    async getTransferStatus(transferId) {
        const data = await this._makeRequest('GET', CASHFREE_ENDPOINTS.GET_TRANSFER_STATUS(transferId));

        return {
            gatewayTransferId: data.cf_transfer_id,
            transferId: data.transfer_id,
            status: data.status,
            utr: data.transfer_utr,
            amount: data.transfer_amount,
            updatedAt: data.updated_on || data.updated_at,
            failureReason: data.failure_reason || null,
        };
    }

    async verifyBankAccount({ bankAccount, ifsc, name }) {
        const query = new URLSearchParams({
            bankAccount,
            ifsc,
            ...(name ? { name } : {}),
        });

        const data = await this._makeRequest('GET', `${CASHFREE_ENDPOINTS.VERIFY_BANK_ACCOUNT}?${query.toString()}`);

        return {
            accountExists: Boolean(data.account_exists),
            nameMatch: Boolean(data.name_match),
            registeredName: data.registered_name || null,
        };
    }

    verifyWebhook(headers, rawBody) {
        const receivedSignature = headers['x-webhook-signature'];
        const timestamp = headers['x-webhook-timestamp'];

        if (!receivedSignature || !timestamp) {
            logger.warn('[CashfreePayoutAdapter] Missing webhook signature headers');
            return false;
        }

        const computedSignature = crypto
            .createHmac('sha256', config.cashfree.payoutClientSecret)
            .update(`${timestamp}${rawBody}`)
            .digest('base64');

        try {
            return crypto.timingSafeEqual(
                Buffer.from(String(receivedSignature)),
                Buffer.from(computedSignature),
            );
        } catch {
            return false;
        }
    }

    parseWebhookPayload(body = {}) {
        const event = body.type || body.event || null;
        const data = body.data?.transfer || body.data || {};

        return {
            event,
            transferId: data.transfer_id || null,
            gatewayTransferId: data.cf_transfer_id || null,
            status: data.status || null,
            utr: data.transfer_utr || null,
            amount: data.transfer_amount || null,
            updatedAt: data.updated_on || data.updated_at || data.processed_on || null,
            failureReason: data.failure_reason || null,
        };
    }

    async _makeRequest(method, endpoint, body = null) {
        const url = `${this._baseUrl}${endpoint}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': config.cashfree.payoutClientId,
                'x-client-secret': config.cashfree.payoutClientSecret,
                'x-api-version': config.cashfree.payoutApiVersion,
            },
            body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
        });

        const data = await safeReadJson(response);

        if (!response.ok) {
            logger.error('[CashfreePayoutAdapter] API request failed', {
                method,
                endpoint,
                status: response.status,
                code: data?.code || null,
                message: data?.message || response.statusText,
            });

            const error = new PayoutError(
                data?.message || `Cashfree API error: ${response.status}`,
                data?.code || null,
                data?.message || response.statusText,
            );
            error.statusCode = response.status;
            throw error;
        }

        return data || {};
    }
}

const cashfreePayoutAdapter = new CashfreePayoutAdapter();
export default cashfreePayoutAdapter;

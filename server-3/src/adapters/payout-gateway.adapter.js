export class PayoutGatewayAdapter {
    getProviderName() {
        throw new Error('getProviderName() must be implemented');
    }

    async createBeneficiary(_params) {
        throw new Error('createBeneficiary() must be implemented');
    }

    async getBeneficiary(_beneficiaryId) {
        throw new Error('getBeneficiary() must be implemented');
    }

    async removeBeneficiary(_beneficiaryId) {
        throw new Error('removeBeneficiary() must be implemented');
    }

    async initiateTransfer(_params) {
        throw new Error('initiateTransfer() must be implemented');
    }

    async getTransferStatus(_transferId) {
        throw new Error('getTransferStatus() must be implemented');
    }

    async verifyBankAccount(_params) {
        throw new Error('verifyBankAccount() must be implemented');
    }

    verifyWebhook(_headers, _rawBody) {
        throw new Error('verifyWebhook() must be implemented');
    }

    parseWebhookPayload(_body) {
        throw new Error('parseWebhookPayload() must be implemented');
    }
}

export class PayoutGatewayAdapter {
  getProviderName() {
    throw new Error('getProviderName() must be implemented');
  }

  createBeneficiary(_params) {
    throw new Error('createBeneficiary() must be implemented');
  }

  getBeneficiary(_beneficiaryId) {
    throw new Error('getBeneficiary() must be implemented');
  }

  removeBeneficiary(_beneficiaryId) {
    throw new Error('removeBeneficiary() must be implemented');
  }

  initiateTransfer(_params) {
    throw new Error('initiateTransfer() must be implemented');
  }

  getTransferStatus(_transferId) {
    throw new Error('getTransferStatus() must be implemented');
  }

  verifyBankAccount(_params) {
    throw new Error('verifyBankAccount() must be implemented');
  }

  verifyWebhook(_params) {
    throw new Error('verifyWebhook() must be implemented');
  }

  parseWebhook(_payload) {
    throw new Error('parseWebhook() must be implemented');
  }
}

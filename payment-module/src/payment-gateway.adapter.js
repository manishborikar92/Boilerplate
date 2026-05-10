export class PaymentGatewayAdapter {
  getProviderName() {
    throw new Error('getProviderName() must be implemented');
  }

  createOrder(_params) {
    throw new Error('createOrder() must be implemented');
  }

  getOrderStatus(_providerOrderId) {
    throw new Error('getOrderStatus() must be implemented');
  }

  refundPayment(_params) {
    throw new Error('refundPayment() must be implemented');
  }

  verifyWebhook(_params) {
    throw new Error('verifyWebhook() must be implemented');
  }

  parseWebhook(_payload) {
    throw new Error('parseWebhook() must be implemented');
  }
}

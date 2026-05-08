export class PaymentGatewayAdapter {
    getGatewayName() {
        throw new Error('getGatewayName() must be implemented');
    }

    async createOrder(_params) {
        throw new Error('createOrder() must be implemented');
    }

    async getOrderStatus(_merchantOrderId) {
        throw new Error('getOrderStatus() must be implemented');
    }

    async initiateRefund(_params) {
        throw new Error('initiateRefund() must be implemented');
    }

    async getRefundStatus(_merchantRefundId) {
        throw new Error('getRefundStatus() must be implemented');
    }

    verifyWebhook(_headers, _body) {
        throw new Error('verifyWebhook() must be implemented');
    }

    parseWebhookPayload(_body) {
        throw new Error('parseWebhookPayload() must be implemented');
    }
}

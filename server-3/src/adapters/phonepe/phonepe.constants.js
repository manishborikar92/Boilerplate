export const PHONEPE_ENDPOINTS = {
    AUTH_TOKEN: '/v1/oauth/token',
    CREATE_SDK_ORDER: '/checkout/v2/sdk/order',
    ORDER_STATUS: (merchantOrderId) => `/checkout/v2/order/${merchantOrderId}/status`,
    INITIATE_REFUND: '/checkout/v2/order/refund',
    REFUND_STATUS: (merchantRefundId) => `/checkout/v2/refund/${merchantRefundId}/status`,
};

export const PHONEPE_STATES = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
};

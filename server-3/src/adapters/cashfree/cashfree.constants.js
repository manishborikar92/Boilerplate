export const CASHFREE_ENDPOINTS = {
    CREATE_BENEFICIARY: '/beneficiary',
    GET_BENEFICIARY: (beneficiaryId) => `/beneficiary?beneficiary_id=${encodeURIComponent(beneficiaryId)}`,
    REMOVE_BENEFICIARY: (beneficiaryId) => `/beneficiary?beneficiary_id=${encodeURIComponent(beneficiaryId)}`,
    STANDARD_TRANSFER: '/transfers',
    BATCH_TRANSFER: '/transfers/batch',
    GET_TRANSFER_STATUS: (transferId) => `/transfers?transfer_id=${encodeURIComponent(transferId)}`,
    VERIFY_BANK_ACCOUNT: '/validation/bankDetails',
};

export const CASHFREE_TRANSFER_STATUS = {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    REVERSED: 'REVERSED',
};

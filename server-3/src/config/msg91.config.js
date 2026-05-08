import config from './index.js';

const msg91 = Object.freeze({
    ...config.msg91,
    endpoints: Object.freeze({
        sendOtp: `${config.msg91.baseUrl}/otp`,
        verifyOtp: `${config.msg91.baseUrl}/otp/verify`,
        resendOtp: `${config.msg91.baseUrl}/otp/retry`,
    }),
    headers: Object.freeze({
        authkey: config.msg91.authKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    }),
});

export default msg91;

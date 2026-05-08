import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (one level above src/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read an env var and throw immediately if it is required and missing.
 */
const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Read an optional env var with a default.
 */
const optionalEnv = (key, fallback) => process.env[key] || fallback;
const providerEnv = (key, fallback) => {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || fallback;
};

// ---------------------------------------------------------------------------
// Config Object
// ---------------------------------------------------------------------------

const config = Object.freeze({
  /** Application */
  env: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  apiPrefix: '/api/v1',

  /** MongoDB */
  mongo: Object.freeze({
    uri: requireEnv('MONGODB_URI'),
  }),

  /** Firebase */
  firebase: Object.freeze({
    projectId: requireEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }),

  /** Cloudinary */
  cloudinary: Object.freeze({
    cloudName: requireEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: requireEnv('CLOUDINARY_API_KEY'),
    apiSecret: requireEnv('CLOUDINARY_API_SECRET'),
  }),

  /** Upload limits */
  upload: Object.freeze({
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    maxFiles: 10,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  }),

  /** Security / Rate Limiting */
  security: Object.freeze({
    bcryptSaltRounds: 10,
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100, // requests per window
  }),

  /** MSG91 OTP */
  msg91: Object.freeze({
    authKey: requireEnv('MSG91_AUTH_KEY'),
    otpTemplateId: requireEnv('MSG91_OTP_TEMPLATE_ID'),
    otpLength: 6,
    otpExpiry: 10,                                              // minutes
    testMode: process.env.NODE_ENV !== 'production' && true,   // flip to true in dev to skip real SMS
    testOtp: '123456',
    baseUrl: 'https://control.msg91.com/api/v5',
  }),

  /** JWT */
  jwt: Object.freeze({
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiry: optionalEnv('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optionalEnv('JWT_REFRESH_EXPIRY', '180d'),
  }),

  /** Pagination defaults */
  pagination: Object.freeze({
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  }),

  /** PhonePe Payment Gateway */
  phonepe: Object.freeze({
    clientId: providerEnv('PHONEPE_CLIENT_ID', 'test-phonepe-client-id'),
    clientSecret: providerEnv('PHONEPE_CLIENT_SECRET', 'test-phonepe-client-secret'),
    clientVersion: parseInt(optionalEnv('PHONEPE_CLIENT_VERSION', '1'), 10),
    merchantId: providerEnv('PHONEPE_MERCHANT_ID', 'test-phonepe-merchant-id'),
    env: optionalEnv('PHONEPE_ENV', 'SANDBOX'),
    webhookUsername: providerEnv('PHONEPE_WEBHOOK_USERNAME', 'test-phonepe-webhook-user'),
    webhookPassword: providerEnv('PHONEPE_WEBHOOK_PASSWORD', 'test-phonepe-webhook-password'),
    authUrl: optionalEnv('PHONEPE_ENV', 'SANDBOX') === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    baseUrl: optionalEnv('PHONEPE_ENV', 'SANDBOX') === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  }),

  /** Cashfree Payouts */
  cashfree: Object.freeze({
    payoutClientId: providerEnv('CASHFREE_PAYOUT_CLIENT_ID', 'test-cashfree-client-id'),
    payoutClientSecret: providerEnv('CASHFREE_PAYOUT_CLIENT_SECRET', 'test-cashfree-client-secret'),
    payoutEnv: optionalEnv('CASHFREE_PAYOUT_ENV', 'SANDBOX'),
    payoutBaseUrl: optionalEnv('CASHFREE_PAYOUT_ENV', 'SANDBOX') === 'PRODUCTION'
      ? 'https://api.cashfree.com/payout'
      : 'https://sandbox.cashfree.com/payout',
    payoutApiVersion: '2024-01-01',
  }),

  /** Payment + Payout business rules */
  payment: Object.freeze({
    platformFeeSingle: 3,
    platformFeeBundle: 10,
    refundFeeSingle: 7,
    refundFeeBundle: 15,
    minBundleServiceAmount: 300,
    sessionExpirySeconds: 1200,
    maxPollAttempts: 10,
    pollIntervalBaseMs: 3000,
    payoutBatchCronTime: '0 23 * * *',
    payoutBatchTimezone: 'Asia/Kolkata',
    // Payment modes configuration (PhonePe V2 Schema)
    // Configure which payment methods to enable
    // Empty array = all payment modes enabled
    // Examples: [{ type: 'UPI' }], [{ type: 'UPI' }, { type: 'CARD' }]
    paymentModes: [{ type: 'UPI' }],
  }),
});

export default config;

/**
 * Test Helper Utilities
 * WARNING: Only use in development/testing environments
 */

const crypto = require('crypto');

/**
 * Generate valid Razorpay payment signature for testing
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @returns {string} Valid signature
 */
function generateTestSignature(orderId, paymentId) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_SECRET not configured');
  }

  const text = `${orderId}|${paymentId}`;
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  return signature;
}

/**
 * Generate test payment verification data
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID (optional)
 * @returns {object} Payment verification data with valid signature
 */
function generateTestPaymentData(orderId, paymentId = null) {
  const testPaymentId = paymentId || `pay_test_${Date.now()}`;
  const signature = generateTestSignature(orderId, testPaymentId);

  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: testPaymentId,
    razorpay_signature: signature
  };
}

/**
 * Verify if signature is valid (for testing)
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Signature to verify
 * @returns {boolean} True if valid
 */
function verifyTestSignature(orderId, paymentId, signature) {
  const expectedSignature = generateTestSignature(orderId, paymentId);
  return expectedSignature === signature;
}

module.exports = {
  generateTestSignature,
  generateTestPaymentData,
  verifyTestSignature
};

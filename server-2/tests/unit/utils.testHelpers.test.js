const {
  generateTestSignature,
  generateTestPaymentData,
  verifyTestSignature
} = require('../../src/utils/testHelpers');

describe('testHelpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates valid signature', () => {
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    const signature = generateTestSignature('order_1', 'pay_1');
    expect(signature).toBeDefined();
    expect(verifyTestSignature('order_1', 'pay_1', signature)).toBe(true);
  });

  it('throws when secret missing', () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => generateTestSignature('order_1', 'pay_1')).toThrow('RAZORPAY_KEY_SECRET not configured');
  });

  it('generates payment data', () => {
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    const data = generateTestPaymentData('order_2', 'pay_2');
    expect(data.razorpay_order_id).toBe('order_2');
    expect(data.razorpay_payment_id).toBe('pay_2');
    expect(verifyTestSignature('order_2', 'pay_2', data.razorpay_signature)).toBe(true);
  });
});

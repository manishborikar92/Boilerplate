import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { RazorpayAdapter } from '../src/index.js';

test('RazorpayAdapter verifies payment signatures using timing-safe comparison', () => {
  const adapter = new RazorpayAdapter({
    client: { orders: {}, payments: {} },
    keySecret: 'secret',
    logger: { info() {} },
  });
  const signature = crypto.createHmac('sha256', 'secret').update('order_1|pay_1').digest('hex');

  assert.equal(adapter.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature }), true);
  assert.equal(adapter.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature }), false);
});

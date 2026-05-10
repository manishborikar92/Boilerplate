import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { CashfreePayoutAdapter } from '../src/index.js';

test('CashfreePayoutAdapter verifies webhook signatures', () => {
  const adapter = new CashfreePayoutAdapter({
    baseUrl: 'https://sandbox.cashfree.com/payout',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  const rawBody = '{"type":"TRANSFER_SUCCESS"}';
  const timestamp = '1710000000';
  const signature = crypto.createHmac('sha256', 'secret').update(`${timestamp}${rawBody}`).digest('base64');

  assert.equal(adapter.verifyWebhook({
    headers: {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
    },
    rawBody,
  }), true);
});

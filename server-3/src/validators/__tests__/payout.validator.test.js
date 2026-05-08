import assert from 'node:assert/strict';
import test from 'node:test';

import { payoutIdParamSchema } from '../payout.validator.js';

test('payoutIdParamSchema accepts a valid payout id', () => {
    const { error, value } = payoutIdParamSchema.validate({
        payoutId: '507f1f77bcf86cd799439013',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        payoutId: '507f1f77bcf86cd799439013',
    });
});

test('payoutIdParamSchema rejects invalid payout ids', () => {
    const { error } = payoutIdParamSchema.validate({
        payoutId: 'bad-id',
    });

    assert.match(error?.message || '', /invalid value|must be/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    bookingIdParamSchema,
    initiatePaymentSchema,
    paymentIdParamSchema,
    refundSchema,
    verifyPaymentSchema,
} from '../payment.validator.js';

test('initiatePaymentSchema accepts a valid booking id payload', () => {
    const { error, value } = initiatePaymentSchema.validate({
        bookingId: '507f1f77bcf86cd799439011',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        bookingId: '507f1f77bcf86cd799439011',
    });
});

test('paymentIdParamSchema requires a valid payment id', () => {
    const { error } = paymentIdParamSchema.validate({
        id: 'not-an-object-id',
    });

    assert.match(error?.message || '', /invalid value|must be/);
});

test('bookingIdParamSchema requires a valid booking id', () => {
    const { error, value } = bookingIdParamSchema.validate({
        bookingId: '507f1f77bcf86cd799439012',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        bookingId: '507f1f77bcf86cd799439012',
    });
});

test('refundSchema rejects reasons that are too short', () => {
    const { error } = refundSchema.validate({
        reason: 'no',
    });

    assert.match(error?.message || '', /at least 3 characters/);
});

test('verifyPaymentSchema accepts PhonePe SDK callback context without trusting it as final', () => {
    const { error, value } = verifyPaymentSchema.validate({
        sdkStatus: 'INTERRUPTED',
        sdkResponseCode: 'USER_CANCEL',
        sdkMessage: 'User returned from native SDK',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        sdkStatus: 'INTERRUPTED',
        sdkResponseCode: 'USER_CANCEL',
        sdkMessage: 'User returned from native SDK',
    });
});

test('verifyPaymentSchema rejects unknown SDK statuses', () => {
    const { error } = verifyPaymentSchema.validate({
        sdkStatus: 'TRUST_ME_BRO',
    });

    assert.match(error?.message || '', /must be one of/);
});

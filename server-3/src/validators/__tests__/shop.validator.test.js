import assert from 'node:assert/strict';
import test from 'node:test';

import { updateBusinessSchema, updatePayoutDetailsSchema } from '../shop.validator.js';

test('updateBusinessSchema normalizes shop hour updates from AM/PM to 24-hour values', () => {
    const result = updateBusinessSchema.validate({
        openTime: '09:00 AM',
        closeTime: '08:00 PM',
        breakTimes: '[{"start":"01:00 PM","end":"02:00 PM"}]',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.value.openTime, '09:00');
    assert.equal(result.value.closeTime, '20:00');
    assert.deepEqual(result.value.breakTimes, [{ start: '13:00', end: '14:00' }]);
});

test('updateBusinessSchema rejects invalid shop-hour strings', () => {
    const result = updateBusinessSchema.validate({
        openTime: 'morning',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.match(result.error?.message || '', /openTime must use HH:MM or hh:mm AM\/PM format/);
});

test('updateBusinessSchema rejects deprecated shop update aliases', () => {
    const result = updateBusinessSchema.validate({
        shopOwner: 'Postman Barber',
        businessCategory: 'Barber',
        shopLocation: 'MG Road',
        breakTimings: '[{"start":"13:00","end":"14:00"}]',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.match(result.error?.message || '', /shopOwner|businessCategory|shopLocation|breakTimings/);
});

test('updatePayoutDetailsSchema strips provider-managed beneficiary identifiers', () => {
    const result = updatePayoutDetailsSchema.validate({
        accountHolderName: 'Postman Barber',
        bankName: 'HDFC Bank',
        bankAccount: '12345678901234',
        ifsc: 'HDFC0001234',
        upiId: 'barber@upi',
        beneficiaryId: 'beneficiary-1',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.equal(result.error, undefined);
    assert.equal(Object.hasOwn(result.value, 'beneficiaryId'), false);
});

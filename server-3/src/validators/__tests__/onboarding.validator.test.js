import assert from 'node:assert/strict';
import test from 'node:test';

import { barberOnboardingSchema } from '../onboarding.validator.js';

const buildValidPayload = () => ({
    email: 'barber@example.com',
    firstName: 'Test',
    lastName: 'Barber',
    gender: 'Male',
    dateOfBirth: '1991-01-12',
    shopName: 'Postman Test Barber Studio',
    category: 'Barber',
    targetCustomers: 'male',
    upiId: 'test.barber@upi',
    accountHolderName: 'Test Barber',
    bankName: 'HDFC Bank',
    address: 'MG Road, Bengaluru',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    workingDays: ['Monday', 'Tuesday', 'Wednesday'],
    workingHours: '{"openTime":"09:00 AM","closeTime":"08:00 PM"}',
    breakTimes: '[{"start":"01:00 PM","end":"02:00 PM"}]',
    pin: '1234',
    confirmPin: '1234',
});

test('barberOnboardingSchema normalizes shop schedule to 24-hour strings', () => {
    const result = barberOnboardingSchema.validate(buildValidPayload(), {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.value.openTime, '09:00');
    assert.equal(result.value.closeTime, '20:00');
    assert.deepEqual(result.value.breakTimes, [{ start: '13:00', end: '14:00' }]);
});

test('barberOnboardingSchema rejects break times outside shop hours', () => {
    const result = barberOnboardingSchema.validate({
        ...buildValidPayload(),
        breakTimes: '[{"start":"08:00 AM","end":"09:30 AM"}]',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.match(result.error?.message || '', /breakTimes\[0\] must stay within shop hours/);
});

test('barberOnboardingSchema rejects deprecated barber onboarding aliases', () => {
    const result = barberOnboardingSchema.validate({
        ...buildValidPayload(),
        category: undefined,
        businessCategory: 'Barber',
        upiAddress: 'test.barber@upi',
    }, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
    });

    assert.match(result.error?.message || '', /businessCategory|upiAddress|category/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeBarberProfile } from '../barber-profile.utils.js';

test('serializeBarberProfile exposes a generic payout beneficiary identifier', () => {
    const serialized = serializeBarberProfile({
        _id: 'shop-1',
        shopName: 'Trim Studio',
        ownerName: 'Barber One',
        ownerFirstName: 'Barber',
        ownerLastName: 'One',
        ownerGender: 'male',
        ownerDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        category: 'salon',
        targetCustomers: 'male',
        upiId: 'barber@upi',
        accountHolderName: 'Barber One',
        bankName: 'Example Bank',
        payoutConfig: {
            bankAccount: '123456789012',
            ifsc: 'ABCD0123456',
            beneficiaryId: 'beneficiary-1',
            verificationStatus: 'verified',
        },
        address: 'Main Street',
        location: {
            type: 'Point',
            coordinates: [72.0, 23.0],
        },
        numberOfEmployees: 1,
        yearsOfExperience: 5,
        facilities: [],
        availableDays: ['monday'],
        openTime: '09:00',
        closeTime: '18:00',
        breakTimes: [],
        pinHash: 'secret',
    });

    assert.equal(serialized.payout.beneficiaryId, 'beneficiary-1');
    assert.equal(Object.hasOwn(serialized.payout, 'cashfreeBeneficiaryId'), false);
    assert.equal(Object.hasOwn(serialized, 'payoutConfig'), false);
});

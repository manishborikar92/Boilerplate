import assert from 'node:assert/strict';
import test from 'node:test';

import cashfreePayoutAdapter from '../cashfree-payout.adapter.js';

const mockFetch = (t, responseBody = {}) => {
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
        calls.push({
            url: String(url),
            method: options.method,
            body: options.body ? JSON.parse(options.body) : null,
        });

        return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    });

    return calls;
};

test('createBeneficiary sends Cashfree Payouts V2 beneficiary payload shape', async (t) => {
    const calls = mockFetch(t, { beneficiary_id: 'BARBER_1', beneficiary_status: 'VERIFIED' });

    await cashfreePayoutAdapter.createBeneficiary({
        beneficiaryId: 'BARBER_1',
        name: 'Test Barber',
        phone: '+919876543211',
        email: 'barber@example.com',
        vpa: 'test@upi',
    });

    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.beneficiary_id, 'BARBER_1');
    assert.equal(calls[0].body.beneficiary_name, 'Test Barber');
    assert.deepEqual(calls[0].body.beneficiary_instrument_details, {
        vpa: 'test@upi',
    });
    assert.deepEqual(calls[0].body.beneficiary_contact_details, {
        beneficiary_phone: '9876543211',
        beneficiary_country_code: '+91',
        beneficiary_email: 'barber@example.com',
    });
    assert.equal(Object.hasOwn(calls[0].body, 'beneficiary_phone'), false);
    assert.equal(Object.hasOwn(calls[0].body, 'beneficiary_email'), false);
});

test('getBeneficiary uses Cashfree Payouts V2 query parameter lookup', async (t) => {
    const calls = mockFetch(t, { beneficiary_id: 'BARBER_1' });

    await cashfreePayoutAdapter.getBeneficiary('BARBER_1');

    assert.match(calls[0].url, /\/beneficiary\?beneficiary_id=BARBER_1$/);
});

test('getTransferStatus uses Cashfree Payouts V2 transfer_id query lookup', async (t) => {
    const calls = mockFetch(t, {
        transfer_id: 'PAYOUT_1',
        cf_transfer_id: 'CF_1',
        status: 'SUCCESS',
        transfer_utr: 'UTR_1',
        updated_on: '2026-04-25T08:00:00Z',
    });

    const result = await cashfreePayoutAdapter.getTransferStatus('PAYOUT_1');

    assert.match(calls[0].url, /\/transfers\?transfer_id=PAYOUT_1$/);
    assert.equal(result.updatedAt, '2026-04-25T08:00:00Z');
});

test('parseWebhookPayload accepts Cashfree Payouts V2 type and data fields', () => {
    const result = cashfreePayoutAdapter.parseWebhookPayload({
        type: 'TRANSFER_SUCCESS',
        data: {
            transfer_id: 'PAYOUT_1',
            cf_transfer_id: 'CF_1',
            status: 'SUCCESS',
            transfer_utr: 'UTR_1',
            transfer_amount: 450,
            updated_on: '2026-04-25T08:00:00Z',
            failure_reason: null,
        },
    });

    assert.deepEqual(result, {
        event: 'TRANSFER_SUCCESS',
        transferId: 'PAYOUT_1',
        gatewayTransferId: 'CF_1',
        status: 'SUCCESS',
        utr: 'UTR_1',
        amount: 450,
        updatedAt: '2026-04-25T08:00:00Z',
        failureReason: null,
    });
});

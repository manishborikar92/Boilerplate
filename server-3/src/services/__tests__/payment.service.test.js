import assert from 'node:assert/strict';
import test from 'node:test';

const ensureRequiredEnv = () => {
    const defaults = {
        MONGODB_URI: 'mongodb://localhost:27017/evercut-test',
        FIREBASE_PROJECT_ID: 'evercut-test',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
        CLOUDINARY_CLOUD_NAME: 'evercut',
        CLOUDINARY_API_KEY: 'cloudinary-key',
        CLOUDINARY_API_SECRET: 'cloudinary-secret',
        MSG91_AUTH_KEY: 'msg91-auth',
        MSG91_OTP_TEMPLATE_ID: 'msg91-template',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        PHONEPE_CLIENT_ID: 'phonepe-client',
        PHONEPE_CLIENT_SECRET: 'phonepe-secret',
        PHONEPE_CLIENT_VERSION: '1',
        PHONEPE_MERCHANT_ID: 'merchant-id',
        PHONEPE_WEBHOOK_USERNAME: 'webhook-user',
        PHONEPE_WEBHOOK_PASSWORD: 'webhook-pass',
        CASHFREE_PAYOUT_CLIENT_ID: 'cashfree-client',
        CASHFREE_PAYOUT_CLIENT_SECRET: 'cashfree-secret',
    };

    for (const [key, value] of Object.entries(defaults)) {
        process.env[key] ??= value;
    }
};

ensureRequiredEnv();

const paymentService = await import('../payment.service.js');
const paymentRepository = (await import('../../repositories/payment.repository.js')).default;
const bookingRepository = (await import('../../repositories/booking.repository.js')).default;
const customerRepository = (await import('../../repositories/customer.repository.js')).default;
const employeeRepository = (await import('../../repositories/employee.repository.js')).default;
const serviceRepository = (await import('../../repositories/service.repository.js')).default;
const shopRepository = (await import('../../repositories/shop.repository.js')).default;
const phonePeAdapter = (await import('../../adapters/phonepe/phonepe.adapter.js')).default;

test('getPayments lists only the authenticated customer payments', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));

    let countFilter = null;
    t.mock.method(paymentRepository, 'countAll', async (filter) => {
        countFilter = filter;
        return 6;
    });

    let listArgs = null;
    t.mock.method(paymentRepository, 'findAll', async (filter, options) => {
        listArgs = { filter, options };
        return [
            {
                _id: 'payment-6',
                bookingId: 'booking-6',
                customerId: 'customer-1',
                shopId: 'shop-1',
                status: 'completed',
                amount: 12300,
                amountInRupees: 123,
                merchantOrderId: 'EC-booking-6',
            },
        ];
    });

    const result = await paymentService.getPayments(
        { _id: 'user-1', roleType: 'CUSTOMER' },
        { status: 'completed', page: 2, limit: 5 },
    );

    assert.deepEqual(countFilter, {
        customerId: 'customer-1',
        status: 'completed',
    });
    assert.deepEqual(listArgs, {
        filter: {
            customerId: 'customer-1',
            status: 'completed',
        },
        options: {
            skip: 5,
            limit: 5,
        },
    });
    assert.deepEqual(result.pagination, {
        currentPage: 2,
        totalPages: 2,
        totalDocuments: 6,
        hasNextPage: false,
        hasPrevPage: true,
    });
    assert.equal(result.items[0].id, 'payment-6');
    assert.equal('paymentId' in result.items[0], false);
});

test('getPayments lists only the authenticated barber shop payments', async (t) => {
    t.mock.method(shopRepository, 'findByOwnerId', async () => ({ _id: 'shop-1' }));

    let countFilter = null;
    t.mock.method(paymentRepository, 'countAll', async (filter) => {
        countFilter = filter;
        return 1;
    });

    let listArgs = null;
    t.mock.method(paymentRepository, 'findAll', async (filter, options) => {
        listArgs = { filter, options };
        return [
            {
                _id: 'payment-1',
                bookingId: 'booking-1',
                customerId: 'customer-1',
                shopId: 'shop-1',
                status: 'pending',
                amount: 12300,
                amountInRupees: 123,
                merchantOrderId: 'EC-booking-1',
            },
        ];
    });

    const result = await paymentService.getPayments(
        { _id: 'barber-1', roleType: 'BARBER' },
        { page: 1, limit: 10 },
    );

    assert.deepEqual(countFilter, { shopId: 'shop-1' });
    assert.deepEqual(listArgs, {
        filter: { shopId: 'shop-1' },
        options: {
            skip: 0,
            limit: 10,
        },
    });
    assert.equal(result.items[0].shopId, 'shop-1');
});

test('initiatePayment creates a native PhonePe SDK order and never returns a redirect URL', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-1',
        shopId: 'shop-1',
        serviceIds: ['service-1'],
        status: 'pending',
        paymentStatus: 'pending',
        totalAmount: 120,
    }));
    t.mock.method(paymentRepository, 'findPendingByBookingId', async () => null);
    t.mock.method(serviceRepository, 'findByIds', async () => ([
        {
            _id: 'service-1',
            serviceType: 'single',
            finalPrice: 120,
            duration: 30,
        },
    ]));

    let createdPayment = null;
    t.mock.method(paymentRepository, 'create', async (payload) => {
        createdPayment = payload;
        return {
            _id: 'payment-1',
            ...payload,
        };
    });

    let gatewayArgs = null;
    t.mock.method(phonePeAdapter, 'createOrder', async (args) => {
        gatewayArgs = args;
        return {
            orderId: 'OMO-native-1',
            token: 'sdk-order-token',
            state: 'PENDING',
            expiresAt: 1777037869000,
        };
    });

    const paymentUpdates = [];
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdates.push({ id, updates });
        return { _id: id, ...updates };
    });

    let bookingUpdate = null;
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdate = { id, updates };
        return { _id: id, ...updates };
    });

    const result = await paymentService.initiatePayment('user-1', 'booking-1');

    assert.equal(result.redirectUrl, undefined);
    assert.equal(result.id, 'payment-1');
    assert.equal('paymentId' in result, false);
    assert.equal(result.bookingId, 'booking-1');
    assert.equal(result.orderId, 'OMO-native-1');
    assert.equal(result.token, 'sdk-order-token');
    assert.equal(result.merchantId, 'merchant-id');
    assert.equal(result.gateway, 'phonepe');
    assert.equal(result.amountInPaisa, 12300);
    assert.equal(result.amountInRupees, 123);
    assert.equal(result.state, 'PENDING');
    assert.equal(result.expiresAt, 1777037869000);
    assert.match(result.merchantOrderId, /^EC-booking-1-/);

    assert.equal(gatewayArgs.redirectUrl, undefined);
    assert.equal(gatewayArgs.amount, 12300);
    assert.equal(gatewayArgs.metadata.bookingId, 'booking-1');

    assert.equal(createdPayment.amount, 12300);
    assert.equal(paymentUpdates[0].id, 'payment-1');
    assert.equal(paymentUpdates[0].updates.gatewayOrderId, 'OMO-native-1');
    assert.equal(paymentUpdates[0].updates.sdkOrderTokenIssued, true);
    assert.equal(paymentUpdates[0].updates.redirectUrl, undefined);
    assert.deepEqual(bookingUpdate, {
        id: 'booking-1',
        updates: {
            paymentTransactionId: 'payment-1',
            merchantOrderId: result.merchantOrderId,
            paymentStatus: 'initiated',
            paymentGateway: 'phonepe',
        },
    });
});

test('initiatePayment reuses an unexpired pending native SDK order without exposing redirect URLs', async (t) => {
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));
    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        customerId: 'customer-1',
        shopId: 'shop-1',
        serviceIds: ['service-1'],
        status: 'pending',
        paymentStatus: 'initiated',
        totalAmount: 120,
    }));
    t.mock.method(paymentRepository, 'findPendingByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1-reuse',
        gatewayOrderId: 'OMO-native-1',
        amount: 12300,
        amountInRupees: 123,
        gatewayState: 'PENDING',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }));

    const gatewayMock = t.mock.method(phonePeAdapter, 'createOrder', async () => {
        throw new Error('should not create a duplicate native order');
    });

    const result = await paymentService.initiatePayment('user-1', 'booking-1');

    assert.equal(result.redirectUrl, undefined);
    assert.equal(result.token, null);
    assert.equal(result.reusable, true);
    assert.equal(result.orderId, 'OMO-native-1');
    assert.equal(result.id, 'payment-1');
    assert.equal('paymentId' in result, false);
    assert.equal(result.merchantOrderId, 'EC-booking-1-reuse');
    assert.equal(gatewayMock.mock.calls.length, 0);
});

test('verifyPayment confirms native SDK results through PhonePe order status before returning success', async (t) => {
    let currentPayment = {
        _id: 'payment-1',
        bookingId: 'booking-1',
        customerId: 'customer-1',
        merchantOrderId: 'EC-booking-1',
        status: 'pending',
        amount: 12300,
        amountInRupees: 123,
    };

    t.mock.method(paymentRepository, 'findById', async () => currentPayment);
    t.mock.method(paymentRepository, 'findByMerchantOrderId', async () => currentPayment);
    t.mock.method(customerRepository, 'findByUserId', async () => ({ _id: 'customer-1' }));
    t.mock.method(phonePeAdapter, 'getOrderStatus', async (merchantOrderId) => ({
        orderId: 'OMO-native-1',
        merchantOrderId,
        state: 'COMPLETED',
        amount: 12300,
        paymentDetails: [{
            paymentMode: 'UPI_INTENT',
            transactionId: 'TXN-native-1',
            amount: 12300,
            state: 'COMPLETED',
        }],
    }));

    const paymentUpdates = [];
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdates.push({ id, updates });
        currentPayment = { ...currentPayment, ...updates };
        return { _id: id, ...currentPayment };
    });

    const bookingUpdates = [];
    let currentBooking = {
        _id: 'booking-1',
        status: 'pending',
        paymentStatus: 'initiated',
    };
    t.mock.method(bookingRepository, 'findById', async () => currentBooking);
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdates.push({ id, updates });
        currentBooking = { ...currentBooking, ...updates };
        return { _id: id, ...currentBooking };
    });

    const result = await paymentService.verifyPayment('user-1', 'payment-1', {
        sdkStatus: 'SUCCESS',
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.gatewayState, 'COMPLETED');
    assert.equal(result.bookingStatus, 'awaiting_confirmation');
    assert.equal(result.paymentStatus, 'success');
    assert.equal(result.sdkStatus, 'SUCCESS');
    assert.equal(result.orderId, 'OMO-native-1');
    assert.equal(result.transactionId, 'TXN-native-1');
    assert.equal(paymentUpdates[0].updates.status, 'completed');
    assert.equal(bookingUpdates[0].updates.status, 'awaiting_confirmation');
    assert.equal(bookingUpdates[0].updates.paymentStatus, 'success');
});

test('initiateRefund deducts the refund fee and non-refundable platform fee before calling PhonePe', async (t) => {
    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        amount: 31900,
        amountInRupees: 319,
        status: 'completed',
        settlement: {
            isBundle: true,
            platformFee: 1000,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        payoutStatus: 'not_initiated',
    }));

    let phonePeRefundArgs = null;
    t.mock.method(phonePeAdapter, 'initiateRefund', async (args) => {
        phonePeRefundArgs = args;
        return {
            refundId: 'refund-1',
            state: 'PENDING',
        };
    });

    const paymentUpdates = [];
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdates.push({ id, updates });
        return { _id: id, ...updates };
    });

    const bookingUpdates = [];
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdates.push({ id, updates });
        return { _id: id, ...updates };
    });

    const result = await paymentService.initiateRefund('booking-1', 'Customer cancelled before service');

    assert.deepEqual(phonePeRefundArgs, {
        merchantRefundId: phonePeRefundArgs.merchantRefundId,
        originalMerchantOrderId: 'EC-booking-1',
        amount: 29400,
    });
    assert.ok(phonePeRefundArgs.merchantRefundId.length <= 63);
    assert.match(phonePeRefundArgs.merchantRefundId, /^RF-[a-f0-9]{24}-[a-f0-9]{12}$/);
    assert.equal(paymentUpdates[0].updates.refundFee, 1500);
    assert.equal(paymentUpdates[0].updates.refund.amount, 29400);
    assert.deepEqual(bookingUpdates[0], {
        id: 'booking-1',
        updates: {
            paymentStatus: 'refund_pending',
        },
    });
    assert.deepEqual(result, {
        merchantRefundId: phonePeRefundArgs.merchantRefundId,
        refundId: 'refund-1',
        state: 'PENDING',
        refundAmount: 294,
        refundType: 'cancellation',
        deductions: {
            refundFee: 15,
            platformFee: 10,
        },
    });
});

test('initiateRefund generates PhonePe-safe merchant refund ids under 63 characters', async (t) => {
    const longMerchantOrderId = 'EC-69e9f8d19a40bca252b1b9b7-1776941837220-95fa2463';

    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: '69e9f8d19a40bca252b1b9b7',
        merchantOrderId: longMerchantOrderId,
        amount: 10200,
        status: 'completed',
        settlement: {
            serviceAmount: 9900,
            platformFee: 300,
            isBundle: false,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: '69e9f8d19a40bca252b1b9b7',
        totalAmount: 99,
        payoutStatus: 'not_initiated',
    }));

    let merchantRefundId = null;
    t.mock.method(phonePeAdapter, 'initiateRefund', async (args) => {
        merchantRefundId = args.merchantRefundId;
        return {
            refundId: 'refund-1',
            state: 'PENDING',
        };
    });

    t.mock.method(paymentRepository, 'updateById', async (id, updates) => ({ _id: id, ...updates }));
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => ({ _id: id, ...updates }));

    await paymentService.initiateRefund('69e9f8d19a40bca252b1b9b7', 'Customer cancelled before service');

    assert.ok(merchantRefundId.length <= 63);
    assert.match(merchantRefundId, /^RF-[a-f0-9]{24}-[a-f0-9]{12}$/);
});

test('initiateRefund records provider refund initiation failures for manual follow-up', async (t) => {
    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        amount: 10200,
        status: 'completed',
        settlement: {
            serviceAmount: 9900,
            platformFee: 300,
            isBundle: false,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        totalAmount: 99,
        payoutStatus: 'not_initiated',
    }));

    t.mock.method(phonePeAdapter, 'initiateRefund', async () => {
        throw new Error('PhonePe refund sandbox failure');
    });

    let paymentUpdate = null;
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdate = updates;
        return { _id: id, ...updates };
    });
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => ({ _id: id, ...updates }));

    await assert.rejects(
        paymentService.initiateRefund('booking-1', 'Customer cancelled before service'),
        /Refund could not be initiated/,
    );

    assert.equal(paymentUpdate.status, 'refund_failed');
    assert.equal(paymentUpdate.refund.status, 'failed');
    assert.equal(paymentUpdate.refund.manualResolutionRequired, true);
    assert.match(paymentUpdate.refund.failureReason, /PhonePe refund sandbox failure/);
});

test('initiateRefund blocks automatic refunds once payout has already started', async (t) => {
    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        amount: 10200,
        status: 'completed',
        settlement: {
            isBundle: false,
            platformFee: 300,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        payoutStatus: 'pending',
    }));

    const gatewayMock = t.mock.method(phonePeAdapter, 'initiateRefund', async () => {
        throw new Error('should not call gateway when payout already started');
    });

    await assert.rejects(
        paymentService.initiateRefund('booking-1', 'Customer requested cancellation'),
        /Refund window has closed/,
    );

    assert.equal(gatewayMock.mock.calls.length, 0);
});

test('initiateRefund rejects barbers who do not own the booking shop', async (t) => {
    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        amount: 10200,
        status: 'completed',
        settlement: {
            isBundle: false,
            platformFee: 300,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        shopId: 'shop-1',
        payoutStatus: 'not_initiated',
    }));

    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-2',
    }));

    const gatewayMock = t.mock.method(phonePeAdapter, 'initiateRefund', async () => {
        throw new Error('should not call gateway for another barber');
    });

    await assert.rejects(
        paymentService.initiateRefund(
            'booking-1',
            'Customer cancelled before service',
            { role: 'BARBER', userId: 'barber-2' },
        ),
        /own shop/,
    );

    assert.equal(gatewayMock.mock.calls.length, 0);
});

test('initiateRefund enforces barber ownership when the actor uses req.user.roleType semantics', async (t) => {
    t.mock.method(paymentRepository, 'findCompletedByBookingId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        amount: 10200,
        status: 'completed',
        settlement: {
            isBundle: false,
            platformFee: 300,
        },
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        shopId: 'shop-1',
        payoutStatus: 'not_initiated',
    }));

    t.mock.method(shopRepository, 'findByOwnerId', async () => ({
        _id: 'shop-2',
    }));

    const gatewayMock = t.mock.method(phonePeAdapter, 'initiateRefund', async () => ({
        refundId: 'refund-1',
        state: 'PENDING',
    }));
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => ({
        _id: id,
        ...updates,
    }));
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => ({
        _id: id,
        ...updates,
    }));

    await assert.rejects(
        paymentService.initiateRefund(
            'booking-1',
            'Customer cancelled before service',
            { roleType: 'BARBER', userId: 'barber-2' },
        ),
        /own shop/,
    );

    assert.equal(gatewayMock.mock.calls.length, 0);
});

test('handleWebhook ignores late payment failure events after a payment is already completed', async (t) => {
    t.mock.method(phonePeAdapter, 'verifyWebhook', () => true);
    t.mock.method(phonePeAdapter, 'parseWebhookPayload', () => ({
        event: 'checkout.order.failed',
        merchantOrderId: 'EC-booking-1',
        state: 'FAILED',
        paymentDetails: [],
        errorContext: {
            errorCode: 'PAYMENT_DECLINED',
        },
    }));
    t.mock.method(phonePeAdapter, 'getOrderStatus', async () => ({
        state: 'FAILED',
        paymentDetails: [],
        errorCode: 'PAYMENT_DECLINED',
        errorContext: {
            errorCode: 'PAYMENT_DECLINED',
        },
    }));

    t.mock.method(paymentRepository, 'findByMerchantOrderId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        status: 'completed',
    }));

    const paymentUpdateMock = t.mock.method(paymentRepository, 'updateById', async () => {
        throw new Error('completed payments should not be downgraded');
    });
    const bookingUpdateMock = t.mock.method(bookingRepository, 'updateById', async () => {
        throw new Error('completed bookings should not be downgraded');
    });

    const result = await paymentService.handleWebhook(
        { authorization: 'valid-webhook-auth' },
        {},
    );

    assert.deepEqual(result, {
        processed: true,
        event: 'checkout.order.failed',
    });
    assert.equal(paymentUpdateMock.mock.calls.length, 0);
    assert.equal(bookingUpdateMock.mock.calls.length, 0);
});

test('handleWebhook rejects completed payments when the verified PhonePe amount differs from the stored amount', async (t) => {
    t.mock.method(phonePeAdapter, 'verifyWebhook', () => true);
    t.mock.method(phonePeAdapter, 'parseWebhookPayload', () => ({
        event: 'checkout.order.completed',
        merchantOrderId: 'EC-booking-1',
        state: 'COMPLETED',
        amount: 10100,
        paymentDetails: [],
    }));
    t.mock.method(phonePeAdapter, 'getOrderStatus', async () => ({
        state: 'COMPLETED',
        amount: 10100,
        paymentDetails: [],
    }));

    t.mock.method(paymentRepository, 'findByMerchantOrderId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        status: 'pending',
        amount: 10200,
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        employeeId: 'employee-1',
        date: new Date('2099-01-01T00:00:00.000Z'),
        time: '10:00',
        status: 'pending',
        paymentStatus: 'initiated',
        slotLockTimes: ['10:00'],
    }));

    const originalReleaseSlots = employeeRepository.releaseSlots;
    if (!employeeRepository.releaseSlots) employeeRepository.releaseSlots = async () => null;
    t.after(() => {
        if (originalReleaseSlots) employeeRepository.releaseSlots = originalReleaseSlots;
        else delete employeeRepository.releaseSlots;
    });

    let released = null;
    t.mock.method(employeeRepository, 'releaseSlots', async (employeeId, date, times) => {
        released = { employeeId, date, times };
        return { acknowledged: true };
    });

    let paymentUpdate = null;
    let bookingUpdate = null;
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdate = { id, updates };
        return { _id: id, ...updates };
    });
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdate = { id, updates };
        return { _id: id, ...updates };
    });

    const result = await paymentService.handleWebhook(
        { authorization: 'valid-webhook-auth' },
        {},
    );

    assert.deepEqual(result, {
        processed: true,
        event: 'checkout.order.completed',
    });
    assert.equal(paymentUpdate.id, 'payment-1');
    assert.equal(paymentUpdate.updates.status, 'failed');
    assert.equal(paymentUpdate.updates.errorCode, 'AMOUNT_MISMATCH');
    assert.match(paymentUpdate.updates.errorDescription, /amount mismatch/i);
    assert.deepEqual(released, {
        employeeId: 'employee-1',
        date: '2099-01-01',
        times: ['10:00'],
    });
    assert.deepEqual(bookingUpdate, {
        id: 'booking-1',
        updates: {
            status: 'cancelled',
            paymentStatus: 'failed',
            cancelledAt: bookingUpdate.updates.cancelledAt,
            cancellationNote: 'Payment verification failed. Please create a new booking.',
        },
    });
    assert.ok(bookingUpdate.updates.cancelledAt instanceof Date);
});

test('handleWebhook completes a cancellation refund and marks the booking refunded', async (t) => {
    t.mock.method(phonePeAdapter, 'verifyWebhook', () => true);
    t.mock.method(phonePeAdapter, 'parseWebhookPayload', () => ({
        event: 'pg.refund.completed',
        originalMerchantOrderId: 'EC-booking-1',
        merchantRefundId: 'RF-cancel-1',
        refundId: 'refund-cancel-1',
        state: 'COMPLETED',
    }));

    t.mock.method(paymentRepository, 'findByMerchantOrderId', async () => ({
        _id: 'payment-1',
        bookingId: 'booking-1',
        merchantOrderId: 'EC-booking-1',
        status: 'refund_pending',
        refund: {
            merchantRefundId: 'RF-cancel-1',
            gatewayRefundId: 'refund-cancel-1',
            amount: 39400,
            status: 'pending',
            type: 'cancellation',
        },
    }));

    let paymentUpdate = null;
    let bookingUpdate = null;
    t.mock.method(paymentRepository, 'updateById', async (id, updates) => {
        paymentUpdate = updates;
        return { _id: id, ...updates };
    });
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdate = updates;
        return { _id: id, ...updates };
    });

    const result = await paymentService.handleWebhook({ authorization: 'valid-webhook-auth' }, {});

    assert.deepEqual(result, {
        processed: true,
        event: 'pg.refund.completed',
    });
    assert.equal(paymentUpdate.status, 'refunded');
    assert.equal(paymentUpdate.refund.status, 'completed');
    assert.deepEqual(bookingUpdate, {
        paymentStatus: 'refunded',
    });
});

test('pollPendingPayments expires checkout sessions based on current time, not 24-hour-old records only', async (t) => {
    t.mock.method(paymentRepository, 'findStalePayments', async () => []);

    let capturedExpiryCutoff = null;
    t.mock.method(paymentRepository, 'findExpirablePendingPayments', async (expiresBefore) => {
        capturedExpiryCutoff = expiresBefore;
        return [];
    });

    await paymentService.pollPendingPayments();

    assert.ok(capturedExpiryCutoff instanceof Date);
    assert.ok(
        Date.now() - capturedExpiryCutoff.getTime() < 60_000,
        'expected pollPendingPayments() to use the current time as the expiry cutoff',
    );
});

test('pollPendingPayments releases held booking slots when checkout sessions expire', async (t) => {
    t.mock.method(paymentRepository, 'findStalePayments', async () => []);
    t.mock.method(paymentRepository, 'findExpirablePendingPayments', async () => ([
        {
            _id: 'payment-1',
            bookingId: 'booking-1',
        },
    ]));

    t.mock.method(paymentRepository, 'updateById', async (id, updates) => ({
        _id: id,
        ...updates,
    }));

    t.mock.method(bookingRepository, 'findById', async () => ({
        _id: 'booking-1',
        employeeId: 'employee-1',
        date: new Date('2099-01-01T00:00:00.000Z'),
        time: '10:00',
        status: 'pending',
        paymentStatus: 'initiated',
        slotLockTimes: ['10:00', '10:30'],
    }));

    const bookingUpdates = [];
    t.mock.method(bookingRepository, 'updateById', async (id, updates) => {
        bookingUpdates.push({ id, updates });
        return { _id: id, ...updates };
    });

    const originalReleaseSlots = employeeRepository.releaseSlots;
    if (!employeeRepository.releaseSlots) employeeRepository.releaseSlots = async () => null;
    t.after(() => {
        if (originalReleaseSlots) employeeRepository.releaseSlots = originalReleaseSlots;
        else delete employeeRepository.releaseSlots;
    });

    let released = null;
    t.mock.method(employeeRepository, 'releaseSlots', async (employeeId, date, times) => {
        released = { employeeId, date, times };
        return { acknowledged: true };
    });

    await paymentService.pollPendingPayments();

    assert.deepEqual(released, {
        employeeId: 'employee-1',
        date: '2099-01-01',
        times: ['10:00', '10:30'],
    });
    assert.deepEqual(bookingUpdates[0], {
        id: 'booking-1',
        updates: {
            status: 'cancelled',
            paymentStatus: 'failed',
            cancelledAt: bookingUpdates[0].updates.cancelledAt,
            cancellationNote: 'Payment session expired before confirmation. Please create a new booking.',
        },
    });
    assert.ok(bookingUpdates[0].updates.cancelledAt instanceof Date);
});

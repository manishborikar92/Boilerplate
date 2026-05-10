const crypto = require('crypto');

const loadService = (razorpayMock) => {
  jest.resetModules();
  jest.doMock('../../src/config/razorpay', () => ({ razorpay: razorpayMock }));
  jest.doMock('../../src/middleware/logger', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn()
    }
  }));
  let service;
  let InternalError;
  jest.isolateModules(() => {
    service = require('../../src/services/razorpayService');
    ({ InternalError } = require('../../src/utils/errorHandler'));
  });
  return { service, InternalError };
};

describe('razorpayService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('creates order and handles missing configuration', async () => {
    const razorpayMock = { orders: { create: jest.fn().mockResolvedValue({ id: 'order_1' }) } };
    const { service } = loadService(razorpayMock);
    const order = await service.createOrder({ amount: 123, receipt: 'r1' });
    expect(order.id).toBe('order_1');

    const { service: noService, InternalError } = loadService(null);
    await expect(noService.createOrder({ amount: 1, receipt: 'r2' })).rejects.toThrow(InternalError);
  });

  it('verifies payment signatures and handles errors', () => {
    const { service } = loadService({ orders: { create: jest.fn() } });
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    const text = 'order_1|pay_1';
    const signature = crypto.createHmac('sha256', 'secret').update(text).digest('hex');
    expect(service.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature })).toBe(true);
    expect(service.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'bad' })).toBe(false);

    const spy = jest.spyOn(crypto, 'createHmac').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(service.verifyPaymentSignature({ orderId: 'o', paymentId: 'p', signature: 's' })).toBe(false);
    spy.mockRestore();
  });

  it('fetches payment and handles errors', async () => {
    const razorpayMock = { payments: { fetch: jest.fn().mockResolvedValue({ id: 'pay_1' }) } };
    const { service } = loadService(razorpayMock);
    const payment = await service.getPayment('pay_1');
    expect(payment.id).toBe('pay_1');

    const { service: noService } = loadService(null);
    await expect(noService.getPayment('pay_1')).rejects.toThrow('Failed to fetch payment details');
  });

  it('creates plan with notes and validates fields', async () => {
    const razorpayMock = { plans: { create: jest.fn().mockResolvedValue({ id: 'plan_1' }) } };
    const { service } = loadService(razorpayMock);
    const plan = await service.createPlan({
      period: 'monthly',
      interval: 1,
      item: { name: 'Pro', amount: 1000, description: 'x' },
      notes: { a: '1' }
    });
    expect(plan.id).toBe('plan_1');

    const planNoNotes = await service.createPlan({
      period: 'monthly',
      interval: 1,
      item: { name: 'Starter', amount: 500, description: 'x' }
    });
    expect(planNoNotes.id).toBe('plan_1');

    await expect(service.createPlan({})).rejects.toThrow('Missing required fields');
    await expect(service.createPlan({ period: 'monthly', interval: 1, item: {} })).rejects.toThrow('Missing required item fields');

    const { service: noService } = loadService(null);
    await expect(noService.createPlan({ period: 'monthly', interval: 1, item: { name: 'x', amount: 1 } })).rejects.toThrow('Razorpay not configured');
  });

  it('creates subscription with options and handles errors', async () => {
    const razorpayMock = { subscriptions: { create: jest.fn().mockResolvedValue({ id: 'sub_1' }) } };
    const { service } = loadService(razorpayMock);
    const startAt = new Date();
    const sub = await service.createSubscription({
      planId: 'plan_1',
      totalCount: 2,
      customerId: 'cust_1',
      notes: { a: '1' },
      startAt,
      addons: [{ item: { name: 'addon' } }],
      quantity: 2
    });
    expect(sub.id).toBe('sub_1');

    const subMinimal = await service.createSubscription({
      planId: 'plan_1'
    });
    expect(subMinimal.id).toBe('sub_1');

    const { service: noService } = loadService(null);
    await expect(noService.createSubscription({ planId: 'plan_1' })).rejects.toThrow('Failed to create subscription');
  });

  it('updates, pauses, resumes, fetches, cancels subscriptions', async () => {
    const razorpayMock = {
      subscriptions: {
        update: jest.fn().mockResolvedValue({ id: 'sub_1' }),
        pause: jest.fn().mockResolvedValue({ id: 'sub_1' }),
        resume: jest.fn().mockResolvedValue({ id: 'sub_1' }),
        fetch: jest.fn().mockResolvedValue({ id: 'sub_1' }),
        cancel: jest.fn().mockResolvedValue({ id: 'sub_1' })
      }
    };
    const { service } = loadService(razorpayMock);
    expect((await service.updateSubscription('sub_1', {})).id).toBe('sub_1');
    expect((await service.pauseSubscription('sub_1')).id).toBe('sub_1');
    expect((await service.resumeSubscription('sub_1')).id).toBe('sub_1');
    expect((await service.getSubscription('sub_1')).id).toBe('sub_1');
    expect((await service.cancelSubscription('sub_1', true)).id).toBe('sub_1');
    expect((await service.cancelSubscription('sub_1', false)).id).toBe('sub_1');

    const { service: noService } = loadService(null);
    await expect(noService.updateSubscription('sub_1', {})).rejects.toThrow('Failed to update subscription');
    await expect(noService.pauseSubscription('sub_1')).rejects.toThrow('Failed to pause subscription');
    await expect(noService.resumeSubscription('sub_1')).rejects.toThrow('Failed to resume subscription');
    await expect(noService.getSubscription('sub_1')).rejects.toThrow('Failed to fetch subscription');
    await expect(noService.cancelSubscription('sub_1')).rejects.toThrow('Failed to cancel subscription');
  });

  it('creates customer and payment link', async () => {
    const razorpayMock = {
      customers: { create: jest.fn().mockResolvedValue({ id: 'cust_1' }) },
      paymentLink: { create: jest.fn().mockResolvedValue({ id: 'plink_1' }) }
    };
    const { service } = loadService(razorpayMock);
    const customer = await service.createCustomer({ name: 'A', email: 'a@test.com', contact: '1' });
    expect(customer.id).toBe('cust_1');

    const link = await service.createPaymentLink({
      amount: 1000,
      description: 'd',
      customerId: { phoneNumber: '1', email: 'a@test.com', companyName: 'Co' },
      callbackUrl: 'http://x'
    });
    expect(link.id).toBe('plink_1');

    const { service: noService } = loadService(null);
    await expect(noService.createCustomer({ name: 'A' })).rejects.toThrow('Failed to create customer');
    await expect(noService.createPaymentLink({ amount: 1, description: 'd' })).rejects.toThrow('Failed to create payment link');
  });

  it('verifies webhook signature', () => {
    const { service } = loadService({ orders: { create: jest.fn() } });
    process.env.RAZORPAY_WEBHOOK_SECRET = 'secret';
    const body = { a: 1 };
    const message = JSON.stringify(body);
    const signature = crypto.createHmac('sha256', 'secret').update(message).digest('hex');
    expect(service.verifyWebhookSignature(body, signature, 'secret')).toBe(true);
    const signatureEnv = crypto.createHmac('sha256', 'secret').update(message).digest('hex');
    expect(service.verifyWebhookSignature(body, signatureEnv)).toBe(true);
    const buffer = Buffer.from('buffer-body', 'utf8');
    const bufferSignature = crypto.createHmac('sha256', 'secret').update(buffer.toString('utf8')).digest('hex');
    expect(service.verifyWebhookSignature(buffer, bufferSignature, 'secret')).toBe(true);
    expect(service.verifyWebhookSignature('test', '', 'secret')).toBe(false);
    expect(service.verifyWebhookSignature('test', 'bad', 'secret')).toBe(false);

    const spy = jest.spyOn(crypto, 'createHmac').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(service.verifyWebhookSignature('test', 'sig', 'secret')).toBe(false);
    spy.mockRestore();
  });

  it('refunds payments', async () => {
    const razorpayMock = { payments: { refund: jest.fn().mockResolvedValue({ id: 'ref_1' }) } };
    const { service } = loadService(razorpayMock);
    const refund = await service.refundPayment('pay_1', 100);
    expect(refund.id).toBe('ref_1');

    const refund2 = await service.refundPayment('pay_1');
    expect(refund2.id).toBe('ref_1');

    const { service: noService } = loadService(null);
    await expect(noService.refundPayment('pay_1')).rejects.toThrow('Failed to process refund');
  });
});

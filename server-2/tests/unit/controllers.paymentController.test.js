const mongoose = require('mongoose');

const buildController = (overrides = {}) => {
  jest.resetModules();
  const paymentModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn()
  };
  const clientModel = { findById: jest.fn(), findOne: jest.fn(), find: jest.fn() };
  const firmModel = { findById: jest.fn() };
  const documentModel = { updateMany: jest.fn() };
  const subscriptionModel = { findById: jest.fn() };

  const razorpayService = {
    verifyPaymentSignature: jest.fn(),
    getPayment: jest.fn(),
    verifyWebhookSignature: jest.fn()
  };
  const chatMessagePaymentService = {
    initiatePaymentOrder: jest.fn(),
    markChatMessagePaymentPaid: jest.fn()
  };

  Object.assign(paymentModel, overrides.Payment || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(firmModel, overrides.Firm || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(razorpayService, overrides.razorpayService || {});
  Object.assign(chatMessagePaymentService, overrides.chatMessagePaymentService || {});
  Object.assign(subscriptionModel, overrides.Subscription || {});

  jest.doMock('../../src/models/Payment', () => paymentModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Firm', () => firmModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/models/Subscription', () => subscriptionModel);
  jest.doMock('../../src/services/razorpayService', () => razorpayService);
  jest.doMock('../../src/services/chatMessagePaymentService', () => chatMessagePaymentService);
  jest.doMock('../../src/services/notificationService', () => ({
    notifyPaymentReceived: jest.fn(),
    notifyPaymentFailed: jest.fn(),
    notifySubscriptionActivated: jest.fn()
  }));
  jest.doMock('../../src/controllers/subscriptionController', () => ({
    activateFirmSubscription: jest.fn(),
    renewFirmSubscription: jest.fn(),
    deactivateFirmSubscription: jest.fn()
  }));

  const controller = require('../../src/controllers/paymentController');
  return { controller, mocks: { Payment: paymentModel, Client: clientModel, Firm: firmModel, Document: documentModel, Subscription: subscriptionModel, razorpayService, chatMessagePaymentService } };
};

const run = async (handler, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  await handler(req, res, next);
  await new Promise(setImmediate);
  return { res, next };
};

describe('paymentController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects verifyPayment when params missing or signature invalid', async () => {
    const { controller, mocks } = buildController({
      razorpayService: { verifyPaymentSignature: jest.fn().mockReturnValue(false) }
    });
    const { next: missingNext } = await run(controller.verifyPayment, { body: {} });
    expect(missingNext.mock.calls[0][0].message).toContain('Missing payment');

    const { next } = await run(controller.verifyPayment, {
      body: { razorpay_order_id: 'o1', razorpay_payment_id: 'p1', razorpay_signature: 's1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid payment signature');
    expect(mocks.razorpayService.verifyPaymentSignature).toHaveBeenCalled();
  });

  it('verifies payment and handles chat-message flow', async () => {
    const payment = {
      _id: 'pay1',
      paymentType: 'chat-message',
      clientId: 'c1',
      save: jest.fn()
    };
    const { controller, mocks } = buildController({
      razorpayService: {
        verifyPaymentSignature: jest.fn().mockReturnValue(true),
        getPayment: jest.fn().mockResolvedValue({ method: 'card' })
      },
      Payment: { findOne: jest.fn().mockResolvedValue(payment) }
    });
    mocks.Client.findById.mockResolvedValue({ _id: 'c1' });

    const { res, next } = await run(controller.verifyPayment, {
      body: { razorpay_order_id: 'o1', razorpay_payment_id: 'p1', razorpay_signature: 's1' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('throws when payment record not found', async () => {
    const { controller } = buildController({
      razorpayService: { verifyPaymentSignature: jest.fn().mockReturnValue(true) },
      Payment: { findOne: jest.fn().mockResolvedValue(null) }
    });
    const { next } = await run(controller.verifyPayment, {
      body: { razorpay_order_id: 'o1', razorpay_payment_id: 'p1', razorpay_signature: 's1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Payment not found');
  });

  it('validates sorting and returns payments', async () => {
    const { controller, mocks } = buildController();
    const { next } = await run(controller.getPayments, {
      query: { sortBy: 'bad' },
      user: { firmId: 'f1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid sortBy');

    mocks.Client.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'c1' }])
    });
    mocks.Payment.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([{ _id: 'p1' }])
    });
    mocks.Payment.countDocuments.mockResolvedValue(1);

    const { res } = await run(controller.getPayments, {
      query: { search: 'test', sortBy: 'createdAt', sortOrder: 'asc' },
      user: { firmId: 'f1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pagination: expect.objectContaining({ total: 1 }) })
    }));
  });

  it('enforces payment access for client', async () => {
    const payment = { _id: 'p1', firmId: 'f1', clientId: { _id: 'c2' } };
    const query = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(payment)
    };
    const { controller } = buildController({
      Payment: { findById: jest.fn().mockReturnValue(query) },
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) }
    });

    const { next } = await run(controller.getPayment, {
      params: { id: 'p1' },
      user: { role: 'Client', _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Not authorized');
  });

  it('returns client payments and validates sort order', async () => {
    const { controller, mocks } = buildController({
      Client: { findOne: jest.fn().mockResolvedValue({ _id: 'c1' }) }
    });
    const { next } = await run(controller.getMyPayments, {
      query: { sortBy: 'createdAt', sortOrder: 'bad' },
      user: { _id: 'u1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid sortOrder');

    mocks.Payment.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([{ _id: 'p1' }])
    });
    mocks.Payment.countDocuments.mockResolvedValue(1);

    const { res } = await run(controller.getMyPayments, {
      query: { sortBy: 'createdAt', sortOrder: 'desc' },
      user: { _id: 'u1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pagination: expect.objectContaining({ total: 1 }) })
    }));
  });

  it('handles webhook signature and payment captured event', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      clientId: 'c1',
      paymentType: 'document',
      documentIds: ['d1'],
      billingHistory: [],
      save: jest.fn()
    };
    const { controller, mocks } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
      Payment: {
        findOne: jest.fn((query) => {
          if (query.webhookEventIds) return Promise.resolve(null);
          if (query.razorpayOrderId) return Promise.resolve(payment);
          return Promise.resolve(null);
        })
      },
      Firm: { findById: jest.fn().mockResolvedValue({ addRevenue: jest.fn() }) },
      Client: { findById: jest.fn().mockResolvedValue({ addPayment: jest.fn() }) }
    });
    mocks.Document.updateMany.mockResolvedValue();

    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'o1', id: 'pay', created_at: 1000, method: 'card' } } }
    };

    const { res, next } = await run(controller.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt1' },
      body: payload
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('rejects webhook with invalid signature or payload', async () => {
    const { controller } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(false) }
    });
    const { next } = await run(controller.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig' },
      body: {}
    });
    expect(next.mock.calls[0][0].message).toContain('Invalid webhook signature');

    const { controller: controller2 } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(true) }
    });
    const { next: payloadNext } = await run(controller2.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig' },
      body: { event: null }
    });
    expect(payloadNext.mock.calls[0][0].message).toContain('Invalid webhook payload');
  });

  it('short-circuits already processed webhook event', async () => {
    const { controller, mocks } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
      Payment: { findOne: jest.fn().mockResolvedValue({ _id: 'p1' }) }
    });
    const { res } = await run(controller.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt1' },
      body: { event: 'payment.failed', payload: { payment: { entity: {} } } }
    });
    expect(mocks.Payment.findOne).toHaveBeenCalledWith({ webhookEventIds: 'evt1' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Event already processed' }));
  });

  it('handles subscription webhook events with guards', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      clientId: 'c1',
      paymentType: 'subscription',
      planId: 'plan1',
      webhookData: { updated_at: 200 },
      webhookEventIds: [],
      billingHistory: [],
      save: jest.fn()
    };
    const { controller, mocks } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
      Payment: {
        findOne: jest.fn((query) => {
          if (query.webhookEventIds) return Promise.resolve(null);
          if (query.razorpaySubscriptionId) return Promise.resolve(payment);
          return Promise.resolve(null);
        })
      },
      Subscription: { findById: jest.fn().mockResolvedValue({ _id: 'plan1' }) }
    });

    const payload = {
      event: 'subscription.activated',
      payload: {
        subscription: { entity: { id: 'sub1', updated_at: 100, current_start: 1, current_end: 2 } },
        payment: { entity: { id: 'pay1', created_at: 1, method: 'card', amount: 1000 } }
      }
    };
    await run(controller.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt2' },
      body: payload
    });

    const payload2 = {
      event: 'subscription.halted',
      payload: { subscription: { entity: { id: 'sub1', updated_at: 300 } } }
    };
    await run(controller.handleWebhook, {
      headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt3' },
      body: payload2
    });
  });

  it('processes subscription lifecycle events', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      clientId: 'c1',
      paymentType: 'subscription',
      planId: 'plan1',
      webhookData: { updated_at: 100 },
      webhookEventIds: [],
      billingHistory: [],
      save: jest.fn()
    };
    const { controller, mocks } = buildController({
      razorpayService: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
      Payment: {
        findOne: jest.fn((query) => {
          if (query.webhookEventIds) return Promise.resolve(null);
          if (query.razorpaySubscriptionId) return Promise.resolve(payment);
          if (query.razorpayOrderId) return Promise.resolve(null);
          return Promise.resolve(null);
        })
      },
      Subscription: { findById: jest.fn().mockResolvedValue({ _id: 'plan1' }) }
    });

    const events = [
      { event: 'subscription.activated', subscription: { id: 'sub1', updated_at: 200, paid_count: 1, remaining_count: 11, current_start: 1, current_end: 2, charge_at: 3, total_count: 12 }, payment: { id: 'pay1', created_at: 1, method: 'card', amount: 1000 } },
      { event: 'subscription.charged', subscription: { id: 'sub1', updated_at: 201, paid_count: 2, remaining_count: 10, current_start: 1, current_end: 2, charge_at: 3, total_count: 12 }, payment: { id: 'pay2', created_at: 1, method: 'card', amount: 1000 } },
      { event: 'subscription.cancelled', subscription: { id: 'sub1', updated_at: 202, total_count: 12 } },
      { event: 'subscription.completed', subscription: { id: 'sub1', updated_at: 203, total_count: 12 } },
      { event: 'subscription.paused', subscription: { id: 'sub1', updated_at: 204 } },
      { event: 'subscription.resumed', subscription: { id: 'sub1', updated_at: 205, status: 'active' } },
      { event: 'subscription.authenticated', subscription: { id: 'sub1', updated_at: 206, current_start: 1, current_end: 2, charge_at: 3 } },
      { event: 'subscription.updated', subscription: { id: 'sub1', updated_at: 207, status: 'active', paid_count: 2, remaining_count: 10, current_start: 1, current_end: 2, charge_at: 3 } }
    ];

    for (const item of events) {
      await run(controller.handleWebhook, {
        headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': `evt-${item.event}` },
        body: {
          event: item.event,
          payload: {
            subscription: { entity: item.subscription },
            payment: item.payment ? { entity: item.payment } : undefined
          }
        }
      });
    }

    expect(mocks.Payment.findOne).toHaveBeenCalled();
  });
});

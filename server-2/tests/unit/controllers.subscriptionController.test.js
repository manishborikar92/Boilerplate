const mongoose = require('mongoose');

const buildController = (overrides = {}) => {
  jest.resetModules();
  const subscriptionModel = {
    find: jest.fn(),
    findById: jest.fn()
  };
  const paymentModel = {
    findOne: jest.fn(),
    findById: jest.fn()
  };
  const firmModel = { findById: jest.fn() };
  const razorpayService = {
    getSubscription: jest.fn(),
    cancelSubscription: jest.fn()
  };
  const subscriptionService = {
    getFirmUsageStats: jest.fn(),
    calculateNextBillingDate: jest.fn(() => new Date())
  };

  Object.assign(subscriptionModel, overrides.Subscription || {});
  Object.assign(paymentModel, overrides.Payment || {});
  Object.assign(firmModel, overrides.Firm || {});
  Object.assign(razorpayService, overrides.razorpayService || {});
  Object.assign(subscriptionService, overrides.subscriptionService || {});

  jest.doMock('../../src/models/Subscription', () => subscriptionModel);
  jest.doMock('../../src/models/Payment', () => paymentModel);
  jest.doMock('../../src/models/Firm', () => firmModel);
  jest.doMock('../../src/services/razorpayService', () => razorpayService);
  jest.doMock('../../src/services/subscriptionService', () => subscriptionService);
  jest.doMock('../../src/middleware/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }));

  const controller = require('../../src/controllers/subscriptionController');
  return { controller, mocks: { Subscription: subscriptionModel, Payment: paymentModel, Firm: firmModel, razorpayService, subscriptionService } };
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

describe('subscriptionController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists plans and returns plan by id', async () => {
    const plans = [{ _id: 'p1' }];
    const { controller, mocks } = buildController({
      Subscription: {
        find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(plans) }),
        findById: jest.fn().mockResolvedValue({ _id: 'p1', isDeleted: false })
      }
    });
    const { res } = await run(controller.getPlans, {});
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { plans }
    }));

    const { res: planRes } = await run(controller.getPlan, { params: { id: 'p1' } });
    expect(planRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { plan: { _id: 'p1', isDeleted: false } }
    }));
    expect(mocks.Subscription.findById).toHaveBeenCalled();
  });

  it('rejects missing or invalid plan for purchase', async () => {
    const { controller, mocks } = buildController({
      Subscription: { findById: jest.fn().mockResolvedValue(null) }
    });
    const { next: missingNext } = await run(controller.purchase, {
      body: {},
      user: { _id: 'u1', firmId: 'f1' }
    });
    expect(missingNext.mock.calls[0][0].message).toContain('Plan ID is required');

    const { next } = await run(controller.purchase, {
      body: { planId: 'p1' },
      user: { _id: 'u1', firmId: 'f1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Plan not found');
    expect(mocks.Subscription.findById).toHaveBeenCalled();
  });

  it('returns pending subscription for same plan', async () => {
    const planId = new mongoose.Types.ObjectId();
    const payment = { _id: 'pay1', planId, razorpaySubscriptionId: null };
    const { controller, mocks } = buildController({
      Subscription: { findById: jest.fn().mockResolvedValue({ _id: planId, razorpayPlanId: 'rp', isActive: true }) },
      Firm: { findById: jest.fn().mockResolvedValue({ _id: 'f1', subscription: {} }) },
      Payment: { findOne: jest.fn().mockResolvedValue(payment) }
    });

    const { res } = await run(controller.purchase, {
      body: { planId: planId.toString() },
      user: { _id: 'u1', firmId: 'f1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.stringContaining('pending subscription')
    }));
    expect(mocks.Payment.findOne).toHaveBeenCalled();
  });

  it('validates verifySubscription and usage firm checks', async () => {
    const { controller } = buildController();
    const { next } = await run(controller.verifySubscription, {
      body: {},
      user: { firmId: null }
    });
    expect(next.mock.calls[0][0].message).toContain('complete your firm profile');

    const { next: usageNext } = await run(controller.getUsage, {
      user: { firmId: null }
    });
    expect(usageNext.mock.calls[0][0].message).toContain('complete your firm profile');
  });

  it('rejects cancel when subscription missing', async () => {
    const { controller } = buildController({
      Payment: { findById: jest.fn().mockResolvedValue(null) }
    });
    const { next } = await run(controller.cancel, {
      params: { id: 'p1' },
      body: {},
      user: { firmId: 'f1' }
    });
    expect(next.mock.calls[0][0].message).toContain('Subscription not found');
  });

  it('validates purchase for missing razorpay plan id and firm', async () => {
    const planId = new mongoose.Types.ObjectId();
    const { controller } = buildController({
      Subscription: { findById: jest.fn().mockResolvedValue({ _id: planId, isActive: true }) }
    });
    const { next } = await run(controller.purchase, {
      body: { planId: planId.toString() },
      user: { _id: 'u1', firmId: null }
    });
    expect(next.mock.calls[0][0].message).toContain('complete your firm profile');

    const { next: nextPlan } = await run(controller.purchase, {
      body: { planId: planId.toString() },
      user: { _id: 'u1', firmId: 'f1' }
    });
    expect(nextPlan.mock.calls[0][0].message).toContain('Plan is not configured');
  });

  it('rejects purchase for half-yearly plan while deactivated', async () => {
    const planId = new mongoose.Types.ObjectId();
    const { controller } = buildController({
      Subscription: {
        findById: jest.fn().mockResolvedValue({
          _id: planId,
          isActive: true,
          isDeleted: false,
          billingPeriod: 'half-yearly',
          razorpayPlanId: 'rp_plan_id'
        })
      }
    });

    const { next } = await run(controller.purchase, {
      body: { planId: planId.toString() },
      user: { _id: 'u1', firmId: 'f1' }
    });

    expect(next.mock.calls[0][0].message).toContain('temporarily unavailable');
  });

  it('verifies subscription and activates firm when ready', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      razorpaySubscriptionId: 'sub1',
      subscriptionStatus: 'created',
      planId: 'plan1',
      paidAt: null,
      save: jest.fn()
    };
    const firm = { _id: 'f1', subscription: { planId: 'plan_ca_flow_free' }, save: jest.fn() };
    const { controller, mocks } = buildController({
      Payment: { findById: jest.fn().mockResolvedValue(payment) },
      Firm: { findById: jest.fn().mockResolvedValue(firm) },
      Subscription: { findById: jest.fn().mockResolvedValue({ _id: 'plan1' }) },
      razorpayService: {
        getSubscription: jest.fn().mockResolvedValue({
          id: 'sub1',
          status: 'active',
          paid_count: 1,
          remaining_count: 11,
          current_start: 1,
          current_end: 2,
          charge_at: 3
        })
      }
    });

    const { res } = await run(controller.verifySubscription, {
      body: { paymentId: 'p1' },
      user: { firmId: 'f1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ firmActivated: true })
    }));
    expect(mocks.razorpayService.getSubscription).toHaveBeenCalled();
  });

  it('cancels subscription and deactivates immediately', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      paymentType: 'subscription',
      subscriptionStatus: 'active',
      razorpaySubscriptionId: 'sub1',
      billingHistory: [],
      save: jest.fn()
    };
    const { controller, mocks } = buildController({
      Payment: { findById: jest.fn().mockResolvedValue(payment) },
      razorpayService: { cancelSubscription: jest.fn().mockRejectedValue(new Error('fail')) }
    });
    jest.spyOn(controller, 'deactivateFirmSubscription').mockResolvedValue();

    const { res } = await run(controller.cancel, {
      params: { id: 'p1' },
      body: { cancelAtCycleEnd: false },
      user: { firmId: 'f1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('cancelled immediately')
    }));
    expect(mocks.razorpayService.cancelSubscription).toHaveBeenCalled();
  });

  it('gets subscription and syncs status from Razorpay', async () => {
    const payment = {
      _id: 'p1',
      firmId: 'f1',
      paymentType: 'subscription',
      razorpaySubscriptionId: 'sub1',
      subscriptionStatus: 'created',
      paidCount: 0,
      remainingCount: 0,
      save: jest.fn()
    };
    const query = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(payment)
    };
    const { controller, mocks } = buildController({
      Payment: { findById: jest.fn().mockReturnValue(query) },
      razorpayService: {
        getSubscription: jest.fn().mockResolvedValue({
          status: 'active',
          paid_count: 1,
          remaining_count: 11,
          current_end: 2
        })
      }
    });

    const { res } = await run(controller.getSubscription, {
      params: { id: 'p1' },
      user: { firmId: 'f1' }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ payment })
    }));
    expect(mocks.razorpayService.getSubscription).toHaveBeenCalled();
  });
});

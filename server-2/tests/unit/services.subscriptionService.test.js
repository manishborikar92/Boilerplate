const { AuthorizationError } = require('../../src/utils/errorHandler');

const loadService = () => {
  jest.resetModules();
  jest.doMock('../../src/models/Firm', () => ({
    findById: jest.fn()
  }));
  jest.doMock('../../src/models/Client', () => ({
    countDocuments: jest.fn()
  }));
  jest.doMock('../../src/models/Document', () => ({
    countDocuments: jest.fn()
  }));
  jest.doMock('../../src/models/Payment', () => ({
    countDocuments: jest.fn()
  }));
  return require('../../src/services/subscriptionService');
};

describe('subscriptionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('handles plan limits and downgrade for expired pro', async () => {
    jest.useFakeTimers();
    const service = loadService();
    const Firm = require('../../src/models/Firm');

    const expiredFirm = {
      _id: 'f1',
      subscription: {
        planId: 'plan_ca_flow_pro',
        validity: { endDate: new Date(Date.now() - 1000).toISOString() },
        razorpayCustomerId: 'cust'
      },
      save: jest.fn().mockResolvedValue()
    };

    Firm.findById.mockResolvedValue(expiredFirm);
    const limits = service.getPlanLimits(expiredFirm);
    expect(limits).toBeDefined();

    jest.runAllTimers();
    await Promise.resolve();
    expect(Firm.findById).toHaveBeenCalled();
  });

  it('returns plan names and pro checks', () => {
    const service = loadService();
    expect(service.getPlanName('plan_ca_flow_pro')).toBe('Pro');
    expect(service.getPlanName('unknown')).toBe('Unknown');
    expect(service.isProPlan('plan_ca_flow_pro')).toBe(true);
    expect(service.isProPlan('plan_ca_flow_free')).toBe(false);
  });

  it('calculates billing cycles and formats', () => {
    const service = loadService();
    const base = new Date('2026-01-01T00:00:00.000Z');
    expect(service.calculateNextBillingDate(base, 'monthly').getMonth()).toBe(1);
    expect(service.calculateNextBillingDate(base, 'quarterly').getMonth()).toBe(3);
    expect(service.calculateNextBillingDate(base, 'half-yearly').getMonth()).toBe(6);
    expect(service.calculateNextBillingDate(base, 'yearly').getFullYear()).toBe(2027);
    expect(service.formatBillingCycle('monthly')).toBe('Monthly');
    expect(service.formatBillingCycle('custom')).toBe('custom');
  });

  it('resolves billing display', () => {
    const service = loadService();
    const freeFirm = { subscription: { planId: 'plan_ca_flow_free' } };
    expect(service.resolveBillingDisplay(freeFirm)).toEqual({ price: 0, period: 'forever' });

    const proFirm = { subscription: { planId: 'plan_ca_flow_pro', billingCycle: 'quarterly' } };
    const display = service.resolveBillingDisplay(proFirm);
    expect(display.price).toBeGreaterThan(0);
    expect(display.period).toBe('quarter');
  });

  it('gets firm usage stats', async () => {
    const service = loadService();
    const Firm = require('../../src/models/Firm');
    const Client = require('../../src/models/Client');
    const Document = require('../../src/models/Document');
    const Payment = require('../../src/models/Payment');

    Firm.findById.mockResolvedValue({ _id: 'f1', subscription: { planId: 'plan_ca_flow_free' } });
    Client.countDocuments.mockResolvedValue(1);
    Document.countDocuments.mockResolvedValue(2);
    Payment.countDocuments.mockResolvedValue(3);

    const stats = await service.getFirmUsageStats('f1');
    expect(stats.limits.clients.used).toBe(1);
    expect(stats.limits.documents.used).toBe(2);
    expect(stats.limits.payments.used).toBe(3);
  });

  it('throws when firm not found', async () => {
    const service = loadService();
    const Firm = require('../../src/models/Firm');
    Firm.findById.mockResolvedValue(null);
    await expect(service.getFirmWithSubscription('f1')).rejects.toThrow('Firm not found');
  });

  it('enforces monthly limits', async () => {
    const service = loadService();
    const Firm = require('../../src/models/Firm');
    const Document = require('../../src/models/Document');

    Firm.findById.mockResolvedValue({ _id: 'f1', subscription: { planId: 'plan_ca_flow_free' } });
    Document.countDocuments.mockResolvedValue(25);

    await expect(service.assertMonthlyLimit({ firmId: 'f1', modelType: 'Document', increment: 1 }))
      .rejects.toThrow('Monthly documents limit reached');
  });

  it('throws for missing firmId and unknown model type', async () => {
    const service = loadService();
    await expect(service.assertMonthlyLimit({ firmId: null, modelType: 'Document' }))
      .rejects.toThrow('Please complete your firm profile first');
    const Firm = require('../../src/models/Firm');
    Firm.findById.mockResolvedValue({ _id: 'f1', subscription: { planId: 'plan_ca_flow_free' } });
    await expect(service.resolveMonthlyUsage('f1', 'Unknown'))
      .rejects.toThrow('Unknown model type');
  });

  it('enforces client limits', async () => {
    const service = loadService();
    const Firm = require('../../src/models/Firm');
    const Client = require('../../src/models/Client');

    Firm.findById.mockResolvedValue({ _id: 'f1', subscription: { planId: 'plan_ca_flow_free' } });
    Client.countDocuments.mockResolvedValue(5);

    await expect(service.assertClientLimit('f1')).rejects.toThrow('Client limit reached');
  });

  it('checks notification channel permissions', async () => {
    const service = loadService();
    const Firm = require('../../src/models/Firm');
    Firm.findById.mockResolvedValue({ _id: 'f1', subscription: { planId: 'plan_ca_flow_free' } });

    const allowed = await service.isNotificationChannelAllowed('f1', 'email');
    expect(allowed).toBe(true);

    Firm.findById.mockRejectedValue(new Error('fail'));
    const fallback = await service.isNotificationChannelAllowed('f1', 'sms');
    expect(fallback).toBe(false);
  });
});

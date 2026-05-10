const Subscription = require('../../src/models/Subscription');

describe('Subscription model', () => {
  afterEach(async () => {
    await Subscription.deleteMany({});
  });

  it('computes rupee amounts and display helpers', async () => {
    const subscription = await Subscription.create({
      planName: 'Pro',
      amount: 10000,
      originalAmount: 20000,
      discount: 50,
      billingPeriod: 'monthly'
    });

    expect(subscription.amountInRupees).toBe(100);
    expect(subscription.originalAmountInRupees).toBe(200);
    expect(subscription.getDiscountDisplay()).toBe('50% OFF');
    expect(subscription.getBillingPeriodDisplay()).toBe('Monthly');
  });

  it('handles missing discount and unknown billing period', async () => {
    const subscription = await Subscription.create({
      planName: 'Custom',
      amount: 5000,
      billingPeriod: 'half-yearly'
    });

    expect(subscription.getDiscountDisplay()).toBeNull();
    expect(subscription.getBillingPeriodDisplay()).toBe('Half-Yearly');
  });
});

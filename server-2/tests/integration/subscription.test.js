const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Firm = require('../../src/models/Firm');
const Subscription = require('../../src/models/Subscription');
const Payment = require('../../src/models/Payment');
const { generateAccessToken } = require('../../src/utils/jwt');

// Mock Razorpay service with unique IDs
let mockCounter = 0;
const getMockId = (prefix) => `${prefix}_${Date.now()}_${mockCounter++}`;

jest.mock('../../src/services/razorpayService', () => ({
  createPlan: jest.fn().mockImplementation(() => {
    const planId = getMockId('plan');
    return Promise.resolve({
      id: planId,
      entity: 'plan',
      interval: 1,
      period: 'monthly',
      item: {
        id: getMockId('item'),
        active: true,
        name: 'Test Plan',
        description: 'Test Plan Description',
        amount: 34900,
        currency: 'INR'
      }
    });
  }),
  createSubscription: jest.fn().mockImplementation(() => {
    const subId = getMockId('sub');
    return Promise.resolve({
      id: subId,
      entity: 'subscription',
      status: 'created',
      current_start: Math.floor(Date.now() / 1000),
      current_end: Math.floor(Date.now() / 1000) + 2592000,
      charge_at: Math.floor(Date.now() / 1000) + 2592000,
      short_url: 'https://rzp.io/test',
      total_count: 12,
      paid_count: 0,
      remaining_count: 12
    });
  }),
  createCustomer: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      id: getMockId('cust'),
      entity: 'customer',
      name: 'Test Customer',
      email: 'test@example.com',
      contact: '+919876543210'
    });
  }),
  getSubscription: jest.fn().mockImplementation((subId) => {
    return Promise.resolve({
      id: subId,
      status: 'active',
      paid_count: 1,
      remaining_count: 11
    });
  }),
  cancelSubscription: jest.fn().mockImplementation((subId) => {
    return Promise.resolve({
      id: subId,
      status: 'cancelled'
    });
  }),
  pauseSubscription: jest.fn().mockImplementation((subId) => {
    return Promise.resolve({
      id: subId,
      status: 'paused'
    });
  }),
  resumeSubscription: jest.fn().mockImplementation((subId) => {
    return Promise.resolve({
      id: subId,
      status: 'active'
    });
  })
}));

describe('Subscription API Integration Tests', () => {
  let caAdminToken;
  let caAdminUser;
  let clientToken;
  let clientUser;
  let firm;
  let testClient;
  let starterPlanMock; // For testing upgrade-to-free error (not actually in prod DB)
  let proPlan;
  let halfYearlyPlan;

  beforeEach(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Firm.deleteMany({});
    await Subscription.deleteMany({});
    await Payment.deleteMany({});

    // Create CA Admin user with verified email
    caAdminUser = await User.create({
      email: 'admin@caflow.com',
      password: 'password123',
      name: 'CA Admin',
      role: 'CA-Admin',
      isActive: true,
      isEmailVerified: true
    });

    // Create firm
    firm = await Firm.create({
      firmName: 'Test CA Firm',
      registrationNumber: 'REG123456',
      pan: 'ABCDE1234F',
      officialEmail: 'contact@testfirm.com',
      contactNumber: '+91-9876543210',
      bankDetails: {
        bankName: 'Test Bank',
        accountHolderName: 'Test CA Firm',
        accountNumber: '1234567890',
        ifscCode: 'TEST0123456'
      },
      adminId: caAdminUser._id
    });

    // Associate firm with admin
    caAdminUser.firmId = firm._id;
    await caAdminUser.save();

    caAdminToken = generateAccessToken(caAdminUser._id, caAdminUser.role);

    // Create test client
    testClient = await Client.create({
      companyName: 'Test Client',
      email: 'client@test.com',
      phoneNumber: '+91-9876543210',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-001',
      generatedPassword: 'password123',
      firmId: firm._id,
      createdBy: caAdminUser._id
    });

    // Create Client user
    clientUser = await User.create({
      email: 'client@test.com',
      password: 'password123',
      name: 'Client User',
      role: 'Client',
      isActive: true,
      firmId: firm._id
    });

    testClient.userAccountId = clientUser._id;
    await testClient.save();

    clientToken = generateAccessToken(clientUser._id, clientUser.role);

    // Create subscription plans
    // Note: As per Subscription Development Guide, Starter (Free) plan is NOT in database
    // It's the default state when firm.subscription.planId = 'plan_ca_flow_free'
    // We create a mock entry here ONLY to test the upgrade-to-free error case
    starterPlanMock = await Subscription.create({
      planName: 'Starter (Test Only)',
      planDescription: 'Test entry - Starter plan should NOT be in prod DB',
      amount: 0, // Free
      billingPeriod: 'monthly',
      features: [
        'Up to 5 clients',
        '25 documents per month',
        '25 payments per month',
        'Email notifications',
        'Basic support'
      ],
      maxClients: 5,
      maxStorage: 1,
      isActive: true
    });

    proPlan = await Subscription.create({
      planName: 'Monthly',
      planDescription: 'Ideal for growing CA firms',
      razorpayPlanId: getMockId('plan'),
      amount: 34900, // ₹349 in paise
      originalAmount: 49900, // ₹499 in paise
      discount: 30,
      billingPeriod: 'monthly',
      features: [
        'Up to 100 clients',
        '500 documents per month',
        '500 payments per month',
        'Email, WhatsApp & SMS notifications',
        'Priority support'
      ],
      maxClients: 100,
      maxStorage: 50,
      isActive: true
    });

    halfYearlyPlan = await Subscription.create({
      planName: 'Half-Yearly',
      planDescription: 'Best value with half-yearly billing',
      razorpayPlanId: getMockId('plan'),
      amount: 129900,
      originalAmount: 259900,
      discount: 50,
      billingPeriod: 'half-yearly',
      features: [
        'Up to 100 clients',
        '500 documents per month',
        '500 payments per month',
        'Email, WhatsApp & SMS notifications',
        'Priority support'
      ],
      maxClients: 100,
      maxStorage: 50,
      isActive: true
    });
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should get all active subscription plans (public)', async () => {
      const response = await request(app)
        .get('/api/subscriptions/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(2); // starterPlanMock + proPlan (half-yearly hidden)
      expect(response.body.data.plans[0].amount).toBe(0); // Sorted by amount ascending
      expect(response.body.data.plans.some((p) => p._id === halfYearlyPlan._id.toString())).toBe(false);
    });

    it('should work without authentication', async () => {
      const response = await request(app)
        .get('/api/subscriptions/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/subscriptions/plans/:id', () => {
    it('should get single plan by ID (public)', async () => {
      const response = await request(app)
        .get(`/api/subscriptions/plans/${proPlan._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan.planName).toBe('Monthly');
      expect(response.body.data.plan.amount).toBe(34900);
    });

    it('should fail with invalid plan ID', async () => {
      const invalidId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/subscriptions/plans/${invalidId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // REMOVED: POST /api/subscriptions/plans tests
  // Plans are now created ONLY by Platform Owner via seed script
  // CA-Admins cannot create plans via API anymore
  // See: server/scripts/seed-subscription-plans.js

  // REMOVED: PUT /api/subscriptions/plans/:id tests  
  // Plans are now updated ONLY by Platform Owner via seed script or direct DB access
  // CA-Admins cannot update plans via API anymore

  // REMOVED: POST /api/subscriptions/subscribe tests
  // This endpoint was for subscribing individual clients to plans
  // The system has evolved to ONLY support firm-level subscriptions
  // Individual clients do NOT have subscriptions - only CA firms do
  // Use POST /api/subscriptions/upgrade-firm instead

  describe('POST /api/subscriptions/purchase', () => {
    it('should create firm subscription successfully', async () => {
      const upgradeData = {
        planId: proPlan._id.toString(),
        totalCount: 12
      };

      const response = await request(app)
        .post('/api/subscriptions/purchase')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(upgradeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.firmId.toString()).toBe(firm._id.toString());
      expect(response.body.data.payment.razorpaySubscriptionId).toMatch(/^sub_/);
    });

    it('should fail without planId', async () => {
      const upgradeData = {
        totalCount: 12
      };

      const response = await request(app)
        .post('/api/subscriptions/purchase')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(upgradeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail if trying to upgrade to starter (free) plan', async () => {
      const upgradeData = {
        planId: starterPlanMock._id.toString()
      };

      const response = await request(app)
        .post('/api/subscriptions/purchase')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(upgradeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not configured');
    });

    it('should fail if not CA-Admin', async () => {
      const upgradeData = {
        planId: proPlan._id.toString()
      };

      const response = await request(app)
        .post('/api/subscriptions/purchase')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(upgradeData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail for temporarily deactivated 6-month plan', async () => {
      const upgradeData = {
        planId: halfYearlyPlan._id.toString()
      };

      const response = await request(app)
        .post('/api/subscriptions/purchase')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(upgradeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('temporarily unavailable');
    });
  });

  describe('GET /api/subscriptions/:id', () => {
    let testSubscription;

    beforeEach(async () => {
      testSubscription = await Payment.create({
        paymentType: 'subscription',
        clientId: testClient._id,
        firmId: firm._id,
        razorpaySubscriptionId: getMockId('sub'),
        amount: 34900,
        description: `Subscription: ${proPlan.planName}`,
        planId: proPlan._id,
        billingPeriod: 'monthly',
        status: 'created',
        subscriptionStatus: 'created',
        totalCount: 12,
        paidCount: 0,
        remainingCount: 12,
        createdBy: caAdminUser._id
      });
    });

    it('should get subscription details', async () => {
      const response = await request(app)
        .get(`/api/subscriptions/${testSubscription._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.razorpaySubscriptionId).toBeDefined();
      expect(response.body.data.razorpaySubscription).toBeDefined();
    });

    it('should fail if not CA-Admin', async () => {
      const response = await request(app)
        .get(`/api/subscriptions/${testSubscription._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/subscriptions/:id/cancel', () => {
    let testSubscription;

    beforeEach(async () => {
      testSubscription = await Payment.create({
        paymentType: 'subscription',
        clientId: testClient._id,
        firmId: firm._id,
        razorpaySubscriptionId: getMockId('sub'),
        amount: 34900,
        description: `Subscription: ${proPlan.planName}`,
        planId: proPlan._id,
        billingPeriod: 'monthly',
        status: 'paid',
        subscriptionStatus: 'active',
        totalCount: 12,
        paidCount: 1,
        remainingCount: 11,
        createdBy: caAdminUser._id
      });
    });

    it('should cancel subscription successfully', async () => {
      const response = await request(app)
        .post(`/api/subscriptions/${testSubscription._id}/cancel`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({ cancelAtCycleEnd: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.status).toBe('cancelled');
    });

    it('should fail if not CA-Admin', async () => {
      const response = await request(app)
        .post(`/api/subscriptions/${testSubscription._id}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ cancelAtCycleEnd: false })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/subscriptions/usage', () => {
    it('should return usage for CA-Admin', async () => {
      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan.id).toBe('plan_ca_flow_free');
    });

    it('should fail if not CA-Admin', async () => {
      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});

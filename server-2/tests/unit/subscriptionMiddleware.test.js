/**
 * Subscription Middleware Tests
 * Tests for plan limit enforcement
 * 
 * Note: MongoDB connection is handled by global tests/setup.js
 */

const { PLAN_CONFIG } = require('../../src/constants/plans');
const {
    checkClientLimit,
    checkMonthlyLimit
} = require('../../src/middleware/subscription');
const {
    assertMonthlyLimit,
    isNotificationChannelAllowed,
    getPlanLimits,
    getMonthStart
} = require('../../src/services/subscriptionService');
const subscriptionService = require('../../src/services/subscriptionService');
const { getUsage: getSubscriptionUsageHandler } = require('../../src/controllers/subscriptionController');
const Firm = require('../../src/models/Firm');
const Client = require('../../src/models/Client');
const Document = require('../../src/models/Document');
const Payment = require('../../src/models/Payment');
const User = require('../../src/models/User');
const { AuthorizationError } = require('../../src/utils/errorHandler');

const runGetSubscriptionUsage = (firmId) => {
    const req = { user: { firmId } };
    return new Promise((resolve, reject) => {
        const res = { json: (payload) => resolve(payload.data) };
        const next = (error) => reject(error);
        getSubscriptionUsageHandler(req, res, next);
    });
};

describe('Subscription Middleware', () => {
    let testUser;
    let testFirm;

    beforeEach(async () => {
        // Clear collections before each test
        await User.deleteMany({});
        await Firm.deleteMany({});
        await Client.deleteMany({});
        await Document.deleteMany({});

        // Create test user
        testUser = await User.create({
            email: 'admin@test.com',
            password: 'password123',
            name: 'Test Admin',
            role: 'CA-Admin',
            isActive: true,
            isEmailVerified: true
        });

        // Create test firm with default (free) plan
        testFirm = await Firm.create({
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
            adminId: testUser._id,
            // Explicitly set subscription for testing
            subscription: {
                planId: 'plan_ca_flow_free',
                status: 'active'
            }
        });

        testUser.firmId = testFirm._id;
        await testUser.save();
    });

    afterEach(async () => {
        await User.deleteMany({});
        await Firm.deleteMany({});
        await Client.deleteMany({});
        await Document.deleteMany({});
    });

    describe('getPlanLimits', () => {
        it('should return free plan limits by default', () => {
            const limits = getPlanLimits(testFirm);
            expect(limits.maxClients).toBe(5);
            expect(limits.monthlyRecords).toBe(25);
            expect(limits.notifications).toEqual(['email']);
        });

        it('should return pro plan limits when upgraded', async () => {
            testFirm.subscription.planId = 'plan_ca_flow_pro';
            await testFirm.save();

            const limits = getPlanLimits(testFirm);
            expect(limits.maxClients).toBe(100);
            expect(limits.monthlyRecords).toBe(500);
            expect(limits.notifications).toContain('whatsapp');
            expect(limits.notifications).toContain('sms');
        });
    });

    describe('getMonthStart', () => {
        it('should return the first day of current month', () => {
            const monthStart = getMonthStart();
            const now = new Date();

            expect(monthStart.getFullYear()).toBe(now.getFullYear());
            expect(monthStart.getMonth()).toBe(now.getMonth());
            expect(monthStart.getDate()).toBe(1);
            expect(monthStart.getHours()).toBe(0);
            expect(monthStart.getMinutes()).toBe(0);
        });
    });

    describe('assertMonthlyLimit', () => {
        let originalMonthlyRecords;

        beforeAll(() => {
            originalMonthlyRecords = PLAN_CONFIG['plan_ca_flow_free'].monthlyRecords;
            PLAN_CONFIG['plan_ca_flow_free'].monthlyRecords = 2;
        });

        afterAll(() => {
            PLAN_CONFIG['plan_ca_flow_free'].monthlyRecords = originalMonthlyRecords;
        });

        it('should allow when projected count is within limit', async () => {
            const client = await Client.create({
                companyName: 'Client A',
                email: 'clienta@test.com',
                phoneNumber: '+91-9876543211',
                companyType: 'Pvt. Ltd.',
                userId: 'CA-CLT-010',
                generatedPassword: 'password123',
                firmId: testFirm._id,
                createdBy: testUser._id
            });

            await Payment.create({
                amount: 1000,
                currency: 'INR',
                status: 'created',
                    paymentType: 'chat-message',
                description: 'Test payment',
                clientId: client._id,
                firmId: testFirm._id,
                createdBy: testUser._id
            });

            await expect(assertMonthlyLimit({
                firmId: testFirm._id,
                modelType: 'Payment',
                increment: 1
            })).resolves.toBeDefined();
        });

        it('should throw when projected count exceeds limit', async () => {
            const client = await Client.create({
                companyName: 'Client B',
                email: 'clientb@test.com',
                phoneNumber: '+91-9876543212',
                companyType: 'Pvt. Ltd.',
                userId: 'CA-CLT-011',
                generatedPassword: 'password123',
                firmId: testFirm._id,
                createdBy: testUser._id
            });

            await Payment.create([
                {
                    amount: 1000,
                    currency: 'INR',
                    status: 'created',
                    paymentType: 'chat-message',
                    description: 'Test payment 1',
                    clientId: client._id,
                    firmId: testFirm._id,
                    createdBy: testUser._id
                },
                {
                    amount: 2000,
                    currency: 'INR',
                    status: 'created',
                    paymentType: 'chat-message',
                    description: 'Test payment 2',
                    clientId: client._id,
                    firmId: testFirm._id,
                    createdBy: testUser._id
                }
            ]);

            await expect(assertMonthlyLimit({
                firmId: testFirm._id,
                modelType: 'Payment',
                increment: 1
            })).rejects.toThrow(AuthorizationError);
        });
    });

    describe('checkClientLimit middleware', () => {
        let originalMaxClients;

        beforeAll(() => {
            originalMaxClients = PLAN_CONFIG['plan_ca_flow_free'].maxClients;
            PLAN_CONFIG['plan_ca_flow_free'].maxClients = 1;
        });

        afterAll(() => {
            PLAN_CONFIG['plan_ca_flow_free'].maxClients = originalMaxClients;
        });

        it('should pass when under client limit', async () => {
            const req = { user: { firmId: testFirm._id } };
            const res = {};
            let next = jest.fn();

            await new Promise((resolve) => {
                next = jest.fn((error) => resolve(error));
                checkClientLimit(req, res, next);
            });

            expect(next).toHaveBeenCalledWith();
        });

        it('should block when at client limit for free plan', async () => {
            await Client.create({
                companyName: 'Client Limit',
                email: 'limit@test.com',
                phoneNumber: '+91-9876543219',
                companyType: 'Pvt. Ltd.',
                userId: 'CA-CLT-099',
                generatedPassword: 'password123',
                firmId: testFirm._id,
                createdBy: testUser._id
            });

            const req = { user: { firmId: testFirm._id } };
            const res = {};
            let next = jest.fn();

            await new Promise((resolve) => {
                next = jest.fn((error) => resolve(error));
                checkClientLimit(req, res, next);
            });

            const error = next.mock.calls[0][0];
            expect(error).toBeInstanceOf(AuthorizationError);
        });

        it('should reject when firm profile missing', async () => {
            const req = { user: {} };
            const res = {};
            let next = jest.fn();

            await new Promise((resolve) => {
                next = jest.fn((error) => resolve(error));
                checkClientLimit(req, res, next);
            });

            const error = next.mock.calls[0][0];
            expect(error).toBeInstanceOf(AuthorizationError);
        });
    });

    describe('checkMonthlyLimit middleware', () => {
        it('should attach subscription usage data', async () => {
            const spy = jest.spyOn(subscriptionService, 'assertMonthlyLimit').mockResolvedValue({
                limits: { monthlyRecords: 25 },
                monthlyCount: 2,
                monthStart: new Date()
            });

            const req = { user: { firmId: testFirm._id } };
            const res = {};
            let next = jest.fn();

            await new Promise((resolve) => {
                next = jest.fn((error) => resolve(error));
                checkMonthlyLimit('Document')(req, res, next);
            });

            expect(req.subscriptionLimits).toEqual({ monthlyRecords: 25 });
            expect(req.monthlyCount).toBe(2);
            expect(req.monthStart).toBeInstanceOf(Date);
            expect(next).toHaveBeenCalledWith();

            spy.mockRestore();
        });
    });

    describe('isNotificationChannelAllowed', () => {
        it('should allow only email for free plan', async () => {
            expect(await isNotificationChannelAllowed(testFirm._id, 'email')).toBe(true);
            expect(await isNotificationChannelAllowed(testFirm._id, 'whatsapp')).toBe(false);
            expect(await isNotificationChannelAllowed(testFirm._id, 'sms')).toBe(false);
        });

        it('should allow all channels for pro plan', async () => {
            testFirm.subscription.planId = 'plan_ca_flow_pro';
            await testFirm.save();

            expect(await isNotificationChannelAllowed(testFirm._id, 'email')).toBe(true);
            expect(await isNotificationChannelAllowed(testFirm._id, 'whatsapp')).toBe(true);
            expect(await isNotificationChannelAllowed(testFirm._id, 'sms')).toBe(true);
        });
    });

    describe('getSubscriptionUsage', () => {
        it('should return correct usage stats for free plan', async () => {
            // Create 3 clients
            for (let i = 0; i < 3; i++) {
                await Client.create({
                    companyName: `Client ${i}`,
                    email: `client${i}@test.com`,
                    phoneNumber: `+91-987654321${i}`,
                    companyType: 'Pvt. Ltd.',
                    userId: `CA-CLT-00${i}`,
                    generatedPassword: 'password123',
                    firmId: testFirm._id,
                    createdBy: testUser._id
                });
            }

            const usage = await runGetSubscriptionUsage(testFirm._id);

            expect(usage.plan.name).toBe('Starter');
            expect(usage.plan.id).toBe('plan_ca_flow_free');
            expect(usage.limits.clients.used).toBe(3);
            expect(usage.limits.clients.total).toBe(5);
            expect(usage.limits.clients.percentage).toBe(60);
            expect(usage.notifications.email).toBe(true);
            expect(usage.notifications.whatsapp).toBe(false);
        });

        it('should return correct usage stats for pro plan', async () => {
            testFirm.subscription.planId = 'plan_ca_flow_pro';
            await testFirm.save();

            const usage = await runGetSubscriptionUsage(testFirm._id);

            expect(usage.plan.name).toBe('Pro');
            expect(usage.plan.id).toBe('plan_ca_flow_pro');
            expect(usage.limits.clients.total).toBe(100);
            expect(usage.notifications.whatsapp).toBe(true);
            expect(usage.notifications.sms).toBe(true);
        });
    });
});

describe('PLAN_CONFIG constants', () => {
    it('should have correct free plan config', () => {
        const freeConfig = PLAN_CONFIG['plan_ca_flow_free'];
        expect(freeConfig.maxClients).toBe(5);
        expect(freeConfig.monthlyRecords).toBe(25);
        expect(freeConfig.notifications).toEqual(['email']);
    });

    it('should have correct pro plan config', () => {
        const proConfig = PLAN_CONFIG['plan_ca_flow_pro'];
        expect(proConfig.maxClients).toBe(100);
        expect(proConfig.monthlyRecords).toBe(500);
        expect(proConfig.notifications).toEqual(['email', 'whatsapp', 'sms']);
    });
});

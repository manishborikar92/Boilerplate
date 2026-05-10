/**
 * Payment Routes Integration Tests
 * Tests all payment-related endpoints with proper authorization
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const Client = require('../../src/models/Client');
const Payment = require('../../src/models/Payment');
const Document = require('../../src/models/Document');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
const { generateAccessToken } = require('../../src/utils/jwt');

process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_key';

jest.mock('../../src/services/razorpayService', () => {
  let orderCounter = 0;
  return {
    createOrder: jest.fn().mockImplementation(async ({ amount, currency = 'INR' }) => {
      orderCounter += 1;
      return {
        id: `order_mock_${orderCounter}`,
        amount,
        currency
      };
    }),
    getPayment: jest.fn().mockResolvedValue({
      id: 'pay_mock123',
      method: 'card',
      status: 'captured'
    }),
    verifyPaymentSignature: jest.fn().mockReturnValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true)
  };
});

describe('Payment Routes', () => {
  let caAdminToken, clientToken;
  let caAdminUser, clientUser;
  let firm, client;
  let testPayment;
  let paidPayment;
  let failedPayment;

  beforeAll(async () => {
    caAdminUser = await User.create({
      name: 'CA Admin',
      email: 'ca@test.com',
      password: 'password123',
      role: 'CA-Admin',
      isActive: true,
      isEmailVerified: true
    });

    firm = await Firm.create({
      firmName: 'Test CA Firm',
      registrationNumber: 'REG123456',
      pan: 'ABCDE1234F',
      officialEmail: 'firm@test.com',
      contactNumber: '9876543210',
      adminId: caAdminUser._id,
      bankDetails: {
        bankName: 'Test Bank',
        accountHolderName: 'Test CA Firm',
        accountNumber: '1234567890',
        ifscCode: 'TEST0123456'
      },
      address: {
        street: 'Test Address',
        city: 'Test City',
        state: 'Test State',
        pinCode: '123456'
      }
    });

    caAdminUser.firmId = firm._id;
    await caAdminUser.save();

    clientUser = await User.create({
      name: 'Client User',
      email: 'client@test.com',
      password: 'password123',
      role: 'Client',
      isActive: true,
      isEmailVerified: true
    });

    const userId = await Client.generateUserId(firm._id);
    const generatedPassword = Client.generatePassword();

    client = await Client.create({
      companyName: 'Test Company',
      email: 'client@test.com',
      phoneNumber: '9876543210',
      firmId: firm._id,
      userAccountId: clientUser._id,
      companyType: 'Pvt. Ltd.',
      userId: userId,
      generatedPassword: generatedPassword,
      createdBy: caAdminUser._id
    });

    caAdminToken = generateAccessToken(caAdminUser._id, caAdminUser.role);
    clientToken = generateAccessToken(clientUser._id, clientUser.role);

    testPayment = await Payment.create({
      paymentType: 'invoice',
      clientId: client._id,
      firmId: firm._id,
      amount: 100000,
      description: 'Test invoice',
      status: 'created',
      razorpayOrderId: 'order_test123',
      createdBy: caAdminUser._id
    });

    paidPayment = await Payment.create({
      paymentType: 'invoice',
      clientId: client._id,
      firmId: firm._id,
      amount: 50000,
      description: 'Alpha services January',
      status: 'paid',
      paymentMethod: 'upi',
      paidAt: new Date('2026-01-06T00:00:00.000Z'),
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      updatedAt: new Date('2026-01-05T00:00:00.000Z'),
      createdBy: caAdminUser._id
    });

    failedPayment = await Payment.create({
      paymentType: 'invoice',
      clientId: client._id,
      firmId: firm._id,
      amount: 200000,
      description: 'Beta services February',
      status: 'failed',
      paymentMethod: 'card',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      createdBy: caAdminUser._id
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Firm.deleteMany({});
    await Client.deleteMany({});
    await Payment.deleteMany({});
    await Document.deleteMany({});
    await Thread.deleteMany({});
    await Message.deleteMany({});
  });

  describe('POST /api/payments/initiate-order', () => {
    it('should create chat message payment order (Client)', async () => {
      const threadRes = await request(app)
        .post('/api/threads')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          subject: 'Deliverables',
          serviceType: 'Consultation',
          clientId: client._id.toString(),
          message: 'Preparing deliverables.'
        })
        .expect(201);

      const threadId = threadRes.body?.data?.thread?._id;
      expect(threadId).toBeDefined();

      const attachment = await Document.create({
        fileName: 'deliverable.pdf',
        originalName: 'deliverable.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'deliverable-id',
        cloudinaryUrl: 'https://test.cloudinary.com/deliverable.pdf',
        cloudinaryFolder: 'test-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id,
        folderId: null,
        description: 'Chat upload',
        tags: ['chat']
      });

      const paymentMsgRes = await request(app)
        .post(`/api/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          content: 'Deliverable attached. Please pay.',
          attachments: [attachment._id.toString()],
          paymentRequired: true,
          paymentAmount: 100000
        })
        .expect(201);

      const paymentMessageId = paymentMsgRes.body?.data?.message?._id;
      expect(paymentMessageId).toBeDefined();

      const createOrderRes = await request(app)
        .post('/api/payments/initiate-order')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          threadId,
          messageId: paymentMessageId
        })
        .expect(201);

      expect(createOrderRes.body.success).toBe(true);
      expect(createOrderRes.body.data.payment).toBeDefined();
      expect(createOrderRes.body.data.payment.paymentType).toBe('chat-message');
      expect(createOrderRes.body.data.razorpayOrder).toBeDefined();
      expect(createOrderRes.body.data.keyId).toBeDefined();
    });

    it('should reject non-client users', async () => {
      const res = await request(app)
        .post('/api/payments/initiate-order')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          threadId: new mongoose.Types.ObjectId().toString(),
          messageId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/initiate-order')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/payments/verify', () => {
    it('should verify payment with valid signature', async () => {
      const res = await request(app)
        .post('/api/payments/verify')
        .send({
          razorpay_order_id: testPayment.razorpayOrderId,
          razorpay_payment_id: 'pay_test123',
          razorpay_signature: 'valid_signature'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedPayment = await Payment.findById(testPayment._id);
      expect(updatedPayment.status).toBe('paid');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/payments/verify')
        .send({
          razorpay_order_id: 'order_test123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/payments', () => {
    it('should get all payments for firm (CA-Admin)', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should not allow client to get all payments', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/payments?page=1&limit=10')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it('should support client filter', async () => {
      const res = await request(app)
        .get(`/api/payments?clientId=${client._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should support search by description', async () => {
      const res = await request(app)
        .get('/api/payments?search=Alpha')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments.some((p) => p._id === paidPayment._id.toString())).toBe(true);
    });

    it('should support search by client company name', async () => {
      const res = await request(app)
        .get('/api/payments?search=Test%20Company')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments.length).toBeGreaterThan(0);
    });

    it('should support sorting by amount', async () => {
      const res = await request(app)
        .get('/api/payments?sortBy=amount&sortOrder=asc')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const amounts = res.body.data.payments.map((p) => p.amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
    });
  });

  describe('GET /api/payments/:id', () => {
    it('should get single payment (CA-Admin)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPayment._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment._id).toBe(testPayment._id.toString());
    });

    it('should get own payment (Client)', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPayment._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent payment', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/payments/${fakeId}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/payments/client/my-payments', () => {
    it('should get client own payments', async () => {
      const res = await request(app)
        .get('/api/payments/client/my-payments')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should not allow CA-Admin to access client endpoint', async () => {
      const res = await request(app)
        .get('/api/payments/client/my-payments')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/payments/client/my-payments?page=1&limit=5')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it('should support search', async () => {
      const res = await request(app)
        .get('/api/payments/client/my-payments?search=Alpha')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments.some((p) => p._id === paidPayment._id.toString())).toBe(true);
    });

    it('should support sorting by amount', async () => {
      const res = await request(app)
        .get('/api/payments/client/my-payments?sortBy=amount&sortOrder=desc')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const amounts = res.body.data.payments.map((p) => p.amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle payment.captured webhook', async () => {
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test123',
              order_id: testPayment.razorpayOrderId,
              method: 'card',
              status: 'captured',
              created_at: Math.floor(Date.now() / 1000)
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle subscription.activated webhook', async () => {
      const webhookPayload = {
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test123',
              status: 'active',
              paid_count: 1,
              remaining_count: 11,
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor(Date.now() / 1000) + 2592000,
              charge_at: Math.floor(Date.now() / 1000) + 2592000
            }
          },
          payment: {
            entity: {
              id: 'pay_test123',
              method: 'card',
              created_at: Math.floor(Date.now() / 1000)
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle subscription.charged webhook', async () => {
      const webhookPayload = {
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test123',
              status: 'active',
              paid_count: 2,
              remaining_count: 10,
              total_count: 12
            }
          },
          payment: {
            entity: {
              id: 'pay_test456',
              amount: 100000
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle subscription.cancelled webhook', async () => {
      const webhookPayload = {
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test123',
              status: 'cancelled'
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'valid_signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Authorization Tests', () => {
    it('should require authentication for all protected routes', async () => {
      const routes = [
        { method: 'post', path: '/api/payments/initiate-order' },
        { method: 'get', path: '/api/payments' },
        { method: 'get', path: `/api/payments/${testPayment._id}` },
        { method: 'get', path: '/api/payments/client/my-payments' }
      ];

      for (const route of routes) {
        const res = await request(app)[route.method](route.path);
        expect(res.status).toBe(401);
      }
    });
  });
});

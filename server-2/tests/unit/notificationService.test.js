/**
 * Unit Tests for Notification Service
 * Tests all notification creation methods
 */

const notificationService = require('../../src/services/notificationService');
const Notification = require('../../src/models/Notification');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm'); // Required for User model validation
const mongoose = require('mongoose');

// Mock logger to avoid console output during tests
jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('NotificationService - Unit Tests', () => {
  let testFirmId;
  let testUserId;
  let testClientId;
  let testPaymentId;
  let testDocumentId;
  let testThreadId;
  let testFirm;

  beforeAll(() => {
    testFirmId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testClientId = new mongoose.Types.ObjectId();
    testPaymentId = new mongoose.Types.ObjectId();
    testDocumentId = new mongoose.Types.ObjectId();
    testThreadId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    // Create a test firm for User validation
    testFirm = await Firm.create({
      _id: testFirmId,
      firmName: 'Test Firm',
      registrationNumber: 'REG-TEST-001',
      pan: 'ABCDE1234F',
      officialEmail: 'firm@test.com',
      contactNumber: '+91-9876543210',
      adminId: testUserId,
      bankDetails: {
        bankName: 'Test Bank',
        accountHolderName: 'Test Firm',
        accountNumber: '1234567890',
        ifscCode: 'ABCD0123456',
        accountType: 'Current'
      }
    });
  });

  afterEach(async () => {
    await Notification.deleteMany({});
    await User.deleteMany({});
    await Firm.deleteMany({});
  });

  describe('createNotification', () => {
    it('should create a notification with valid data', async () => {
      const notificationData = {
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Payment Received',
        message: 'Payment of ₹100.00 received',
        recipientId: testUserId,
        firmId: testFirmId,
        relatedEntity: {
          entityType: 'Payment',
          entityId: testPaymentId
        },
        metadata: {
          amount: 10000,
          amountInRupees: '100.00'
        },
        actionUrl: '/app/settings?tab=payments',
        actionLabel: 'View Payment'
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toBeDefined();
      expect(notification.type).toBe('payment');
      expect(notification.subtype).toBe('document_payment_received');
      expect(notification.priority).toBe('high');
      expect(notification.title).toBe('Payment Received');
      expect(notification.isRead).toBe(false);
      expect(notification.actionUrl).toBe('/app/settings?tab=payments');
    });

    it('should handle errors gracefully', async () => {
      const invalidData = {
        type: 'invalid_type',
        // Missing required fields
      };

      await expect(
        notificationService.createNotification(invalidData)
      ).rejects.toThrow();
    });
  });

  describe('createFirmNotification', () => {
    it('should create notifications for all CA-Admins in a firm', async () => {
      // Create test CA-Admin users
      const admin1 = await User.create({
        email: 'admin1@test.com',
        password: 'password123',
        name: 'Admin 1',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const admin2 = await User.create({
        email: 'admin2@test.com',
        password: 'password123',
        name: 'Admin 2',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notificationData = {
        type: 'client',
        subtype: 'client_added',
        priority: 'normal',
        title: 'New Client Added',
        message: 'Test Client has been added',
        actionUrl: '/app/clients'
      };

      const notifications = await notificationService.createFirmNotification(
        testFirmId,
        notificationData
      );

      expect(notifications).toHaveLength(2);
      expect(notifications[0].recipientId.toString()).toBe(admin1._id.toString());
      expect(notifications[1].recipientId.toString()).toBe(admin2._id.toString());
      expect(notifications[0].firmId.toString()).toBe(testFirmId.toString());
    });

    it('should return empty array if no CA-Admins found', async () => {
      const notificationData = {
        type: 'client',
        subtype: 'client_added',
        priority: 'normal',
        title: 'New Client Added',
        message: 'Test Client has been added'
      };

      const notifications = await notificationService.createFirmNotification(
        new mongoose.Types.ObjectId(),
        notificationData
      );

      expect(notifications).toHaveLength(0);
    });
  });

  describe('Payment Notifications', () => {
    it('should create payment received notification', async () => {
      const payment = {
        _id: testPaymentId,
        firmId: testFirmId,
        amount: 10000,
        paymentType: 'document',
        invoiceNumber: 'INV-001'
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      // Create a CA-Admin user
      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyPaymentReceived(payment, client);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('payment');
      expect(notifications[0].subtype).toBe('document_payment_received');
      expect(notifications[0].priority).toBe('high');
      expect(notifications[0].title).toBe('Payment Received');
      expect(notifications[0].message).toContain('₹100.00');
      expect(notifications[0].message).toContain('Test Company');
      expect(notifications[0].actionUrl).toBe('/app/settings?tab=payments');
    });

    it('should create payment failed notification', async () => {
      const payment = {
        _id: testPaymentId,
        firmId: testFirmId,
        amount: 10000,
        paymentType: 'invoice'
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyPaymentFailed(payment, client);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('payment');
      expect(notifications[0].subtype).toBe('payment_failed');
      expect(notifications[0].priority).toBe('high');
      expect(notifications[0].actionUrl).toBe('/app/settings?tab=payments');
    });
  });

  describe('Login Notifications', () => {
    it('should create client first login notification', async () => {
      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        firmId: testFirmId,
        userId: 'CA-CLT-001'
      };

      const user = {
        _id: testUserId,
        email: 'client@test.com'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyClientFirstLogin(client, user);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('login');
      expect(notifications[0].subtype).toBe('client_first_login');
      expect(notifications[0].priority).toBe('normal');
      expect(notifications[0].actionUrl).toBe('/app/clients');
    });
  });

  describe('Subscription Notifications', () => {
    it('should create subscription activated notification', async () => {
      const payment = {
        _id: testPaymentId,
        firmId: testFirmId,
        createdBy: testUserId,
        amount: 99900,
        billingPeriod: 'monthly',
        nextBillingDate: new Date()
      };

      const plan = {
        planName: 'Monthly'
      };

      const notification = await notificationService.notifySubscriptionActivated(payment, plan);

      expect(notification).toBeDefined();
      expect(notification.type).toBe('subscription');
      expect(notification.subtype).toBe('subscription_activated');
      expect(notification.priority).toBe('high');
      expect(notification.actionUrl).toBe('/app/settings?tab=subscriptions');
    });

    it('should create subscription payment failed notification', async () => {
      const payment = {
        _id: testPaymentId,
        firmId: testFirmId,
        createdBy: testUserId,
        amount: 99900,
        billingPeriod: 'monthly'
      };

      const plan = {
        planName: 'Monthly'
      };

      const notification = await notificationService.notifySubscriptionPaymentFailed(payment, plan);

      expect(notification).toBeDefined();
      expect(notification.type).toBe('subscription');
      expect(notification.subtype).toBe('subscription_payment_failed');
      expect(notification.priority).toBe('urgent');
      expect(notification.actionUrl).toBe('/app/settings?tab=subscriptions');
    });

    it('should create subscription cancelled notification', async () => {
      const payment = {
        _id: testPaymentId,
        firmId: testFirmId,
        createdBy: testUserId
      };

      const plan = {
        planName: 'Monthly'
      };

      const notification = await notificationService.notifySubscriptionCancelled(payment, plan);

      expect(notification).toBeDefined();
      expect(notification.type).toBe('subscription');
      expect(notification.subtype).toBe('subscription_cancelled');
      expect(notification.priority).toBe('high');
      expect(notification.actionUrl).toBe('/app/settings?tab=subscriptions');
    });
  });

  describe('Document Notifications', () => {
    it('should create document uploaded notification when CA-Admin uploads in conversation (notifies Client)', async () => {
      const documents = [{
        _id: testDocumentId,
        fileName: 'test.pdf',
        category: 'Miscellaneous'
      }];

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        firmId: testFirmId,
        userAccountId: testUserId
      };

      const uploadedBy = {
        name: 'Admin User',
        role: 'CA-Admin'
      };

      const notification = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        true // isConversationUpload
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('document');
      expect(notification.subtype).toBe('document_uploaded');
      expect(notification.title).toBe('Document Uploaded');
      expect(notification.recipientId.toString()).toBe(testUserId.toString());
      expect(notification.actionUrl).toBe('/portal/conversations');
      expect(notification.metadata.source).toBe('conversation');
    });

    it('should create document uploaded notification when Client uploads in conversation (notifies CA-Admin)', async () => {
      const documents = [{
        _id: testDocumentId,
        fileName: 'test.pdf',
        category: 'Miscellaneous'
      }];

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        firmId: testFirmId
      };

      const uploadedBy = {
        name: 'Client User',
        role: 'Client'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        true // isConversationUpload
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document');
      expect(notifications[0].subtype).toBe('document_uploaded');
      expect(notifications[0].title).toBe('Document Uploaded');
      expect(notifications[0].actionUrl).toBe('/app/conversations');
      expect(notifications[0].metadata.source).toBe('conversation');
    });

    it('should NOT create notification for regular document upload (non-conversation)', async () => {
      const documents = [{
        _id: testDocumentId,
        fileName: 'test.pdf',
        category: 'GST_Filings'
      }];

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        firmId: testFirmId
      };

      const uploadedBy = {
        name: 'Admin User',
        role: 'CA-Admin'
      };

      const notification = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        false // isConversationUpload = false (regular upload)
      );

      expect(notification).toBeNull();
    });

    it('should create bulk documents uploaded notification in conversation', async () => {
      const documents = [
        { _id: new mongoose.Types.ObjectId(), fileName: 'test1.pdf', category: 'Miscellaneous' },
        { _id: new mongoose.Types.ObjectId(), fileName: 'test2.pdf', category: 'Miscellaneous' },
        { _id: new mongoose.Types.ObjectId(), fileName: 'test3.pdf', category: 'Miscellaneous' }
      ];

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        firmId: testFirmId
      };

      const uploadedBy = {
        name: 'Client User',
        role: 'Client'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        true // isConversationUpload
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].subtype).toBe('bulk_documents_uploaded');
      expect(notifications[0].title).toBe('3 Documents Uploaded');
      expect(notifications[0].metadata.documentCount).toBe(3);
      expect(notifications[0].metadata.source).toBe('conversation');
    });

    it('should create document accessed notification only when Client accesses', async () => {
      const document = {
        _id: testDocumentId,
        fileName: 'test.pdf',
        firmId: testFirmId
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      const accessedBy = {
        role: 'Client'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyDocumentAccessed(document, client, accessedBy);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document');
      expect(notifications[0].subtype).toBe('document_accessed');
      expect(notifications[0].priority).toBe('low');
      expect(notifications[0].actionUrl).toBe('/app/documents');
    });

    it('should not create document accessed notification when CA-Admin accesses', async () => {
      const document = {
        _id: testDocumentId,
        fileName: 'test.pdf',
        firmId: testFirmId
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      const accessedBy = {
        role: 'CA-Admin'
      };

      const notification = await notificationService.notifyDocumentAccessed(document, client, accessedBy);

      expect(notification).toBeNull();
    });
  });

  describe('Thread Notifications', () => {
    it('should create thread created notification when Client creates (notifies CA-Admin)', async () => {
      const thread = {
        _id: testThreadId,
        threadNumber: 'THR-2026-00001',
        subject: 'Test Thread',
        serviceType: 'General',
        firmId: testFirmId
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      const initiatedBy = {
        role: 'Client'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyThreadCreated(
        thread,
        client,
        initiatedBy
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('thread');
      expect(notifications[0].subtype).toBe('thread_created');
      expect(notifications[0].priority).toBe('normal');
      expect(notifications[0].actionUrl).toBe(`/app/conversations/${testThreadId}`);
    });

    it('should create thread created notification when CA-Admin creates (notifies Client)', async () => {
      const thread = {
        _id: testThreadId,
        threadNumber: 'THR-2026-00001',
        subject: 'Test Thread',
        serviceType: 'General',
        firmId: testFirmId
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        userAccountId: testUserId
      };

      const initiatedBy = {
        role: 'CA-Admin'
      };

      const notification = await notificationService.notifyThreadCreated(
        thread,
        client,
        initiatedBy
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('thread');
      expect(notification.subtype).toBe('thread_created');
      expect(notification.priority).toBe('normal');
      expect(notification.recipientId.toString()).toBe(testUserId.toString());
      expect(notification.actionUrl).toBe(`/portal/conversations/${testThreadId}`);
    });

    it('should create thread message received notification when Client sends (notifies CA-Admin)', async () => {
      const thread = {
        _id: testThreadId,
        threadNumber: 'THR-2026-00001',
        subject: 'Test Thread',
        firmId: testFirmId
      };

      const message = {
        content: 'This is a test message from client',
        attachments: []
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company'
      };

      const sender = {
        role: 'Client'
      };

      await User.create({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin',
        role: 'CA-Admin',
        firmId: testFirmId,
        isActive: true,
        isEmailVerified: true
      });

      const notifications = await notificationService.notifyThreadMessageReceived(
        thread,
        message,
        client,
        sender
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('thread');
      expect(notifications[0].subtype).toBe('thread_message_received');
      expect(notifications[0].actionUrl).toBe(`/app/conversations/${testThreadId}`);
    });

    it('should create thread message received notification when CA-Admin sends (notifies Client)', async () => {
      const thread = {
        _id: testThreadId,
        threadNumber: 'THR-2026-00001',
        subject: 'Test Thread',
        firmId: testFirmId
      };

      const message = {
        content: 'This is a test message from admin',
        attachments: []
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        userAccountId: testUserId
      };

      const sender = {
        role: 'CA-Admin'
      };

      const notification = await notificationService.notifyThreadMessageReceived(
        thread,
        message,
        client,
        sender
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('thread');
      expect(notification.subtype).toBe('thread_message_received');
      expect(notification.recipientId.toString()).toBe(testUserId.toString());
      expect(notification.actionUrl).toBe(`/portal/conversations/${testThreadId}`);
    });

    it('should create thread resolved notification (only notifies Client)', async () => {
      const thread = {
        _id: testThreadId,
        threadNumber: 'THR-2026-00001',
        subject: 'Test Thread',
        firmId: testFirmId
      };

      const client = {
        _id: testClientId,
        companyName: 'Test Company',
        userAccountId: testUserId
      };

      const resolvedBy = {
        name: 'Admin User'
      };

      const notification = await notificationService.notifyThreadResolved(
        thread,
        client,
        resolvedBy
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('thread');
      expect(notification.subtype).toBe('thread_resolved');
      expect(notification.priority).toBe('low');
      expect(notification.recipientId.toString()).toBe(testUserId.toString());
      expect(notification.actionUrl).toBe(`/portal/conversations/${testThreadId}`);
    });
  });

  describe('System Notifications', () => {
    it('should create system alert', async () => {
      const notification = await notificationService.createSystemAlert(
        testFirmId,
        testUserId,
        'System Alert',
        'This is a system alert',
        { key: 'value' }
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('system');
      expect(notification.subtype).toBe('system_alert');
      expect(notification.priority).toBe('normal');
    });

    it('should create system warning', async () => {
      const notification = await notificationService.createSystemWarning(
        testFirmId,
        testUserId,
        'System Warning',
        'This is a system warning'
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('system');
      expect(notification.subtype).toBe('system_warning');
      expect(notification.priority).toBe('high');
    });

    it('should create system error', async () => {
      const notification = await notificationService.createSystemError(
        testFirmId,
        testUserId,
        'System Error',
        'This is a system error'
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('system');
      expect(notification.subtype).toBe('system_error');
      expect(notification.priority).toBe('urgent');
    });
  });
});

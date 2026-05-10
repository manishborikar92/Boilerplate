/**
 * Simplified Integration Tests for Notification Service
 * Tests core notification service functionality
 */

const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const Client = require('../../src/models/Client');
const Notification = require('../../src/models/Notification');
const notificationService = require('../../src/services/notificationService');

// Mock logger
jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock email notification service
jest.mock('../../src/services/emailNotificationService', () => ({
  sendNotificationEmail: jest.fn().mockResolvedValue(true),
  sendBatchNotificationEmails: jest.fn().mockResolvedValue(true)
}));

describe('Notification Service - Core Functionality', () => {
  let caAdminUser;
  let firm;
  let client;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/ca-flow-test');
    }
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Firm.deleteMany({}),
      Client.deleteMany({}),
      Notification.deleteMany({})
    ]);

    // Create CA-Admin user
    caAdminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      name: 'Test Admin',
      role: 'CA-Admin',
      isEmailVerified: true,
      isActive: true
    });

    // Create firm
    firm = await Firm.create({
      firmName: 'Test CA Firm',
      registrationNumber: 'REG-TEST-001',
      pan: 'ABCDE1234F',
      officialEmail: 'firm@test.com',
      contactNumber: '+91-9876543210',
      adminId: caAdminUser._id,
      bankDetails: {
        bankName: 'Test Bank',
        accountHolderName: 'Test Firm',
        accountNumber: '1234567890',
        ifscCode: 'ABCD0123456',
        accountType: 'Current'
      }
    });

    caAdminUser.firmId = firm._id;
    await caAdminUser.save();

    // Create client
    client = await Client.create({
      companyName: 'Test Company Ltd',
      companyType: 'Pvt. Ltd.',
      pan: 'ABCDE1234F',
      gstin: '29ABCDE1234F1Z5',
      email: 'client@testcompany.com',
      phoneNumber: '+91-9876543210',
      firmId: firm._id,
      userId: 'CA-CLT-001',
      createdBy: caAdminUser._id,
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        country: 'India'
      }
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Payment Notifications', () => {
    test('should create payment received notification', async () => {
      const payment = {
        _id: new mongoose.Types.ObjectId(),
        firmId: firm._id,
        amount: 50000,
        paymentType: 'document',
        invoiceNumber: 'INV-001'
      };

      await notificationService.notifyPaymentReceived(payment, client);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'payment',
        subtype: 'document_payment_received'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Payment Received');
      expect(notifications[0].message).toContain('₹500.00');
      expect(notifications[0].message).toContain('Test Company Ltd');
      expect(notifications[0].priority).toBe('high');
    });

    test('should create payment failed notification', async () => {
      const payment = {
        _id: new mongoose.Types.ObjectId(),
        firmId: firm._id,
        amount: 100000,
        paymentType: 'invoice'
      };

      await notificationService.notifyPaymentFailed(payment, client);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'payment',
        subtype: 'payment_failed'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Payment Failed');
      expect(notifications[0].priority).toBe('high');
    });
  });

  describe('Login Notifications', () => {
    test('should create client first login notification', async () => {
      const user = { _id: new mongoose.Types.ObjectId(), email: 'client@test.com' };
      await notificationService.notifyClientFirstLogin(client, user);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'login',
        subtype: 'client_first_login'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Client First Login');
      expect(notifications[0].priority).toBe('normal');
    });

    test('should create regular client login notification', async () => {
      const user = { _id: new mongoose.Types.ObjectId(), email: 'client@test.com' };
      await notificationService.notifyClientLogin(client, user);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'login',
        subtype: 'client_login'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('low');
    });
  });

  describe('Subscription Notifications', () => {
    test('should create subscription activated notification', async () => {
      const payment = {
        _id: new mongoose.Types.ObjectId(),
        firmId: firm._id,
        createdBy: caAdminUser._id,
        amount: 99900,
        billingPeriod: 'monthly',
        nextBillingDate: new Date()
      };

      const plan = { planName: 'Pro Plan' };
      await notificationService.notifySubscriptionActivated(payment, plan);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'subscription',
        subtype: 'subscription_activated'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('high');
    });
  });

  describe('System Notifications', () => {
    test('should create system alert', async () => {
      await notificationService.createSystemAlert(
        firm._id,
        caAdminUser._id,
        'System Maintenance',
        'System will be under maintenance tonight'
      );

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'system',
        subtype: 'system_alert'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('normal');
    });

    test('should create system warning', async () => {
      await notificationService.createSystemWarning(
        firm._id,
        caAdminUser._id,
        'Storage Limit Warning',
        'You are approaching your storage limit'
      );

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'system',
        subtype: 'system_warning'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('high');
    });

    test('should create system error', async () => {
      await notificationService.createSystemError(
        firm._id,
        caAdminUser._id,
        'Critical Error',
        'A critical error occurred'
      );

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'system',
        subtype: 'system_error'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('urgent');
    });
  });

  describe('Multiple CA-Admins', () => {
    test('should create notifications for all CA-Admins in firm', async () => {
      const caAdmin2 = await User.create({
        email: 'admin2@test.com',
        password: 'password123',
        name: 'Test Admin 2',
        role: 'CA-Admin',
        firmId: firm._id,
        isEmailVerified: true,
        isActive: true
      });

      const payment = {
        _id: new mongoose.Types.ObjectId(),
        firmId: firm._id,
        amount: 25000,
        paymentType: 'document'
      };

      await notificationService.notifyPaymentReceived(payment, client);

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'payment'
      });

      expect(notifications).toHaveLength(2);
      
      const recipientIds = notifications.map(n => n.recipientId.toString());
      expect(recipientIds).toContain(caAdminUser._id.toString());
      expect(recipientIds).toContain(caAdmin2._id.toString());
    });
  });

  describe('Notification Model Methods', () => {
    test('should get unread count', async () => {
      await notificationService.createSystemAlert(
        firm._id,
        caAdminUser._id,
        'Alert 1',
        'Message 1'
      );
      await notificationService.createSystemAlert(
        firm._id,
        caAdminUser._id,
        'Alert 2',
        'Message 2'
      );

      const count = await Notification.getUnreadCount(caAdminUser._id);
      expect(count).toBe(2);
    });

    test('should mark notification as read', async () => {
      const notification = await notificationService.createSystemAlert(
        firm._id,
        caAdminUser._id,
        'Test Alert',
        'Test Message'
      );

      await Notification.markAsRead(notification._id, caAdminUser._id);

      const updated = await Notification.findById(notification._id);
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    test('should mark all notifications as read', async () => {
      await notificationService.createSystemAlert(firm._id, caAdminUser._id, 'Alert 1', 'Message 1');
      await notificationService.createSystemAlert(firm._id, caAdminUser._id, 'Alert 2', 'Message 2');
      await notificationService.createSystemAlert(firm._id, caAdminUser._id, 'Alert 3', 'Message 3');

      await Notification.markAllAsRead(caAdminUser._id);

      const unreadCount = await Notification.countDocuments({
        recipientId: caAdminUser._id,
        isRead: false
      });
      expect(unreadCount).toBe(0);
    });
  });
});

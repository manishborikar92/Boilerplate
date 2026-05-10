/**
 * Unit Tests for Notification Model
 * Tests model methods, validations, and schema
 */

const Notification = require('../../src/models/Notification');
const mongoose = require('mongoose');
require('../../src/models/User');
require('../../src/models/Firm');

describe('Notification Model - Unit Tests', () => {
  let testFirmId;
  let testUserId;
  let testEntityId;

  beforeAll(() => {
    testFirmId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testEntityId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid notification using createNotification', async () => {
      const notificationData = {
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Payment Received',
        message: 'Payment of ₹100.00 received',
        recipientId: testUserId,
        firmId: testFirmId
      };

      const notification = await Notification.createNotification(notificationData);

      expect(notification).toBeDefined();
      expect(notification.notificationNumber).toMatch(/^NOT-\d{4}-\d{5}$/);
      expect(notification.type).toBe('payment');
      expect(notification.isRead).toBe(false);
    });

    it('should require type field', async () => {
      await expect(Notification.createNotification({
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId
      })).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should generate unique notification number', async () => {
      const number1 = await Notification.generateNotificationNumber(testFirmId);
      const number2 = await Notification.generateNotificationNumber(testFirmId);

      expect(number1).toMatch(/^NOT-\d{4}-\d{5}$/);
      expect(number2).toMatch(/^NOT-\d{4}-\d{5}$/);
    });

    it('should mark notification as read with recipientId', async () => {
      const notification = await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId
      });

      const updated = await Notification.markAsRead(notification._id, testUserId);
      expect(updated).toBeDefined();
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    it('should mark all notifications as read', async () => {
      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 1',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: false
      });

      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 2',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: false
      });

      const result = await Notification.markAllAsRead(testUserId);
      expect(result.modifiedCount).toBe(2);
    });

    it('should get unread count', async () => {
      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 1',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: false
      });

      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 2',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: true
      });

      const count = await Notification.getUnreadCount(testUserId);
      expect(count).toBe(1);
    });

    it('filters user notifications with pagination', async () => {
      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 1',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: false
      });
      await Notification.createNotification({
        type: 'payment',
        subtype: 'document_payment_received',
        priority: 'high',
        title: 'Test 2',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        isRead: true,
        isArchived: true
      });

      const result = await Notification.getUserNotifications(testUserId, { isRead: false, page: 1, limit: 10 });
      expect(result.notifications.length).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('archives notification and deletes old ones', async () => {
      const notification = await Notification.createNotification({
        type: 'system',
        subtype: 'system_alert',
        priority: 'normal',
        title: 'Test',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId
      });

      const archived = await Notification.archiveNotification(notification._id, testUserId);
      expect(archived.isArchived).toBe(true);
      expect(archived.archivedAt).toBeDefined();

      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      await Notification.updateMany({}, { $set: { isRead: true } });
      await Notification.collection.updateOne({ _id: notification._id }, { $set: { createdAt: pastDate } });
      const deleted = await Notification.deleteOldNotifications(1);
      expect(deleted.deletedCount).toBe(1);
    });
  });

  describe('Virtuals and Instance Methods', () => {
    it('computes age and expiration and toggles flags', async () => {
      const notification = await Notification.createNotification({
        type: 'system',
        subtype: 'system_warning',
        priority: 'normal',
        title: 'Test',
        message: 'Test',
        recipientId: testUserId,
        firmId: testFirmId,
        expiresAt: new Date(Date.now() - 1000)
      });

      const fresh = await Notification.findById(notification._id);
      expect(fresh.isExpired).toBe(true);
      expect(fresh.age).toBeGreaterThanOrEqual(0);

      await fresh.markAsRead();
      await fresh.archive();
      await fresh.softDelete();

      const updated = await Notification.findById(notification._id);
      expect(updated.isRead).toBe(true);
      expect(updated.isArchived).toBe(true);
      expect(updated.isDeleted).toBe(true);
    });
  });
});

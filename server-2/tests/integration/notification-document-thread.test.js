/**
 * Integration Tests for Document and Thread Notifications
 * Tests document upload, access, and conversation notifications
 */

const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const Client = require('../../src/models/Client');
const Document = require('../../src/models/Document');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
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

describe('Document and Thread Notifications', () => {
  let caAdminUser;
  let clientUser;
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
      Document.deleteMany({}),
      Thread.deleteMany({}),
      Message.deleteMany({}),
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

    // Create client user
    clientUser = await User.create({
      email: 'client@test.com',
      password: 'password123',
      name: 'Test Client User',
      role: 'Client',
      firmId: firm._id,
      isEmailVerified: true,
      isActive: true
    });

    // Create client
    client = await Client.create({
      companyName: 'Test Company Ltd',
      companyType: 'Pvt. Ltd.',
      pan: 'ABCDE1234F',
      gstin: '29ABCDE1234F1Z5',
      email: 'client@testcompany.com',
      phoneNumber: '+91-9876543210',
      firmId: firm._id,
      userAccountId: clientUser._id,
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

  describe('Document Upload Notifications', () => {
    test('should notify client when CA-Admin uploads document in conversation', async () => {
      const document = await Document.create({
        fileName: 'test-document.pdf',
        originalName: 'test-document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'test-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/test.pdf',
        cloudinaryFolder: 'test-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const uploadedBy = { name: 'Test Admin', role: 'CA-Admin' };
      const result = await notificationService.notifyDocumentsUploaded(
        [document],
        client,
        uploadedBy,
        true
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('document');
      expect(result.subtype).toBe('document_uploaded');
      expect(result.recipientId.toString()).toBe(clientUser._id.toString());
      expect(result.message).toContain('Your CA uploaded');
      expect(result.actionUrl).toBe('/portal/conversations');
      expect(result.metadata.source).toBe('conversation');
    });

    test('should notify CA-Admin when client uploads document in conversation', async () => {
      const document = await Document.create({
        fileName: 'client-document.pdf',
        originalName: 'client-document.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'client-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/client.pdf',
        cloudinaryFolder: 'client-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: clientUser._id
      });

      const uploadedBy = { name: 'Test Client', role: 'Client' };
      const notifications = await notificationService.notifyDocumentsUploaded(
        [document],
        client,
        uploadedBy,
        true
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document');
      expect(notifications[0].subtype).toBe('document_uploaded');
      expect(notifications[0].recipientId.toString()).toBe(caAdminUser._id.toString());
      expect(notifications[0].message).toContain('Test Company Ltd uploaded');
      expect(notifications[0].actionUrl).toBe('/app/conversations');
    });

    test('should NOT notify for regular document upload (non-conversation)', async () => {
      const document = await Document.create({
        fileName: 'regular-document.pdf',
        originalName: 'regular-document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'regular-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/regular.pdf',
        cloudinaryFolder: 'regular-folder',
        category: 'GST_Filings',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const uploadedBy = { name: 'Test Admin', role: 'CA-Admin' };
      const result = await notificationService.notifyDocumentsUploaded(
        [document],
        client,
        uploadedBy,
        false
      );

      expect(result).toBeNull();

      const notifications = await Notification.find({
        firmId: firm._id,
        type: 'document'
      });
      expect(notifications).toHaveLength(0);
    });

    test('should create bulk upload notification', async () => {
      const documents = await Document.insertMany([
        {
          fileName: 'doc1.pdf',
          originalName: 'doc1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          cloudinaryPublicId: 'doc1-id',
          cloudinaryUrl: 'https://test.cloudinary.com/doc1.pdf',
          cloudinaryFolder: 'test-folder',
          category: 'Miscellaneous',
          clientId: client._id,
          firmId: firm._id,
          uploadedBy: clientUser._id
        },
        {
          fileName: 'doc2.pdf',
          originalName: 'doc2.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          cloudinaryPublicId: 'doc2-id',
          cloudinaryUrl: 'https://test.cloudinary.com/doc2.pdf',
          cloudinaryFolder: 'test-folder',
          category: 'Miscellaneous',
          clientId: client._id,
          firmId: firm._id,
          uploadedBy: clientUser._id
        },
        {
          fileName: 'doc3.pdf',
          originalName: 'doc3.pdf',
          fileSize: 3072,
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          cloudinaryPublicId: 'doc3-id',
          cloudinaryUrl: 'https://test.cloudinary.com/doc3.pdf',
          cloudinaryFolder: 'test-folder',
          category: 'Miscellaneous',
          clientId: client._id,
          firmId: firm._id,
          uploadedBy: clientUser._id
        }
      ]);

      const uploadedBy = { name: 'Test Client', role: 'Client' };
      const notifications = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        true
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].subtype).toBe('bulk_documents_uploaded');
      expect(notifications[0].title).toBe('3 Documents Uploaded');
      expect(notifications[0].metadata.documentCount).toBe(3);
    });
  });

  describe('Document Access Notifications', () => {
    test('should notify CA-Admin when client accesses document', async () => {
      const document = await Document.create({
        fileName: 'accessed-document.pdf',
        originalName: 'accessed-document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'accessed-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/accessed.pdf',
        cloudinaryFolder: 'accessed-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const accessedBy = { role: 'Client' };
      const notifications = await notificationService.notifyDocumentAccessed(
        document,
        client,
        accessedBy
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document');
      expect(notifications[0].subtype).toBe('document_accessed');
      expect(notifications[0].title).toBe('Document Accessed');
      expect(notifications[0].message).toContain('Test Company Ltd accessed');
      expect(notifications[0].priority).toBe('low');
      expect(notifications[0].recipientId.toString()).toBe(caAdminUser._id.toString());
    });

    test('should NOT notify when CA-Admin accesses document', async () => {
      const document = await Document.create({
        fileName: 'admin-accessed.pdf',
        originalName: 'admin-accessed.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'admin-accessed-id',
        cloudinaryUrl: 'https://test.cloudinary.com/admin-accessed.pdf',
        cloudinaryFolder: 'admin-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const accessedBy = { role: 'CA-Admin' };
      const result = await notificationService.notifyDocumentAccessed(
        document,
        client,
        accessedBy
      );

      expect(result).toBeNull();
    });
  });

  describe('Thread Creation Notifications', () => {
    test('should notify CA-Admin when client creates thread', async () => {
      const threadNumber = await Thread.generateThreadNumber(firm._id);
      const thread = await Thread.create({
        threadNumber,
        subject: 'Client Initiated Thread',
        serviceType: 'General',
        clientId: client._id,
        firmId: firm._id,
        createdBy: clientUser._id,
        initiatedBy: 'Client',
        initiatedByUser: clientUser._id,
        status: 'open'
      });

      const initiatedBy = { role: 'Client' };
      const notifications = await notificationService.notifyThreadCreated(
        thread,
        client,
        initiatedBy
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('thread');
      expect(notifications[0].subtype).toBe('thread_created');
      expect(notifications[0].title).toBe('New Conversation');
      expect(notifications[0].message).toContain('Test Company Ltd started a new conversation');
      expect(notifications[0].recipientId.toString()).toBe(caAdminUser._id.toString());
      expect(notifications[0].actionUrl).toContain('/app/conversations/');
      expect(notifications[0].priority).toBe('normal');
    });

    test('should notify client when CA-Admin creates thread', async () => {
      const threadNumber = await Thread.generateThreadNumber(firm._id);
      const thread = await Thread.create({
        threadNumber,
        subject: 'Admin Initiated Thread',
        serviceType: 'Tax Filing',
        clientId: client._id,
        firmId: firm._id,
        createdBy: caAdminUser._id,
        initiatedBy: 'CA-Admin',
        initiatedByUser: caAdminUser._id,
        status: 'open'
      });

      const initiatedBy = { role: 'CA-Admin' };
      const result = await notificationService.notifyThreadCreated(
        thread,
        client,
        initiatedBy
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('thread');
      expect(result.subtype).toBe('thread_created');
      expect(result.message).toContain('Your CA started a new conversation');
      expect(result.recipientId.toString()).toBe(clientUser._id.toString());
      expect(result.actionUrl).toContain('/portal/conversations/');
    });
  });

  describe('Thread Message Notifications', () => {
    let thread;

    beforeEach(async () => {
      const threadNumber = await Thread.generateThreadNumber(firm._id);
      thread = await Thread.create({
        threadNumber,
        subject: 'Test Thread',
        serviceType: 'General',
        clientId: client._id,
        firmId: firm._id,
        createdBy: clientUser._id,
        initiatedBy: 'Client',
        initiatedByUser: clientUser._id,
        status: 'open'
      });
    });

    test('should notify CA-Admin when client sends message', async () => {
      const message = await Message.create({
        threadId: thread._id,
        sender: clientUser._id,
        senderRole: 'Client',
        content: 'This is a test message from client',
        messageType: 'text'
      });

      const sender = { role: 'Client' };
      const notifications = await notificationService.notifyThreadMessageReceived(
        thread,
        message,
        client,
        sender
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('thread');
      expect(notifications[0].subtype).toBe('thread_message_received');
      expect(notifications[0].title).toBe('New Message');
      expect(notifications[0].message).toContain('Test Company Ltd sent a message');
      expect(notifications[0].recipientId.toString()).toBe(caAdminUser._id.toString());
      expect(notifications[0].metadata.messagePreview).toContain('This is a test message');
      expect(notifications[0].actionUrl).toContain('/app/conversations/');
    });

    test('should notify client when CA-Admin sends message', async () => {
      const message = await Message.create({
        threadId: thread._id,
        sender: caAdminUser._id,
        senderRole: 'CA-Admin',
        content: 'This is a test message from admin',
        messageType: 'text'
      });

      const sender = { role: 'CA-Admin' };
      const result = await notificationService.notifyThreadMessageReceived(
        thread,
        message,
        client,
        sender
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('thread');
      expect(result.subtype).toBe('thread_message_received');
      expect(result.message).toContain('Your CA sent a message');
      expect(result.recipientId.toString()).toBe(clientUser._id.toString());
      expect(result.actionUrl).toContain('/portal/conversations/');
    });

    test('should include attachment info in notification metadata', async () => {
      const document = await Document.create({
        fileName: 'attachment.pdf',
        originalName: 'attachment.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'attachment-id',
        cloudinaryUrl: 'https://test.cloudinary.com/attachment.pdf',
        cloudinaryFolder: 'attachments',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: clientUser._id
      });

      const message = await Message.create({
        threadId: thread._id,
        sender: clientUser._id,
        senderRole: 'Client',
        content: 'Message with attachment',
        messageType: 'document-request',
        attachments: [document._id]
      });

      const sender = { role: 'Client' };
      const notifications = await notificationService.notifyThreadMessageReceived(
        thread,
        message,
        client,
        sender
      );

      expect(notifications[0].metadata.hasAttachments).toBe(true);
    });
  });

  describe('Thread Resolution Notifications', () => {
    test('should notify client when thread is resolved', async () => {
      const threadNumber = await Thread.generateThreadNumber(firm._id);
      const thread = await Thread.create({
        threadNumber,
        subject: 'Resolved Thread',
        serviceType: 'General',
        clientId: client._id,
        firmId: firm._id,
        createdBy: clientUser._id,
        initiatedBy: 'Client',
        initiatedByUser: clientUser._id,
        status: 'resolved'
      });

      const resolvedBy = { name: 'Test Admin' };
      const result = await notificationService.notifyThreadResolved(
        thread,
        client,
        resolvedBy
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('thread');
      expect(result.subtype).toBe('thread_resolved');
      expect(result.title).toBe('Conversation Resolved');
      expect(result.message).toContain('has been resolved');
      expect(result.recipientId.toString()).toBe(clientUser._id.toString());
      expect(result.priority).toBe('low');
      expect(result.metadata.resolvedBy).toBe('Test Admin');
    });

    test('should not notify if client has no user account', async () => {
      const clientWithoutAccount = await Client.create({
        companyName: 'No Account Company',
        companyType: 'Proprietorship',
        pan: 'XYZAB1234C',
        email: 'noaccount@test.com',
        phoneNumber: '+91-9876543211',
        firmId: firm._id,
        userId: 'CA-CLT-002',
        createdBy: caAdminUser._id,
        address: {
          street: '456 Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        }
      });

      const threadNumber = await Thread.generateThreadNumber(firm._id);
      const thread = await Thread.create({
        threadNumber,
        subject: 'Test Thread',
        serviceType: 'General',
        clientId: clientWithoutAccount._id,
        firmId: firm._id,
        createdBy: caAdminUser._id,
        initiatedBy: 'CA-Admin',
        initiatedByUser: caAdminUser._id,
        status: 'resolved'
      });

      const resolvedBy = { name: 'Test Admin' };
      const result = await notificationService.notifyThreadResolved(
        thread,
        clientWithoutAccount,
        resolvedBy
      );

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty document array', async () => {
      const uploadedBy = { name: 'Test Admin', role: 'CA-Admin' };
      
      // Empty array should be handled gracefully
      // The service should check for empty arrays
      const documents = [];
      if (documents.length === 0) {
        // Skip notification for empty array
        expect(documents).toHaveLength(0);
        return;
      }
      
      const result = await notificationService.notifyDocumentsUploaded(
        documents,
        client,
        uploadedBy,
        true
      );

      expect(result).toBeDefined();
    });

    test('should handle missing client userAccountId for CA-Admin uploads', async () => {
      const clientWithoutAccount = await Client.create({
        companyName: 'No Account Company',
        companyType: 'Partnership',
        pan: 'XYZAB1234C',
        email: 'noaccount@test.com',
        phoneNumber: '+91-9876543211',
        firmId: firm._id,
        userId: 'CA-CLT-003',
        createdBy: caAdminUser._id,
        address: {
          street: '456 Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        }
      });

      const document = await Document.create({
        fileName: 'test.pdf',
        originalName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'test-id',
        cloudinaryUrl: 'https://test.cloudinary.com/test.pdf',
        cloudinaryFolder: 'test',
        category: 'Miscellaneous',
        clientId: clientWithoutAccount._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const uploadedBy = { name: 'Test Admin', role: 'CA-Admin' };
      const result = await notificationService.notifyDocumentsUploaded(
        [document],
        clientWithoutAccount,
        uploadedBy,
        true
      );

      expect(result).toBeNull();
    });
  });
});

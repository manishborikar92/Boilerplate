/**
 * Document Routes Integration Tests
 * Tests all document-related endpoints with proper authorization
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const Client = require('../../src/models/Client');
const Document = require('../../src/models/Document');
const Folder = require('../../src/models/Folder');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('Document Routes', () => {
  let caAdminToken, clientToken;
  let caAdminUser, clientUser;
  let firm, client;
  let testDocument;
  let testFolder;
  let testThread;

  beforeAll(async () => {
    // Create CA-Admin user first (needed for firm.adminId)
    caAdminUser = await User.create({
      name: 'CA Admin',
      email: 'ca@test.com',
      password: 'password123',
      role: 'CA-Admin',
      isActive: true,
      isEmailVerified: true
    });

    // Create firm with required fields
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

    // Update CA-Admin user with firmId
    caAdminUser.firmId = firm._id;
    await caAdminUser.save();

    // Create client user
    clientUser = await User.create({
      name: 'Client User',
      email: 'client@test.com',
      password: 'password123',
      role: 'Client',
      isActive: true,
      isEmailVerified: true
    });

    // Generate required fields for client
    const userId = await Client.generateUserId(firm._id);
    const generatedPassword = Client.generatePassword();

    // Create client profile
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

    // Generate tokens
    caAdminToken = generateAccessToken(caAdminUser._id);
    clientToken = generateAccessToken(clientUser._id);

    testFolder = await Folder.create({
      name: 'Test Folder',
      category: null,
      description: null,
      color: '#3B82F6',
      clientId: client._id,
      firmId: firm._id,
      createdBy: caAdminUser._id
    });

    // Create test document
    testDocument = await Document.create({
      fileName: 'test-document.pdf',
      originalName: 'test-document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      cloudinaryPublicId: 'test-public-id',
      cloudinaryUrl: 'https://test.cloudinary.com/test.pdf',
      cloudinaryFolder: 'test-folder',
      category: 'GST_Filings',
      clientId: client._id,
      firmId: firm._id,
      uploadedBy: caAdminUser._id,
      folderId: testFolder._id,
      description: 'Test document'
    });

    testThread = await Thread.create({
      threadNumber: 'THR-2026-00001',
      subject: 'Document Sharing',
      serviceType: 'General',
      clientId: client._id,
      firmId: firm._id,
      initiatedBy: 'CA-Admin',
      initiatedByUser: caAdminUser._id,
      status: 'open',
      priority: 'normal'
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Firm.deleteMany({});
    await Client.deleteMany({});
    await Document.deleteMany({});
    await Folder.deleteMany({});
    await Thread.deleteMany({});
    await Message.deleteMany({});
  });

  describe('GET /api/documents/categories', () => {
    it('should get all document categories', async () => {
      const res = await request(app)
        .get('/api/documents/categories')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeInstanceOf(Array);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/documents/categories');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/documents/client/:clientId', () => {
    it('should get all documents for a client (CA-Admin)', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should get own documents (Client)', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeInstanceOf(Array);
    });

    it('should flag documents locked by chat payment for clients', async () => {
      await Message.create({
        threadId: testThread._id,
        sender: caAdminUser._id,
        senderRole: 'CA-Admin',
        content: 'Payment required for document',
        attachments: [testDocument._id],
        paymentRequired: true,
        paymentAmount: 10000
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      const doc = res.body.data.documents.find((item) => item._id === testDocument._id.toString());
      expect(doc).toBeDefined();
      expect(doc.lockedByChatPayment).toBe(true);
    });

    it('should not allow client to access other client documents', async () => {
      // Create another client
      const otherClient = await Client.create({
        companyName: 'Other Company',
        email: 'other@test.com',
        phoneNumber: '9876543211',
        firmId: firm._id,
        companyType: 'Pvt. Ltd.',
        userId: await Client.generateUserId(firm._id),
        generatedPassword: Client.generatePassword(),
        createdBy: caAdminUser._id
      });

      const res = await request(app)
        .get(`/api/documents/client/${otherClient._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);

      await Client.findByIdAndDelete(otherClient._id);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}?page=1&limit=10`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it('should support category filter', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}?category=GST_Filings`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/documents/client/:clientId/locked', () => {
    it('should include pending chat payment documents and totals', async () => {
      await Message.deleteMany({ threadId: testThread._id });

      await Message.create({
        threadId: testThread._id,
        sender: caAdminUser._id,
        senderRole: 'CA-Admin',
        content: 'Payment requested for document',
        attachments: [testDocument._id],
        paymentRequired: true,
        paymentAmount: 15000
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}/locked`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThan(0);
      const lockedIds = res.body.data.documents.map((doc) => doc._id);
      expect(lockedIds).toContain(testDocument._id.toString());
      expect(res.body.data.totalPaymentRequired).toBe(15000);
    });

    it('should not double count total due for multi-attachment chat payments', async () => {
      await Message.deleteMany({ threadId: testThread._id });

      const secondDoc = await Document.create({
        fileName: 'second-document.pdf',
        originalName: 'second-document.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'second-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/second.pdf',
        cloudinaryFolder: 'test-folder',
        category: 'GST_Filings',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id,
        folderId: testFolder._id,
        description: 'Second document'
      });

      await Message.create({
        threadId: testThread._id,
        sender: caAdminUser._id,
        senderRole: 'CA-Admin',
        content: 'Payment for multiple documents',
        attachments: [testDocument._id, secondDoc._id],
        paymentRequired: true,
        paymentAmount: 550000
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}/locked`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const lockedIds = res.body.data.documents.map((doc) => doc._id);
      expect(lockedIds).toContain(testDocument._id.toString());
      expect(lockedIds).toContain(secondDoc._id.toString());
      expect(res.body.data.totalPaymentRequired).toBe(550000);
    });
  });

  describe('GET /api/documents/client/:clientId/shared', () => {
    it('should return only CA-Admin shared documents with payment state', async () => {
      const clientDoc = await Document.create({
        fileName: 'client-upload.pdf',
        originalName: 'client-upload.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'client-public-id',
        cloudinaryUrl: 'https://test.cloudinary.com/client.pdf',
        cloudinaryFolder: 'test-folder',
        category: 'Miscellaneous',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: clientUser._id,
        folderId: null,
        description: 'Client document'
      });

      await Message.create({
        threadId: testThread._id,
        sender: caAdminUser._id,
        senderRole: 'CA-Admin',
        content: 'Shared document',
        attachments: [testDocument._id],
        paymentRequired: true,
        paymentAmount: 12000
      });

      await Message.create({
        threadId: testThread._id,
        sender: clientUser._id,
        senderRole: 'Client',
        content: 'Client upload',
        attachments: [clientDoc._id]
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}/shared`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const documents = res.body.data.documents;
      expect(documents.find((doc) => doc._id === testDocument._id.toString())).toBeDefined();
      expect(documents.find((doc) => doc._id === clientDoc._id.toString())).toBeUndefined();

      const shared = documents.find((doc) => doc._id === testDocument._id.toString());
      expect(shared.messagePaymentStatus).toBe('pending');
      expect(shared.messagePaymentRequired).toBe(true);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should get single document (CA-Admin)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document._id).toBe(testDocument._id.toString());
      expect(res.body.data.canDownload).toBe(true);
    });

    it('should get single document (Client)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document._id).toBe(testDocument._id.toString());
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/client/:clientId/category/:category', () => {
    it('should get documents by category', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/category/GST_Filings`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category).toBe('GST_Filings');
      expect(res.body.data.documents).toBeInstanceOf(Array);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should update document metadata (CA-Admin)', async () => {
      const res = await request(app)
        .put(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          description: 'Updated description',
          tags: ['tag1', 'tag2'],
          financialYear: '2023-24'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document.description).toBe('Updated description');
    });

    it('should not allow client to update document', async () => {
      const res = await request(app)
        .put(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          description: 'Unauthorized update'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/documents/set-payment-requirement', () => {
    it('should set payment requirement for documents (CA-Admin)', async () => {
      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          documentIds: [testDocument._id],
          requiresPayment: true,
          paymentAmount: 50000, // ₹500
          paymentDescription: 'Document access fee'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresPayment).toBe(true);
      expect(res.body.data.paymentAmount).toBe(50000);
    });

    it('should not allow client to set payment requirement', async () => {
      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          documentIds: [testDocument._id],
          requiresPayment: true,
          paymentAmount: 50000
        });

      expect(res.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          documentIds: [testDocument._id],
          requiresPayment: true
          // Missing paymentAmount
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/documents/client/:clientId/locked', () => {
    it('should get locked documents for client', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/locked`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeInstanceOf(Array);
      expect(res.body.data.totalPaymentRequired).toBeDefined();
    });
  });

  describe('GET /api/documents/client/:clientId/paid', () => {
    it('should get paid documents for client', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/paid`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/documents/:id/access', () => {
    it('should check document access (CA-Admin always has access)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocument._id}/access`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access.hasAccess).toBe(true);
    });

    it('should check document access (Client with payment required)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocument._id}/access`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access).toBeDefined();
    });
  });

  describe('GET /api/documents/search', () => {
    it('should search documents (CA-Admin)', async () => {
      const res = await request(app)
        .get('/api/documents/search?query=test')
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeInstanceOf(Array);
    });

    it('should not allow client to search across all documents', async () => {
      const res = await request(app)
        .get('/api/documents/search?query=test')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should soft delete document (CA-Admin)', async () => {
      const docToDelete = await Document.create({
        fileName: 'delete-test.pdf',
        originalName: 'delete-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        cloudinaryPublicId: 'delete-test-id',
        cloudinaryUrl: 'https://test.cloudinary.com/delete.pdf',
        cloudinaryFolder: 'test-folder',
        category: 'GST_Filings',
        clientId: client._id,
        firmId: firm._id,
        uploadedBy: caAdminUser._id
      });

      const res = await request(app)
        .delete(`/api/documents/${docToDelete._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft delete
      const deletedDoc = await Document.findById(docToDelete._id);
      expect(deletedDoc.isDeleted).toBe(true);
    });

    it('should not allow client to delete document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
    });
  });
});

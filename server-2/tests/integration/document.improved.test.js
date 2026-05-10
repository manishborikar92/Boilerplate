const request = require('supertest');
const app = require('../../src/app');
const Document = require('../../src/models/Document');
const {
  createTestCAAdmin,
  createTestClient,
  createTestDocument,
  cleanupTestData
} = require('../helpers/testSetup');

describe('Document Routes - Production Grade', () => {
  let caAdminUser, firm, caAdminToken;
  let client, clientUser, clientToken;

  // Setup fresh data before each test
  beforeEach(async () => {
    await cleanupTestData();
    
    // Create CA Admin with firm
    const adminSetup = await createTestCAAdmin();
    caAdminUser = adminSetup.caAdminUser;
    firm = adminSetup.firm;
    caAdminToken = adminSetup.caAdminToken;

    // Create Client
    const clientSetup = await createTestClient(firm._id);
    client = clientSetup.client;
    clientUser = clientSetup.clientUser;
    clientToken = clientSetup.clientToken;
  });

  // Cleanup after each test
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('GET /api/documents/categories', () => {
    it('should get all document categories', async () => {
      const res = await request(app)
        .get('/api/documents/categories')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeDefined();
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/documents/categories')
        .expect(401);
    });
  });

  describe('GET /api/documents/client/:clientId', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id
      );
    });

    it('should get all documents for a client (CA-Admin)', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeDefined();
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].fileName).toBe('test.pdf');
    });

    it('should get own documents (Client)', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toBeDefined();
      expect(res.body.data.documents.length).toBe(1);
    });

    it('should not allow client to access other client documents', async () => {
      // Create another client
      const { client: otherClient, clientToken: otherToken } = await createTestClient(firm._id, {
        email: `other-${Date.now()}@test.com`
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should support pagination', async () => {
      // Create multiple documents
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        cloudinaryPublicId: `test-${Date.now()}-2`
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}?page=1&limit=1`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(2);
    });

    it('should support category filter', async () => {
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        category: 'Income_Tax',
        cloudinaryPublicId: `test-${Date.now()}-income`
      });

      const res = await request(app)
        .get(`/api/documents/client/${client._id}?category=Income_Tax`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].category).toBe('Income_Tax');
    });
  });

  describe('GET /api/documents/:id', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id
      );
    });

    it('should get single document (CA-Admin)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.document.fileName).toBe('test.pdf');
    });

    it('should get single document (Client)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.document.fileName).toBe('test.pdf');
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const res = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/documents/client/:clientId/category/:category', () => {
    beforeEach(async () => {
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        category: 'GST_Filings'
      });
    });

    it('should get documents by category', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/category/GST_Filings`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].category).toBe('GST_Filings');
    });
  });

  describe('PUT /api/documents/:id', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id
      );
    });

    it('should update document metadata (CA-Admin)', async () => {
      const updateData = {
        description: 'Updated description',
        tags: ['important', 'urgent']
      };

      const res = await request(app)
        .put(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.document.description).toBe('Updated description');
      expect(res.body.data.document.tags).toEqual(['important', 'urgent']);
    });

    it('should not allow client to update document', async () => {
      const res = await request(app)
        .put(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ description: 'Hacked' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/documents/set-payment-requirement', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id
      );
    });

    it('should set payment requirement for documents (CA-Admin)', async () => {
      const paymentData = {
        documentIds: [testDoc._id.toString()],
        requiresPayment: true,
        paymentAmount: 50000,
        paymentDescription: 'Premium document access'
      };

      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(paymentData)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify document was updated
      const updatedDoc = await Document.findById(testDoc._id);
      expect(updatedDoc.requiresPayment).toBe(true);
      expect(updatedDoc.paymentAmount).toBe(50000);
    });

    it('should not allow client to set payment requirement', async () => {
      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          documentIds: [testDoc._id.toString()],
          requiresPayment: true,
          paymentAmount: 50000
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .put('/api/documents/set-payment-requirement')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          documentIds: [testDoc._id.toString()],
          requiresPayment: true
          // Missing paymentAmount
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/documents/client/:clientId/locked', () => {
    beforeEach(async () => {
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        requiresPayment: true,
        paymentAmount: 50000,
        isPaid: false
      });
    });

    it('should get locked documents for client', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/locked`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].requiresPayment).toBe(true);
    });
  });

  describe('GET /api/documents/client/:clientId/paid', () => {
    beforeEach(async () => {
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        requiresPayment: true,
        paymentAmount: 50000,
        isPaid: true,
        paidAt: new Date()
      });
    });

    it('should get paid documents for client', async () => {
      const res = await request(app)
        .get(`/api/documents/client/${client._id}/paid`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].isPaid).toBe(true);
    });
  });

  describe('GET /api/documents/:id/access', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id,
        {
          requiresPayment: true,
          paymentAmount: 50000,
          isPaid: false
        }
      );
    });

    it('should check document access (CA-Admin always has access)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc._id}/access`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAccess).toBe(true);
    });

    it('should check document access (Client with payment required)', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc._id}/access`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hasAccess).toBe(false);
      expect(res.body.data.requiresPayment).toBe(true);
    });
  });

  describe('GET /api/documents/search', () => {
    beforeEach(async () => {
      await createTestDocument(client._id, firm._id, caAdminUser._id, {
        fileName: 'important-document.pdf',
        description: 'This is a test document'
      });
    });

    it('should search documents (CA-Admin)', async () => {
      const res = await request(app)
        .get('/api/documents/search?query=important')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.documents.length).toBeGreaterThan(0);
    });

    it('should not allow client to search across all documents', async () => {
      const res = await request(app)
        .get('/api/documents/search?query=test')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await createTestDocument(
        client._id,
        firm._id,
        caAdminUser._id
      );
    });

    it('should soft delete document (CA-Admin)', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify soft delete
      const deletedDoc = await Document.findById(testDoc._id);
      expect(deletedDoc.isDeleted).toBe(true);
      expect(deletedDoc.deletedAt).toBeDefined();
    });

    it('should not allow client to delete document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDoc._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});

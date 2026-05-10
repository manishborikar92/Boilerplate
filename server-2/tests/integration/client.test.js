const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Firm = require('../../src/models/Firm');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('Client API Integration Tests', () => {
  let caAdminToken;
  let caAdminUser;
  let clientToken;
  let clientUser;
  let firm;

  beforeEach(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Firm.deleteMany({});

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

    // Create Client user
    clientUser = await User.create({
      email: 'client@example.com',
      password: 'password123',
      name: 'Client User',
      role: 'Client',
      isActive: true,
      firmId: firm._id
    });
    clientToken = generateAccessToken(clientUser._id, clientUser.role);
  });

  describe('POST /api/clients', () => {
    it('should add a new client successfully', async () => {
      const clientData = {
        companyName: 'ABC Pvt Ltd',
        email: 'abc@company.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: {
          street: '123 Business Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001'
        }
      };

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(clientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.companyName).toBe(clientData.companyName);
      expect(response.body.data.client.email).toBe(clientData.email);
      expect(response.body.data.client.userId).toMatch(/^CA-CLT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      expect(response.body.data.client.credentials).toBeDefined();
      expect(response.body.data.client.credentials.userId).toBeDefined();
      expect(response.body.data.client.credentials.password).toBeDefined();
      expect(response.body.data.client.accountCreated).toBe(true);
    });

    it('should fail without required fields', async () => {
      const clientData = {
        companyName: 'ABC Pvt Ltd'
        // Missing email, phoneNumber, companyType
      };

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const clientData = {
        companyName: 'ABC Pvt Ltd',
        email: 'duplicate@company.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.'
      };

      // Create first client
      await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(clientData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(clientData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should fail if not CA-Admin', async () => {
      const clientData = {
        companyName: 'ABC Pvt Ltd',
        email: 'abc@company.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.'
      };

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(clientData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const clientData = {
        companyName: 'ABC Pvt Ltd',
        email: 'abc@company.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.'
      };

      await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(401);
    });
  });

  describe('GET /api/clients', () => {
    beforeEach(async () => {
      // Create test clients
      await Client.create([
        {
          companyName: 'Client 1',
          email: 'client1@test.com',
          phoneNumber: '+91-1111111111',
          companyType: 'Pvt. Ltd.',
          userId: 'CA-CLT-001',
          generatedPassword: 'password123',
          firmId: firm._id,
          createdBy: caAdminUser._id
        },
        {
          companyName: 'Client 2',
          email: 'client2@test.com',
          phoneNumber: '+91-2222222222',
          companyType: 'Partnership',
          userId: 'CA-CLT-002',
          generatedPassword: 'password123',
          firmId: firm._id,
          createdBy: caAdminUser._id
        }
      ]);
    });

    it('should get all clients for the firm', async () => {
      const response = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clients).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter clients by company type', async () => {
      const response = await request(app)
        .get('/api/clients?companyType=Pvt. Ltd.')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clients).toHaveLength(1);
      expect(response.body.data.clients[0].companyType).toBe('Pvt. Ltd.');
    });

    it('should search clients by name or email', async () => {
      const response = await request(app)
        .get('/api/clients?search=Client 1')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clients).toHaveLength(1);
      expect(response.body.data.clients[0].companyName).toBe('Client 1');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/clients?page=1&limit=1')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clients).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should fail if not authenticated', async () => {
      await request(app)
        .get('/api/clients')
        .expect(401);
    });
  });

  describe('GET /api/clients/:id', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await Client.create({
        companyName: 'Test Client',
        email: 'test@client.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.',
        userId: 'CA-CLT-001',
        generatedPassword: 'password123',
        firmId: firm._id,
        createdBy: caAdminUser._id
      });
    });

    it('should get single client by ID', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.companyName).toBe('Test Client');
      expect(response.body.data.client.email).toBe('test@client.com');
    });

    it('should fail with invalid client ID', async () => {
      const invalidId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/clients/${invalidId}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail if client belongs to different firm', async () => {
      // Create another firm and client
      const otherAdmin = await User.create({
        email: 'other@admin.com',
        password: 'password123',
        name: 'Other Admin',
        role: 'CA-Admin',
        isEmailVerified: true
      });

      const otherFirm = await Firm.create({
        firmName: 'Other Firm',
        registrationNumber: 'REG654321',
        pan: 'FGHIJ5678K',
        officialEmail: 'other@firm.com',
        contactNumber: '+91-9999999999',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Other Firm',
          accountNumber: '1234567891',
          ifscCode: 'ABCD0123456'
        },
        adminId: otherAdmin._id
      });

      const otherClient = await Client.create({
        companyName: 'Other Client',
        email: 'other@client.com',
        phoneNumber: '+91-8888888888',
        companyType: 'LLP',
        userId: 'CA-CLT-999',
        generatedPassword: 'password123',
        firmId: otherFirm._id,
        createdBy: otherAdmin._id
      });

      const response = await request(app)
        .get(`/api/clients/${otherClient._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/clients/:id', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await Client.create({
        companyName: 'Original Name',
        email: 'original@client.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.',
        userId: 'CA-CLT-001',
        generatedPassword: 'password123',
        firmId: firm._id,
        createdBy: caAdminUser._id
      });
    });

    it('should update client successfully', async () => {
      const updateData = {
        companyName: 'Updated Name',
        phoneNumber: '+91-9999999999',
        gstin: '29ABCDE1234F1Z5'
      };

      const response = await request(app)
        .put(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.companyName).toBe('Updated Name');
      expect(response.body.data.client.phoneNumber).toBe('+91-9999999999');
      expect(response.body.data.client.gstin).toBe('29ABCDE1234F1Z5');
    });

    it('should fail if not CA-Admin', async () => {
      const updateData = {
        companyName: 'Hacked Name'
      };

      const response = await request(app)
        .put(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      // Create another client
      await Client.create({
        companyName: 'Another Client',
        email: 'another@client.com',
        phoneNumber: '+91-8888888888',
        companyType: 'LLP',
        userId: 'CA-CLT-002',
        generatedPassword: 'password123',
        firmId: firm._id,
        createdBy: caAdminUser._id
      });

      const updateData = {
        email: 'another@client.com'
      };

      const response = await request(app)
        .put(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('DELETE /api/clients/:id', () => {
    let testClient;

    beforeEach(async () => {
      testClient = await Client.create({
        companyName: 'Test Client',
        email: 'test@client.com',
        phoneNumber: '+91-9876543210',
        companyType: 'Pvt. Ltd.',
        userId: 'CA-CLT-001',
        generatedPassword: 'password123',
        firmId: firm._id,
        createdBy: caAdminUser._id,
        isActive: true
      });
    });

    it('should soft delete client', async () => {
      const response = await request(app)
        .delete(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      const deletedClient = await Client.findById(testClient._id);
      expect(deletedClient.isDeleted).toBe(true);
    });

    it('should fail if not CA-Admin', async () => {
      const response = await request(app)
        .delete(`/api/clients/${testClient._id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid client ID', async () => {
      const invalidId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .delete(`/api/clients/${invalidId}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

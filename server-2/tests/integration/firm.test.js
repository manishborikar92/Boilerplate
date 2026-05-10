const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('Firm API Integration Tests', () => {
  let caAdminToken;
  let caAdminUser;
  let clientToken;
  let clientUser;

  beforeEach(async () => {
    await User.deleteMany({});
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
    caAdminToken = generateAccessToken(caAdminUser._id, caAdminUser.role);

    // Create Client user
    clientUser = await User.create({
      email: 'client@example.com',
      password: 'password123',
      name: 'Client User',
      role: 'Client',
      isActive: true,
      isEmailVerified: true
    });
    clientToken = generateAccessToken(clientUser._id, clientUser.role);
  });

  describe('POST /api/firms/complete-profile', () => {
    it('should complete CA Admin profile successfully', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001'
        },
        websiteUrl: 'https://abcca.com',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Holder',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        },
        professionalTitle: 'Managing Partner',
        phoneNumber: '+91-9876543210',
        primaryServices: ['Audit & Assurance', 'Taxation & GST'],
        customServices: ['Financial Planning'],
        whatsappNotification: true
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.firmName).toBe(profileData.firmName);
      expect(response.body.data.firm.gstin).toBe(profileData.gstin);
      expect(response.body.data.user.professionalTitle).toBe(profileData.professionalTitle);
      expect(response.body.data.user.profileCompleted).toBe(true);
    });

    it('should complete profile even without email verification', async () => {
      // Create a new CA Admin user without email verification
      const unverifiedAdmin = await User.create({
        email: 'unverified@caflow.com',
        password: 'password123',
        name: 'Unverified Admin',
        role: 'CA-Admin',
        isActive: true,
        isEmailVerified: false // Email not verified
      });
      const unverifiedToken = generateAccessToken(unverifiedAdmin._id, unverifiedAdmin.role);

      const profileData = {
        firmName: 'Unverified CA Firm',
        officialEmail: 'contact@unverified.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG789012',
        pan: 'UVWXY1234Z',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Unverified Firm',
          accountNumber: '9876543210',
          ifscCode: 'TEST0987654'
        },
        professionalTitle: 'Partner',
        phoneNumber: '+91-9876543210'
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send(profileData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.firmName).toBe(profileData.firmName);
      expect(response.body.data.user.profileCompleted).toBe(true);
    });

    it('should fail without required fields', async () => {
      const profileData = {
        firmName: 'ABC CA'
        // Missing officialEmail and contactNumber
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without registration number', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        pan: 'ABCDE1234F',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Holder',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without PAN', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Holder',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without bank name', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        bankDetails: {
          accountHolderName: 'Test Holder',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without account holder name', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        bankDetails: {
          bankName: 'Test Bank',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without account number', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Holder',
          ifscCode: 'TEST0123456'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without IFSC code', async () => {
      const profileData = {
        firmName: 'ABC Chartered Accountants',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Holder',
          accountNumber: '1234567890'
        }
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });


    it('should fail if not CA-Admin', async () => {
      const profileData = {
        firmName: 'ABC CA',
        officialEmail: 'contact@abc.com',
        contactNumber: '+91-9876543210'
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(profileData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail if profile already completed', async () => {
      // Create firm first
      const firm = await Firm.create({
        firmName: 'Existing Firm',
        registrationNumber: 'REG999999',
        pan: 'AAAAA9999A',
        officialEmail: 'existing@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Existing Firm',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        },
        adminId: caAdminUser._id
      });

      const profileData = {
        firmName: 'New Firm',
        officialEmail: 'new@firm.com',
        contactNumber: '+91-9876543210'
      };

      const response = await request(app)
        .post('/api/firms/complete-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(profileData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should fail without authentication', async () => {
      const profileData = {
        firmName: 'ABC CA',
        officialEmail: 'contact@abc.com',
        contactNumber: '+91-9876543210'
      };

      await request(app)
        .post('/api/firms/complete-profile')
        .send(profileData)
        .expect(401);
    });
  });

  describe('GET /api/firms/my-firm', () => {
    it('should get current user firm', async () => {
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'test@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        },
        adminId: caAdminUser._id
      });

      caAdminUser.firmId = firm._id;
      await caAdminUser.save();

      const response = await request(app)
        .get('/api/firms/my-firm')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.firmName).toBe('Test Firm');
    });

    it('should fail if no firm associated', async () => {
      const response = await request(app)
        .get('/api/firms/my-firm')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should allow client to fetch their associated firm', async () => {
      const firm = await Firm.create({
        firmName: 'Client Linked Firm',
        registrationNumber: 'REG999111',
        pan: 'QWERT1234Y',
        officialEmail: 'clientlinked@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Client Linked Firm',
          accountNumber: '1234567892',
          ifscCode: 'TEST0123499'
        },
        adminId: caAdminUser._id
      });

      caAdminUser.firmId = firm._id;
      clientUser.firmId = firm._id;
      await Promise.all([caAdminUser.save(), clientUser.save()]);

      const response = await request(app)
        .get('/api/firms/my-firm')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.firmName).toBe('Client Linked Firm');
    });
  });

  describe('PUT /api/firms/:id', () => {
    it('should update firm successfully', async () => {
      const firm = await Firm.create({
        firmName: 'Original Name',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'original@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Original Name',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        },
        adminId: caAdminUser._id
      });

      const updateData = {
        firmName: 'Updated Name',
        websiteUrl: 'https://updated.com'
      };

      const response = await request(app)
        .put(`/api/firms/${firm._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.firmName).toBe('Updated Name');
      expect(response.body.data.firm.websiteUrl).toBe('https://updated.com');
    });

    it('should fail if not firm owner', async () => {
      const otherAdmin = await User.create({
        email: 'other@admin.com',
        password: 'password123',
        name: 'Other Admin',
        role: 'CA-Admin',
        isActive: true
      });

      const firm = await Firm.create({
        firmName: 'Other Firm',
        registrationNumber: 'REG654321',
        pan: 'FGHIJ5678K',
        officialEmail: 'other@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Other Firm',
          accountNumber: '1234567891',
          ifscCode: 'ABCD0123456'
        },
        adminId: otherAdmin._id
      });

      const updateData = {
        firmName: 'Hacked Name'
      };

      const response = await request(app)
        .put(`/api/firms/${firm._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/firms/update-profile', () => {
    it('should update admin profile', async () => {
      const updateData = {
        professionalTitle: 'Senior Partner',
        phoneNumber: '+91-9999999999'
      };

      const response = await request(app)
        .put('/api/firms/update-profile')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.professionalTitle).toBe('Senior Partner');
      expect(response.body.data.user.phoneNumber).toBe('+91-9999999999');
    });

    it('should fail if not CA-Admin', async () => {
      const updateData = {
        professionalTitle: 'Partner'
      };

      const response = await request(app)
        .put('/api/firms/update-profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/firms/:id', () => {
    it('should soft delete firm', async () => {
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'test@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '1234567890',
          ifscCode: 'TEST0123456'
        },
        adminId: caAdminUser._id,
        isActive: true
      });

      const response = await request(app)
        .delete(`/api/firms/${firm._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      const deletedFirm = await Firm.findById(firm._id);
      expect(deletedFirm.isDeleted).toBe(true);
    });

    it('should fail if not firm owner', async () => {
      const otherAdmin = await User.create({
        email: 'other@admin.com',
        password: 'password123',
        name: 'Other Admin',
        role: 'CA-Admin',
        isActive: true
      });

      const firm = await Firm.create({
        firmName: 'Other Firm',
        registrationNumber: 'REG654321',
        pan: 'FGHIJ5678K',
        officialEmail: 'other@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Other Firm',
          accountNumber: '1234567891',
          ifscCode: 'ABCD0123456'
        },
        adminId: otherAdmin._id
      });

      const response = await request(app)
        .delete(`/api/firms/${firm._id}`)
        .set('Authorization', `Bearer ${caAdminToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});

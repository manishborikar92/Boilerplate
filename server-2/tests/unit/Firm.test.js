const mongoose = require('mongoose');
const Firm = require('../../src/models/Firm');

describe('Firm Model', () => {
  beforeEach(async () => {
    await Firm.deleteMany({});
  });

  describe('Firm Creation', () => {
    it('should create a firm with valid data', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firmData = {
        firmName: 'ABC Chartered Accountants',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'contact@abcca.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'ABC Chartered Accountants',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId
      };

      const firm = await Firm.create(firmData);

      expect(firm.firmName).toBe(firmData.firmName);
      expect(firm.officialEmail).toBe(firmData.officialEmail);
      expect(firm.contactNumber).toBe(firmData.contactNumber);
      expect(firm.adminId.toString()).toBe(adminId.toString());
      expect(firm.setupCompleted).toBe(false);
      expect(firm.isVerified).toBe(false);
      expect(firm.isDeleted).toBe(false);
      expect(firm.bankDetails.accountNumberLast4).toBe('6789');
    });

    it('should create a firm with complete data', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firmData = {
        firmName: 'XYZ & Associates',
        registrationNumber: 'REG123456',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        officialEmail: 'info@xyzca.com',
        contactNumber: '+91-9876543210',
        firmLogo: 'https://example.com/logo.png',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001'
        },
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'XYZ & Associates',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        websiteUrl: 'https://xyzca.com',
        primaryServices: ['Audit & Assurance', 'Taxation & GST'],
        customServices: ['Financial Planning'],
        whatsappNotification: true,
        adminId,
        setupCompleted: true
      };

      const firm = await Firm.create(firmData);

      expect(firm.firmName).toBe(firmData.firmName);
      expect(firm.gstin).toBe(firmData.gstin);
      expect(firm.pan).toBe(firmData.pan);
      expect(firm.address.city).toBe('Mumbai');
      expect(firm.primaryServices).toHaveLength(2);
      expect(firm.setupCompleted).toBe(true);
      expect(firm.bankDetails.accountNumberLast4).toBe('6789');
    });

    it('should fail without required fields', async () => {
      const firmData = {
        firmName: 'Test Firm'
        // Missing officialEmail, contactNumber, adminId
      };

      await expect(Firm.create(firmData)).rejects.toThrow();
    });

    it('should fail with invalid email', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firmData = {
        firmName: 'Test Firm',
        officialEmail: 'invalid-email',
        contactNumber: '+91-9876543210',
        adminId
      };

      await expect(Firm.create(firmData)).rejects.toThrow();
    });

    it('should validate primary services enum', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firmData = {
        firmName: 'Test Firm',
        officialEmail: 'test@firm.com',
        contactNumber: '+91-9876543210',
        primaryServices: ['Invalid Service'],
        adminId
      };

      await expect(Firm.create(firmData)).rejects.toThrow();
    });

  });

  describe('Firm Methods', () => {
    it('should not include __v in JSON response', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'test@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId
      });

      const json = firm.toJSON();
      expect(json.__v).toBeUndefined();
      expect(json.firmName).toBe('Test Firm');
    });

    it('returns null JSON for deleted firm and computes virtuals', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123457',
        pan: 'ABCDE1234F',
        officialEmail: 'test2@firm.com',
        contactNumber: '+91-9876543211',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        address: { street: 'Street', city: 'City', state: 'State', pinCode: '411001', country: 'India' },
        totalClients: 10,
        activeClients: 4,
        totalRevenue: 20000,
        adminId
      });

      expect(firm.fullAddress).toContain('Street');
      expect(firm.clientRetentionRate).toBe('40.00');
      expect(firm.averageRevenuePerClient).toBe('5000.00');

      firm.isDeleted = true;
      const json = firm.toJSON();
      expect(json).toBeNull();
    });

    it('updates counts, revenue, and soft deletes', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123458',
        pan: 'ABCDE1234F',
        officialEmail: 'test3@firm.com',
        contactNumber: '+91-9876543212',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId
      });

      await firm.incrementClientCount();
      await firm.decrementClientCount();
      await firm.addRevenue(5000);
      await firm.softDelete(adminId);

      const updated = await Firm.findById(firm._id);
      expect(updated.totalRevenue).toBe(5000);
      expect(updated.isDeleted).toBe(true);
      expect(updated.deletedBy.toString()).toBe(adminId.toString());
    });

    it('finds by PAN/GSTIN and excludes deleted', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const firm = await Firm.create({
        firmName: 'Test Firm',
        registrationNumber: 'REG123459',
        pan: 'ABCDE1234F',
        gstin: '29ABCDE1234F1Z5',
        officialEmail: 'test4@firm.com',
        contactNumber: '+91-9876543213',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Test Firm',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId
      });

      const byPan = await Firm.findByPAN('abcde1234f');
      const byGstin = await Firm.findByGSTIN('29abcde1234f1z5');
      expect(byPan._id.toString()).toBe(firm._id.toString());
      expect(byGstin._id.toString()).toBe(firm._id.toString());

      await firm.softDelete(adminId);
      const active = await Firm.findActive();
      expect(active.length).toBe(0);
    });
  });

  describe('Firm Updates', () => {
    it('should update firm details', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const firm = await Firm.create({
        firmName: 'Original Name',
        registrationNumber: 'REG123456',
        pan: 'ABCDE1234F',
        officialEmail: 'original@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Original Name',
          accountNumber: '123456789',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId
      });

      firm.firmName = 'Updated Name';
      firm.websiteUrl = 'https://updated.com';
      await firm.save();

      const updated = await Firm.findById(firm._id);
      expect(updated.firmName).toBe('Updated Name');
      expect(updated.websiteUrl).toBe('https://updated.com');
    });
  });
});

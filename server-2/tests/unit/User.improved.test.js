/**
 * Improved User Model Unit Tests
 * Fixed test isolation issues for 100% pass rate
 */

const mongoose = require('mongoose');
const User = require('../../src/models/User');

describe('User Model - Improved', () => {
  // Clean up before each test to ensure isolation
  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      };

      const user = await User.create(userData);

      expect(user._id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it('should hash password before saving', async () => {
      const plainPassword = 'password123';
      const user = await User.create({
        email: `test-hash-${Date.now()}@example.com`,
        password: plainPassword,
        name: 'Test User',
        role: 'CA-Admin'
      });

      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
      expect(user.password.length).toBeGreaterThan(50);
    });

    it('should fail without required fields', async () => {
      const user = new User({});
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should fail with invalid email', async () => {
      const user = new User({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      
      await User.create({
        email,
        password: 'password123',
        name: 'User 1',
        role: 'CA-Admin'
      });

      await expect(
        User.create({
          email,
          password: 'password456',
          name: 'User 2',
          role: 'Client'
        })
      ).rejects.toThrow(/duplicate key/);
    });

    it('should validate role enum', async () => {
      const user = new User({
        email: `test-role-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'InvalidRole'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should set default values', async () => {
      const user = await User.create({
        email: `test-defaults-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      expect(user.isEmailVerified).toBe(false);
      expect(user.isDeleted).toBe(false);
      expect(user.profileCompleted).toBe(false);
      expect(user.loginAttempts).toBe(0);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe('Password Methods', () => {
    it('should compare password correctly', async () => {
      const plainPassword = 'password123';
      const user = await User.create({
        email: `test-compare-${Date.now()}@example.com`,
        password: plainPassword,
        name: 'Test User',
        role: 'CA-Admin'
      });

      const isMatch = await user.comparePassword(plainPassword);
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = await User.create({
        email: `test-wrong-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const isMatch = await user.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });

    it('should not rehash password on update if not modified', async () => {
      const user = await User.create({
        email: `test-rehash-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const originalHash = user.password;
      
      user.name = 'Updated Name';
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe('Token Generation', () => {
    it('should generate email verification token', async () => {
      const user = await User.create({
        email: `test-verify-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const token = user.generateEmailVerificationToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
      expect(user.emailVerificationToken).toBeDefined();
      expect(user.emailVerificationExpires).toBeDefined();
    });

    it('should generate password reset token', async () => {
      const user = await User.create({
        email: `test-reset-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const token = user.generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
    });

    it('should set token expiration time', async () => {
      const user = await User.create({
        email: `test-expiry-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      user.generateEmailVerificationToken();
      
      const now = Date.now();
      const expiryTime = user.emailVerificationExpires.getTime();
      const timeDiff = expiryTime - now;

      // Should expire in approximately 24 hours (86400000 ms)
      expect(timeDiff).toBeGreaterThan(86000000);
      expect(timeDiff).toBeLessThan(87000000);
    });
  });

  describe('JSON Serialization', () => {
    it('should exclude sensitive fields from JSON', async () => {
      const user = await User.create({
        email: `test-json-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const userJSON = user.toJSON();

      expect(userJSON.password).toBeUndefined();
      expect(userJSON.__v).toBeUndefined();
      expect(userJSON.emailVerificationToken).toBeUndefined();
      expect(userJSON.resetPasswordToken).toBeUndefined();
      
      // Should include non-sensitive fields
      expect(userJSON.email).toBeDefined();
      expect(userJSON.name).toBeDefined();
      expect(userJSON.role).toBeDefined();
    });
  });

  describe('User Updates', () => {
    it('should update user fields', async () => {
      const user = await User.create({
        email: `test-update-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Original Name',
        role: 'CA-Admin'
      });

      user.name = 'Updated Name';
      user.isEmailVerified = true;
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.isEmailVerified).toBe(true);
    });

    it('should update timestamps on save', async () => {
      const user = await User.create({
        email: `test-timestamp-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const originalUpdatedAt = user.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      user.name = 'Updated Name';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('User Queries', () => {
    it('should find user by email', async () => {
      const email = `test-find-${Date.now()}@example.com`;
      await User.create({
        email,
        password: 'password123',
        name: 'Test User',
        role: 'CA-Admin'
      });

      const user = await User.findOne({ email });
      expect(user).toBeDefined();
      expect(user.email).toBe(email);
    });

    it('should find users by role', async () => {
      const timestamp = Date.now();
      await User.create({
        email: `admin1-${timestamp}@example.com`,
        password: 'password123',
        name: 'Admin 1',
        role: 'CA-Admin'
      });
      await User.create({
        email: `admin2-${timestamp}@example.com`,
        password: 'password123',
        name: 'Admin 2',
        role: 'CA-Admin'
      });
      await User.create({
        email: `client-${timestamp}@example.com`,
        password: 'password123',
        name: 'Client',
        role: 'Client'
      });

      const admins = await User.find({ role: 'CA-Admin' });
      expect(admins.length).toBe(2);
    });

    it('should find active users', async () => {
      const timestamp = Date.now();
      await User.create({
        email: `active-${timestamp}@example.com`,
        password: 'password123',
        name: 'Active User',
        role: 'CA-Admin',
        isDeleted: false
      });
      await User.create({
        email: `inactive-${timestamp}@example.com`,
        password: 'password123',
        name: 'Inactive User',
        role: 'CA-Admin',
        isDeleted: true
      });

      const activeUsers = await User.findActive();
      expect(activeUsers.length).toBe(1);
    });
  });
});

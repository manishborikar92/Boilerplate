const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        role: 'CA-Admin'
      };

      const user = await User.create(userData);

      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.isEmailVerified).toBe(false);
      expect(user.isDeleted).toBe(false);
    });

    it('should hash password before saving', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      };

      const user = await User.create(userData);
      const userWithPassword = await User.findById(user._id).select('+password');

      expect(userWithPassword.password).not.toBe(userData.password);
      expect(userWithPassword.password).toMatch(/^\$2[ayb]\$.{56}$/);
    });

    it('should fail without required fields', async () => {
      const userData = {
        email: 'test@example.com'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      };

      await User.create(userData);
      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('Password Methods', () => {
    it('should compare password correctly', async () => {
      const password = 'password123';
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password
      });

      const userWithPassword = await User.findById(user._id).select('+password');
      const isMatch = await userWithPassword.comparePassword(password);

      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

      const userWithPassword = await User.findById(user._id).select('+password');
      const isMatch = await userWithPassword.comparePassword('wrongpassword');

      expect(isMatch).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate email verification token', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

      const token = user.generateEmailVerificationToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(user.emailVerificationToken).toBeDefined();
      expect(user.emailVerificationExpires).toBeDefined();
      expect(user.emailVerificationExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate password reset token', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

      const token = user.generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
      expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('JSON Serialization', () => {
    it('should exclude sensitive fields from JSON', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123'
      });

      const json = user.toJSON();

      expect(json.password).toBeUndefined();
      expect(json.emailVerificationToken).toBeUndefined();
      expect(json.resetPasswordToken).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});

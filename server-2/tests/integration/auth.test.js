const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');

// Test password that meets complexity requirements
const TEST_PASSWORD = 'Test@123'; // 8+ chars, uppercase, lowercase, number, special char
const NEW_TEST_PASSWORD = 'NewTest@456';

describe('Auth Integration Tests', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: TEST_PASSWORD,
        name: 'New User'
        // role is automatically set to CA-Admin
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe('CA-Admin');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: TEST_PASSWORD,
        name: 'User One'
      };

      await User.create(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: TEST_PASSWORD,
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with short password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with password missing uppercase', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'test@123',  // No uppercase
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with password missing special character', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123',  // No special char
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        email: 'login@example.com',
        password: TEST_PASSWORD,
        name: 'Login User',
        role: 'CA-Admin'
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: TEST_PASSWORD
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('login@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Wrong@123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_PASSWORD
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail with locked user', async () => {
      await User.create({
        email: 'locked@example.com',
        password: TEST_PASSWORD,
        name: 'Locked User',
        role: 'CA-Admin',
        lockUntil: new Date(Date.now() + 60_000)
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@example.com',
          password: TEST_PASSWORD
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('locked');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await User.create({
        email: 'refresh@example.com',
        password: TEST_PASSWORD,
        name: 'Refresh User'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh@example.com',
          password: TEST_PASSWORD
        });

      const { refreshToken } = loginResponse.body.data;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      // Verify refresh token rotation
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user with valid token', async () => {
      const user = await User.create({
        email: 'me@example.com',
        password: TEST_PASSWORD,
        name: 'Me User'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'me@example.com',
          password: TEST_PASSWORD
        });

      const { accessToken } = loginResponse.body.data;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('me@example.com');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      await User.create({
        email: 'change@example.com',
        password: TEST_PASSWORD,
        name: 'Change User',
        isEmailVerified: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'change@example.com',
          password: TEST_PASSWORD
        });

      const { accessToken } = loginResponse.body.data;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: NEW_TEST_PASSWORD
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'change@example.com',
          password: NEW_TEST_PASSWORD
        })
        .expect(200);

      expect(newLoginResponse.body.success).toBe(true);
    });

    it('should fail with incorrect current password', async () => {
      await User.create({
        email: 'wrongpass@example.com',
        password: TEST_PASSWORD,
        name: 'Wrong Pass User',
        isEmailVerified: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: TEST_PASSWORD
        });

      const { accessToken } = loginResponse.body.data;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Wrong@123',
          newPassword: NEW_TEST_PASSWORD
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/auth/delete-account', () => {
    it('should delete account and firm data', async () => {
      const user = await User.create({
        email: 'delete@example.com',
        password: TEST_PASSWORD,
        name: 'Delete User',
        role: 'CA-Admin',
        isEmailVerified: true
      });

      const firm = await Firm.create({
        firmName: 'Delete Firm',
        registrationNumber: 'REG-DELETE-1',
        pan: 'ABCDE1234F',
        officialEmail: 'delete@firm.com',
        contactNumber: '+91-9876543210',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Delete Firm',
          accountNumber: '1234567890',
          ifscCode: 'ABCD0123456',
          accountType: 'Current'
        },
        adminId: user._id
      });

      user.firmId = firm._id;
      await user.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'delete@example.com',
          password: TEST_PASSWORD
        });

      const { accessToken } = loginResponse.body.data;

      const start = Date.now();
      const response = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Date.now() - start).toBeLessThan(5000);

      const deletedUser = await User.findById(user._id);
      const deletedFirm = await Firm.findById(firm._id);

      expect(deletedUser.isDeleted).toBe(true);
      expect(deletedFirm.isDeleted).toBe(true);
    });

    it('should fail without password', async () => {
      const user = await User.create({
        email: 'delete-nopass@example.com',
        password: TEST_PASSWORD,
        name: 'Delete NoPass User',
        role: 'CA-Admin',
        isEmailVerified: true
      });

      const firm = await Firm.create({
        firmName: 'Delete Firm 2',
        registrationNumber: 'REG-DELETE-2',
        pan: 'ABCDE1234G',
        officialEmail: 'delete2@firm.com',
        contactNumber: '+91-9876543211',
        bankDetails: {
          bankName: 'Test Bank',
          accountHolderName: 'Delete Firm 2',
          accountNumber: '1234567891',
          ifscCode: 'ABCD0123457',
          accountType: 'Current'
        },
        adminId: user._id
      });

      user.firmId = firm._id;
      await user.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'delete-nopass@example.com',
          password: TEST_PASSWORD
        });

      const { accessToken } = loginResponse.body.data;

      const response = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

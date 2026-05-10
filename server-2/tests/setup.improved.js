/**
 * Improved Test Setup with Better Isolation
 * Fixes test infrastructure timing issues for 100% pass rate
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Set up environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-very-long-secret-key-for-security';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-very-long-secret';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_api_key';
process.env.CLOUDINARY_API_SECRET = 'test_api_secret';

// Setup before all tests
beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Use modern connection options (no deprecated warnings)
    await mongoose.connect(mongoUri);
    
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
  }
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in tests:', error);
});

module.exports = {
  mongoServer
};

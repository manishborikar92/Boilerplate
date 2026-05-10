/**
 * Razorpay Configuration
 * Handles initialization and configuration of Razorpay service
 */
const Razorpay = require('razorpay');
const { logger } = require('../middleware/logger');

/**
 * Initialize Razorpay instance
 */
const initializeRazorpay = () => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      logger.warn('Razorpay credentials not configured. Payment features will be disabled.');
      return null;
    }

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    logger.info('Razorpay initialized successfully');
    return razorpayInstance;
  } catch (error) {
    logger.error('Failed to initialize Razorpay', { error: error.message });
    throw error;
  }
};

const razorpay = initializeRazorpay();

module.exports = {
  razorpay,
  initializeRazorpay
};

/**
 * Cloudinary Configuration
 * Handles initialization and configuration of Cloudinary service
 */
const cloudinary = require('cloudinary').v2;
const { logger } = require('../middleware/logger');

/**
 * Initialize Cloudinary with environment variables
 */
const initializeCloudinary = () => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      logger.warn('Cloudinary credentials not configured. File upload features will be disabled.');
      return false;
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    logger.info('Cloudinary initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Cloudinary', { error: error.message });
    throw error;
  }
};

module.exports = {
  cloudinary,
  initializeCloudinary
};

/**
 * Email Utility - Updated to use the new CA-Flow Email Service
 * 
 * This file maintains backward compatibility while using the enhanced
 * email service with better templates and error handling.
 */

const emailService = require('../services/emailService');

/**
 * Send email verification
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} verificationUrl - Verification URL (token will be extracted)
 * @returns {Promise} Email sending result
 */
const sendVerificationEmail = async (email, name, verificationUrl) => {
  try {
    // Extract token from URL for the new service
    const token = verificationUrl.split('/').pop();
    return await emailService.sendVerificationEmail(email, name, token);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} resetUrl - Reset URL (token will be extracted)
 * @returns {Promise} Email sending result
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
  try {
    // Extract token from URL for the new service
    const token = resetUrl.split('/').pop();
    return await emailService.sendPasswordResetEmail(email, name, token);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send welcome email (new functionality)
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} userRole - User role
 * @returns {Promise} Email sending result
 */
const sendWelcomeEmail = async (email, name, userRole = 'Client') => {
  try {
    return await emailService.sendWelcomeEmail(email, name, userRole);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send welcome email');
  }
};

/**
 * Send task notification email (new functionality)
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} taskTitle - Task title
 * @param {string} taskStatus - Task status
 * @param {string} message - Additional message
 * @returns {Promise} Email sending result
 */
const sendTaskNotificationEmail = async (email, name, taskTitle, taskStatus, message = '') => {
  try {
    return await emailService.sendTaskNotificationEmail(email, name, taskTitle, taskStatus, message);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send task notification email');
  }
};

/**
 * Send document request email (new functionality)
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} taskTitle - Task title
 * @param {Array} requiredDocuments - List of required documents
 * @returns {Promise} Email sending result
 */
const sendDocumentRequestEmail = async (email, name, taskTitle, requiredDocuments = []) => {
  try {
    return await emailService.sendDocumentRequestEmail(email, name, taskTitle, requiredDocuments);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send document request email');
  }
};

/**
 * Send email with attachment (new functionality)
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @param {string} attachmentPath - Path to attachment
 * @param {string} attachmentName - Attachment filename
 * @returns {Promise} Email sending result
 */
const sendEmailWithAttachment = async (email, name, subject, message, attachmentPath, attachmentName) => {
  try {
    return await emailService.sendEmailWithAttachment(email, name, subject, message, attachmentPath, attachmentName);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email with attachment');
  }
};

/**
 * Test email configuration
 * @param {string} testEmail - Test recipient email
 * @returns {Promise} Test result
 */
const testEmailConfiguration = async (testEmail = 'test@example.com') => {
  try {
    return await emailService.testConfiguration(testEmail);
  } catch (error) {
    console.error('Email test error:', error);
    throw new Error('Failed to test email configuration');
  }
};

module.exports = {
  // Existing functions (backward compatibility)
  sendVerificationEmail,
  sendPasswordResetEmail,
  
  // New functions
  sendWelcomeEmail,
  sendTaskNotificationEmail,
  sendDocumentRequestEmail,
  sendEmailWithAttachment,
  testEmailConfiguration
};
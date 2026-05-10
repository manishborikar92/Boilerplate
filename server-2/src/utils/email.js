/**
 * Email Utility
 * 
 * Wrapper around the email service.
 */

const emailService = require('../services/emailService');

/**
 * Send email verification
 */
const sendVerificationEmail = async (email, name, verificationUrl) => {
    try {
        const token = verificationUrl.split('/').pop();
        return await emailService.sendVerificationEmail(email, name, token);
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send verification email');
    }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
    try {
        const token = resetUrl.split('/').pop();
        return await emailService.sendPasswordResetEmail(email, name, token);
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send password reset email');
    }
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, name) => {
    try {
        return await emailService.sendWelcomeEmail(email, name);
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send welcome email');
    }
};

/**
 * Test email configuration
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
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    testEmailConfiguration
};

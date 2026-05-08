import * as smsProvider from './sms-provider.service.js';
import userRepository from '../repositories/user.repository.js';
import notificationEvents from './notification-events.service.js';
import { BadRequestError, ConflictError } from '../utils/api-error.js';
import logger, { maskPhoneNumber } from '../utils/logger.js';

/**
 * Phone Update Service
 *
 * Handles phone number updates with OTP verification.
 * Ensures phone numbers are verified before being updated.
 */

/**
 * Normalize phone number to E.164 format (+91XXXXXXXXXX)
 */
const normalizePhoneNumber = (phoneNumber) => {
    const value = String(phoneNumber ?? '').trim();
    if (!value) return value;

    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 10) return `+91${digitsOnly}`;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return `+${digitsOnly}`;
    if (value.startsWith('+')) return value;

    return value;
};

/**
 * Send OTP to new phone number for verification
 * @param {string} userId - Current user ID
 * @param {string} newMobile - New 10-digit mobile number (without country code)
 * @returns {Promise<{ message: string }>}
 */
export const sendPhoneUpdateOtp = async (userId, newMobile) => {
    // Normalize the new phone number
    const normalizedPhone = normalizePhoneNumber(newMobile);

    // Check if phone is already in use by another user
    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new ConflictError('Phone number already registered to another account');
    }

    // Check if user is trying to update to their current phone
    const currentUser = await userRepository.findById(userId);
    if (currentUser.phoneNumber === normalizedPhone) {
        throw new BadRequestError('New phone number is the same as current phone number');
    }

    // Send OTP via MSG91
    const result = await smsProvider.sendOtp(newMobile);
    if (!result.success) {
        throw new BadRequestError('Failed to send OTP. Please try again.');
    }

    logger.info('Phone update OTP sent', {
        userId,
        newPhone: maskPhoneNumber(normalizedPhone),
        requestId: result.requestId,
    });

    return { message: 'OTP sent successfully to new phone number' };
};

/**
 * Verify OTP and update phone number atomically
 * @param {string} userId - Current user ID
 * @param {string} newMobile - New 10-digit mobile number
 * @param {string} otp - User-entered OTP
 * @returns {Promise<{ phoneNumber: string, message: string }>}
 */
export const verifyAndUpdatePhone = async (userId, newMobile, otp) => {
    // Normalize the new phone number
    const normalizedPhone = normalizePhoneNumber(newMobile);

    // Verify OTP with MSG91
    const verificationResult = await smsProvider.verifyOtp(newMobile, otp);
    if (!verificationResult.success) {
        throw new BadRequestError(verificationResult.message || 'Invalid or expired OTP');
    }

    // Double-check phone availability (race condition protection)
    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new ConflictError('Phone number already registered to another account');
    }

    // Update phone number atomically
    const updatedUser = await userRepository.updateById(userId, {
        phoneNumber: normalizedPhone,
    });

    if (!updatedUser) {
        throw new BadRequestError('Failed to update phone number');
    }

    logger.info('Phone number updated successfully', {
        userId,
        newPhone: maskPhoneNumber(normalizedPhone),
    });
    await notificationEvents.notifyAccountUpdated({
        userId,
        updateType: 'phone',
    });

    return {
        phoneNumber: updatedUser.phoneNumber,
        message: 'Phone number updated successfully',
    };
};

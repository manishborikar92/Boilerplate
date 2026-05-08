import userRepository from '../repositories/user.repository.js';
import notificationEvents from './notification-events.service.js';
import { BadRequestError, ConflictError } from '../utils/api-error.js';
import logger, { maskPhoneNumber } from '../utils/logger.js';

/**
 * Email Update Service
 *
 * Handles email updates for all user types (customers, barbers, admins).
 * Email is stored with emailVerified: false until verification is implemented.
 */

/**
 * Normalize email to lowercase and trim
 */
const normalizeEmail = (email) => {
    const value = String(email ?? '').trim().toLowerCase();
    return value;
};

/**
 * Update user email
 * @param {string} userId - Current user ID
 * @param {string} newEmail - New email address
 * @returns {Promise<{ email: string, emailVerified: boolean, message: string }>}
 */
export const updateEmail = async (userId, newEmail) => {
    // Normalize the new email
    const normalizedEmail = normalizeEmail(newEmail);

    if (!normalizedEmail) {
        throw new BadRequestError('Email is required');
    }

    // Get current user
    const currentUser = await userRepository.findById(userId);
    if (!currentUser) {
        throw new BadRequestError('User not found');
    }

    // Check if email is same as current
    if (currentUser.email === normalizedEmail) {
        throw new BadRequestError('New email is the same as current email');
    }

    // Check if email is already in use by another user
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new ConflictError('Email already registered to another account');
    }

    // Update email atomically with emailVerified: false
    const updatedUser = await userRepository.updateById(userId, {
        email: normalizedEmail,
        emailVerified: false,
    });

    if (!updatedUser) {
        throw new BadRequestError('Failed to update email');
    }

    logger.info('Email updated successfully', {
        userId,
        newEmail: normalizedEmail,
        phoneNumber: maskPhoneNumber(currentUser.phoneNumber),
    });
    await notificationEvents.notifyAccountUpdated({
        userId,
        updateType: 'email',
    });

    return {
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
        message: 'Email updated successfully. Verification pending.',
    };
};

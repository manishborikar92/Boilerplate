import customerRepository from '../repositories/customer.repository.js';
import userRepository from '../repositories/user.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import cloudinary from '../config/cloudinary.config.js';
import notificationEvents from './notification-events.service.js';
import { serializeCustomerProfile } from '../serializers/customer.serializer.js';

/**
 * Customer-facing profile service.
 */

export const getProfile = async (userId) => {
    const profile = await customerRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Customer');
    return serializeCustomerProfile(profile);
};

export const updateProfile = async (userId, data, file) => {
    const profile = await customerRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('Customer');

    if (data.location && typeof data.location === 'string') {
        try {
            data.location = JSON.parse(data.location);
        } catch {
            throw new BadRequestError('Invalid location format');
        }
    }

    // Remove email from update data - email updates must go through /account/email
    if (data.email !== undefined) {
        delete data.email;
    }

    const nextPhotoCloudinaryId = file ? (file.filename || file.public_id) : null;
    if (file) {
        data.photoUrl = file.path;
        data.cloudinaryId = nextPhotoCloudinaryId;
    }

    let updated;
    let profileUpdated = false;
    try {
        updated = await customerRepository.updateByUserId(userId, data);
        profileUpdated = true;
    } catch (err) {
        if (nextPhotoCloudinaryId && !profileUpdated) {
            try {
                await cloudinary.uploader.destroy(nextPhotoCloudinaryId);
            } catch {
                // Non-fatal; preserve the original error
            }
        }
        throw err;
    }

    if (nextPhotoCloudinaryId && profile.cloudinaryId && profile.cloudinaryId !== nextPhotoCloudinaryId) {
        try {
            await cloudinary.uploader.destroy(profile.cloudinaryId);
        } catch {
            // Non-fatal; the new photo is already persisted
        }
    }

    await notificationEvents.notifyAccountUpdated({
        userId,
        updateType: 'customer_profile',
    });

    return serializeCustomerProfile(updated);
};

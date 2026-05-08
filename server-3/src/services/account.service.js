import cloudinary from '../config/cloudinary.config.js';
import logger from '../utils/logger.js';
import { BadRequestError, NotFoundError } from '../utils/api-error.js';
import { verifyPin } from './pin.service.js';
import { revokeRefreshToken } from './auth.service.js';
import shopRepository from '../repositories/shop.repository.js';
import userRepository from '../repositories/user.repository.js';

export const updateBarberProfilePicture = async (ownerId, file) => {
    if (!file) throw new BadRequestError('No profile picture uploaded');

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const ownerPhotoUrl = file.path;
    const ownerPhotoCloudinaryId = file.public_id || file.filename;

    let updated;
    try {
        updated = await shopRepository.updateByOwnerId(ownerId, {
            ownerPhotoUrl,
            ownerPhotoCloudinaryId,
        });
    } catch (err) {
        if (ownerPhotoCloudinaryId) {
            try {
                await cloudinary.uploader.destroy(ownerPhotoCloudinaryId);
            } catch (cleanupError) {
                logger.warn('Failed to cleanup newly uploaded barber profile picture', {
                    ownerId,
                    error: cleanupError.message,
                });
            }
        }
        throw err;
    }

    if (shop.ownerPhotoCloudinaryId && shop.ownerPhotoCloudinaryId !== ownerPhotoCloudinaryId) {
        try {
            await cloudinary.uploader.destroy(shop.ownerPhotoCloudinaryId);
        } catch (err) {
            logger.warn('Failed to delete previous barber profile picture', {
                ownerId,
                error: err.message,
            });
        }
    }

    return {
        photoUrl: updated.ownerPhotoUrl,
        profilePhotoUrl: updated.ownerPhotoUrl,
        ownerPhotoUrl: updated.ownerPhotoUrl,
    };
};

export const signOutEverywhere = async (userId) => {
    await revokeRefreshToken(userId);

    return {
        revokedAt: new Date().toISOString(),
    };
};

export const deleteBarberAccount = async (authUser, currentPin) => {
    const shop = await shopRepository.findByOwnerId(authUser._id);
    if (!shop) throw new NotFoundError('Shop profile');

    const isPinValid = await verifyPin(shop.pinHash, currentPin);
    if (!isPinValid) throw new BadRequestError('Current PIN is incorrect');

    const deletedAt = new Date();
    let shopSoftDeleted = false;

    try {
        await shopRepository.updateByOwnerId(authUser._id, { deletedAt, isOpen: false });
        shopSoftDeleted = true;

        // Revoke refresh access before the soft delete so the token hash can still be updated.
        await revokeRefreshToken(authUser._id);
        await userRepository.softDelete(authUser._id);
    } catch (err) {
        if (shopSoftDeleted) {
            try {
                await shopRepository.updateById(shop._id, { deletedAt: null, isOpen: shop.isOpen });
            } catch (rollbackError) {
                logger.error('Failed to rollback shop soft delete', {
                    shopId: shop._id,
                    error: rollbackError.message,
                });
            }
        }
        throw err;
    }

    return {
        deleted: true,
        authCleanup: 'revoked',
    };
};

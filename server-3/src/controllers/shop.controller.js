import shopRepository from '../repositories/shop.repository.js';
import * as accountService from '../services/account.service.js';
import * as bookingService from '../services/booking.service.js';
import * as photoService from '../services/photo.service.js';
import * as pinService from '../services/pin.service.js';
import * as shopService from '../services/shop.service.js';
import { BadRequestError, NotFoundError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const getMyShop = async (req, res, next) => {
    try {
        const shop = await shopService.getShopByOwner(req.user._id, req.user);
        return res.status(200).json(ApiResponse.success(shop, 'Shop profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateMyShop = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const result = await shopService.updateBusinessInfo(req.user._id, body, req.user);
        return res.status(200).json(ApiResponse.success(result, 'Business info updated'));
    } catch (err) {
        next(err);
    }
};

export const getPayoutDetails = async (req, res, next) => {
    try {
        const details = await shopService.getPayoutDetails(req.user._id);
        return res.status(200).json(ApiResponse.success(details, 'Payout details fetched'));
    } catch (err) {
        next(err);
    }
};

export const updatePayoutDetails = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const details = await shopService.updatePayoutDetails(req.user._id, body);
        return res.status(200).json(ApiResponse.success(details, 'Payout details updated successfully'));
    } catch (err) {
        next(err);
    }
};

export const updateMyPin = async (req, res, next) => {
    try {
        const { currentPin, newPin, confirmNewPin } = getValidatedRequestData(req, 'body');

        const validation = pinService.validatePinUpdate({ currentPin, newPin, confirmNewPin });
        if (!validation.isValid) throw new BadRequestError(validation.message);

        const shop = await shopRepository.findByOwnerId(req.user._id);
        if (!shop) throw new NotFoundError('Shop profile');

        const isValid = await pinService.verifyPin(shop.pinHash, currentPin);
        if (!isValid) throw new BadRequestError('Current PIN is incorrect');

        const newHash = await pinService.hashPin(newPin);
        await shopRepository.updateByOwnerId(req.user._id, { pinHash: newHash });

        return res.status(200).json(ApiResponse.success(null, 'PIN updated successfully'));
    } catch (err) {
        next(err);
    }
};

export const updateMyCover = async (req, res, next) => {
    try {
        const result = await photoService.updateShopCover(req.user._id, req.file);
        return res.status(200).json(ApiResponse.success(result, 'Cover image updated'));
    } catch (err) {
        next(err);
    }
};

export const updateMyPicture = async (req, res, next) => {
    try {
        const result = await accountService.updateBarberProfilePicture(req.user._id, req.file);
        return res.status(200).json(ApiResponse.success(result, 'Profile picture updated'));
    } catch (err) {
        next(err);
    }
};

export const getShopById = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await shopService.getShopInfoForCustomer(params.id);
        return res.status(200).json(ApiResponse.success(result, 'Shop info fetched'));
    } catch (err) {
        next(err);
    }
};

export const getShopEmployees = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const employees = await shopService.getEmployeesByShopId(params.id);
        return res.status(200).json(ApiResponse.success({ employees }, 'Employees fetched'));
    } catch (err) {
        next(err);
    }
};

export const getFavoriteShops = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await shopService.getFavoriteShops(req.user._id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Favorite shops fetched'));
    } catch (err) {
        next(err);
    }
};

export const setFavoriteShop = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const { favorite } = getValidatedRequestData(req, 'body');
        const result = favorite
            ? await shopService.addFavoriteShop(req.user._id, id)
            : await shopService.removeFavoriteShop(req.user._id, id);
        return res.status(200).json(ApiResponse.success(result, 'Shop favorite updated'));
    } catch (err) {
        next(err);
    }
};

export const getShops = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const shops = await shopService.getShops(query);
        return res.status(200).json(ApiResponse.success(shops, 'Shops fetched'));
    } catch (err) {
        next(err);
    }
};

export const getNearbyServices = async (req, res, next) => {
    try {
        const { longitude, latitude, gender, search } = getValidatedRequestData(req, 'query');
        const result = await shopService.getNearbyServicesByGender(
            [Number(longitude), Number(latitude)],
            gender || 'unisex',
            search,
        );
        return res.status(200).json(ApiResponse.success(result, 'Services fetched'));
    } catch (err) {
        next(err);
    }
};

export const getShopAvailability = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const query = getValidatedRequestData(req, 'query');
        const result = await bookingService.getShopAvailability(params.id, query.date, query.serviceId);
        return res.status(200).json(ApiResponse.success(result, 'Shop availability fetched'));
    } catch (err) {
        next(err);
    }
};

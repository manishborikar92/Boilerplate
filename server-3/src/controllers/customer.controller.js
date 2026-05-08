import * as userService from '../services/user.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const getMe = async (req, res, next) => {
    try {
        const profile = await userService.getProfile(req.user._id);
        return res.status(200).json(ApiResponse.success(profile, 'Profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const updated = await userService.updateProfile(req.user._id, body, req.file);
        return res.status(200).json(ApiResponse.success(updated, 'Profile updated'));
    } catch (err) {
        next(err);
    }
};

import * as photoService from '../services/photo.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const uploadPhotos = async (req, res, next) => {
    try {
        const { photoType, description } = getValidatedRequestData(req, 'body');
        const photos = await photoService.uploadPhotos(req.user._id, req.files, photoType, description);
        return res.status(201).json(ApiResponse.success(photos, `${photos.length} photo(s) uploaded`));
    } catch (err) {
        next(err);
    }
};

export const getPhotos = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await photoService.getPhotos(req.user._id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Photos fetched'));
    } catch (err) {
        next(err);
    }
};

export const getPhotoById = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const photo = await photoService.getPhotoById(req.user._id, params.id);
        return res.status(200).json(ApiResponse.success(photo, 'Photo fetched'));
    } catch (err) {
        next(err);
    }
};

export const deletePhoto = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await photoService.deletePhoto(req.user._id, params.id);
        return res.status(200).json(ApiResponse.success(result, 'Photo deleted'));
    } catch (err) {
        next(err);
    }
};

export const getPhotoStats = async (req, res, next) => {
    try {
        const stats = await photoService.getPhotoStats(req.user._id);
        return res.status(200).json(ApiResponse.success(stats, 'Photo stats'));
    } catch (err) {
        next(err);
    }
};

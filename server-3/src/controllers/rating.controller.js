import * as ratingService from '../services/rating.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const addRating = async (req, res, next) => {
    try {
        const { shopId, rating, review } = getValidatedRequestData(req, 'body');
        const result = await ratingService.addRating(req.user._id, shopId, rating, review);
        return res.status(201).json(ApiResponse.success(result, 'Rating submitted'));
    } catch (err) {
        next(err);
    }
};

export const getShopRatings = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const query = getValidatedRequestData(req, 'query');
        const result = await ratingService.getRatingsByShop(params.id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Ratings fetched'));
    } catch (err) {
        next(err);
    }
};

export const getShopRatingSummary = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const summary = await ratingService.getRatingSummary(params.id);
        return res.status(200).json(ApiResponse.success(summary, 'Rating summary'));
    } catch (err) {
        next(err);
    }
};

export const getOwnedRatings = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await ratingService.getRatingsByShopForBarber(req.user._id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Ratings fetched'));
    } catch (err) {
        next(err);
    }
};

export const getOwnedRatingSummary = async (req, res, next) => {
    try {
        const summary = await ratingService.getRatingSummaryForBarber(req.user._id);
        return res.status(200).json(ApiResponse.success(summary, 'Rating summary'));
    } catch (err) {
        next(err);
    }
};

export const updateReply = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const { replyText } = getValidatedRequestData(req, 'body');
        const result = await ratingService.upsertReplyToRating(params.id, replyText, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Reply saved successfully'));
    } catch (err) {
        next(err);
    }
};

export const deleteReply = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await ratingService.deleteReplyFromRating(params.id, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Reply deleted successfully'));
    } catch (err) {
        next(err);
    }
};

export const deleteRating = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await ratingService.removeRating(params.id, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Rating removed'));
    } catch (err) {
        next(err);
    }
};

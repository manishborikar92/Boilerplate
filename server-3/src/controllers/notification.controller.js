import notificationService from '../services/notification.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const registerFcmToken = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const token = await notificationService.registerFcmToken(req.user._id, body);
        return res.status(200).json(ApiResponse.success(token, 'FCM token registered'));
    } catch (err) {
        next(err);
    }
};

export const unregisterFcmToken = async (req, res, next) => {
    try {
        const { token } = getValidatedRequestData(req, 'body');
        const result = await notificationService.unregisterFcmToken(req.user._id, token);
        return res.status(200).json(ApiResponse.success(result, 'FCM token unregistered'));
    } catch (err) {
        next(err);
    }
};

export const listNotifications = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await notificationService.listNotifications(req.user._id, query);
        return res.status(200).json(
            ApiResponse.paginated(result.items, result.pagination, 'Notifications fetched'),
        );
    } catch (err) {
        next(err);
    }
};

export const getNotificationSummary = async (req, res, next) => {
    try {
        const result = await notificationService.getNotificationSummary(req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Notification summary fetched'));
    } catch (err) {
        next(err);
    }
};

export const patchNotification = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const result = await notificationService.patchNotification(req.user._id, id);
        return res.status(200).json(ApiResponse.success(result, 'Notification updated'));
    } catch (err) {
        next(err);
    }
};

export const patchNotifications = async (req, res, next) => {
    try {
        const result = await notificationService.patchNotifications(req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Notifications updated'));
    } catch (err) {
        next(err);
    }
};

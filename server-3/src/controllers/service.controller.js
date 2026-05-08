import * as serviceCatalogService from '../services/service-catalog.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const addService = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const service = await serviceCatalogService.addService(req.user._id, body);
        return res.status(201).json(ApiResponse.success(service, 'Service added'));
    } catch (err) {
        next(err);
    }
};

export const getServices = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await serviceCatalogService.getServices(req.user._id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Services fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateService = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const body = getValidatedRequestData(req, 'body');
        const service = await serviceCatalogService.updateService(req.user._id, params.id, body);
        return res.status(200).json(ApiResponse.success(service, 'Service updated'));
    } catch (err) {
        next(err);
    }
};

export const deleteService = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await serviceCatalogService.deleteService(req.user._id, params.id);
        return res.status(200).json(ApiResponse.success(result, 'Service deleted'));
    } catch (err) {
        next(err);
    }
};

export const searchServices = async (req, res, next) => {
    try {
        const { query: q, gender } = getValidatedRequestData(req, 'query');
        const results = await serviceCatalogService.searchServices(q, gender);
        return res.status(200).json(ApiResponse.success(results, 'Search results'));
    } catch (err) {
        next(err);
    }
};

import * as bookingService from '../services/booking.service.js';
import * as employeeService from '../services/employee.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

export const addEmployee = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const employee = await employeeService.addEmployee(req.user._id, body, req.file);
        return res.status(201).json(ApiResponse.success(employee, 'Employee added'));
    } catch (err) {
        next(err);
    }
};

export const getEmployees = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const result = await employeeService.getEmployees(req.user._id, query);
        return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Employees fetched'));
    } catch (err) {
        next(err);
    }
};

export const getEmployeeById = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await employeeService.getEmployeeById(req.user._id, params.id);
        return res.status(200).json(ApiResponse.success(result, 'Employee details fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateEmployee = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const body = getValidatedRequestData(req, 'body');
        const employee = await employeeService.updateEmployee(req.user._id, params.id, body, req.file);
        return res.status(200).json(ApiResponse.success(employee, 'Employee updated'));
    } catch (err) {
        next(err);
    }
};

export const updateEmployeeAvailability = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const body = getValidatedRequestData(req, 'body');
        const result = await employeeService.updateEmployeeAvailability(req.user._id, params.id, body);
        const message = body.available
            ? 'Employee marked available'
            : 'Employee marked unavailable. Customers have been notified.';
        return res.status(200).json(ApiResponse.success(result, message));
    } catch (err) {
        next(err);
    }
};

export const deleteEmployee = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await employeeService.deleteEmployee(req.user._id, params.id);
        return res.status(200).json(ApiResponse.success(result, 'Employee deleted'));
    } catch (err) {
        next(err);
    }
};

export const getEmployeeAvailability = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const query = getValidatedRequestData(req, 'query');
        const result = await bookingService.getAvailableSlots(params.id, query.date, query.serviceId);
        return res.status(200).json(ApiResponse.success(result, 'Employee availability fetched'));
    } catch (err) {
        next(err);
    }
};

export const getStaffAvailability = async (req, res, next) => {
    try {
        const staff = await employeeService.getStaffAvailability(req.user._id);
        return res.status(200).json(ApiResponse.success(staff, 'Staff availability fetched'));
    } catch (err) {
        next(err);
    }
};

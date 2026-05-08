import * as bookingService from '../services/booking.service.js';
import { ForbiddenError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { ROLES } from '../utils/constants.js';
import { getValidatedRequestData } from '../utils/request-validation.utils.js';

const assertSupportedBookingRole = (roleType) => {
    if (![ROLES.CUSTOMER, ROLES.BARBER].includes(roleType)) {
        throw new ForbiddenError('This endpoint is available only to customers and barbers');
    }
};

// ============================================================================
// Customer: Booking Management
// ============================================================================

export const createBooking = async (req, res, next) => {
    try {
        const body = getValidatedRequestData(req, 'body');
        const result = await bookingService.createBooking(req.user._id, body);
        return res.status(201).json(ApiResponse.success(result, 'Booking created'));
    } catch (err) {
        next(err);
    }
};

export const getBookings = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        assertSupportedBookingRole(req.user.roleType);

        if (req.user.roleType === ROLES.CUSTOMER) {
            // Customers cannot use barber-only filters
            if (query.employeeId) {
                throw new ForbiddenError('Employee filters are only available for barbers');
            }
            
            const result = await bookingService.getCustomerBookings(req.user._id, query);
            return res.status(200).json(ApiResponse.paginated(result.items, result.pagination, 'Bookings fetched'));
        }

        // Barbers cannot use customer-only filters
        if (query.favorite) {
            throw new ForbiddenError('Favorite filters are only available for customers');
        }
        
        const result = await bookingService.getBookingsByShop(req.user._id, query);
        return res.status(200).json(
            ApiResponse.paginated(
                result.items,
                result.pagination,
                'Bookings fetched',
                {
                    numberOfEmployees: result.numberOfEmployees,
                    numberOfCustomers: result.numberOfCustomers,
                },
            ),
        );
    } catch (err) {
        next(err);
    }
};

export const getBookingById = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const result = await bookingService.getBookingDetailsForUser(params.id, req.user);
        return res.status(200).json(ApiResponse.success(result, 'Booking details fetched'));
    } catch (err) {
        next(err);
    }
};

export const patchBooking = async (req, res, next) => {
    try {
        const params = getValidatedRequestData(req, 'params');
        const body = getValidatedRequestData(req, 'body');

        if (body.status) {
            const result = await bookingService.updateBookingStatus(params.id, req.user, body.status);
            return res.status(200).json(ApiResponse.success(result, 'Booking status updated'));
        }

        const result = await bookingService.updateBookingSchedule(params.id, req.user._id, body);
        return res.status(200).json(ApiResponse.success(result, 'Booking updated'));
    } catch (err) {
        next(err);
    }
};

export const setFavoriteBooking = async (req, res, next) => {
    try {
        const { id } = getValidatedRequestData(req, 'params');
        const { favorite } = getValidatedRequestData(req, 'body');
        const result = favorite
            ? await bookingService.addFavoriteBooking(req.user._id, id)
            : await bookingService.removeFavoriteBooking(req.user._id, id);
        return res.status(200).json(ApiResponse.success(result, 'Booking favorite updated'));
    } catch (err) {
        next(err);
    }
};

export const getBookingAnalytics = async (req, res, next) => {
    try {
        const query = getValidatedRequestData(req, 'query');
        const analytics = await bookingService.getBookingAnalytics(req.user._id, query);
        return res.status(200).json(ApiResponse.success(analytics, 'Booking analytics fetched'));
    } catch (err) {
        next(err);
    }
};

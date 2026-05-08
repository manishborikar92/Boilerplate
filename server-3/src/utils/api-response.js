/**
 * Standardized API response helpers.
 *
 * Usage in controllers:
 *   res.status(200).json(ApiResponse.success(data, 'User fetched'));
 *   res.status(400).json(ApiResponse.error('Validation failed', { errors }));
 */

import { sanitizeForResponse } from '../serializers/core.serializer.js';

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const isMessageOnlyPayload = (value) => (
    isPlainObject(value)
    && Object.keys(value).length === 1
    && typeof value.message === 'string'
);

const normalizeData = (value) => (value === null || value === undefined ? {} : sanitizeForResponse(value));

const normalizeMeta = (value) => {
    const sanitized = sanitizeForResponse(value || {});
    return sanitized && Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export class ApiResponse {
    /**
     * Success envelope.
     * @param {*} data
     * @param {string} message
     */
    static success(data = {}, message = 'Success') {
        const normalizedMessage = isMessageOnlyPayload(data) && message === 'Success'
            ? data.message
            : message;

        const response = {
            success: true,
            message: normalizedMessage,
            data: isMessageOnlyPayload(data) ? {} : normalizeData(data),
        };

        return response;
    }

    /**
     * Error envelope.
     * @param {string} message
     * @param {*} data
     */
    static error(message = 'Error', data = {}) {
        return {
            success: false,
            message,
            data: normalizeData(data),
        };
    }

    /**
     * Paginated success envelope.
     * @param {Array} items
     * @param {Object} pagination
     * @param {string} message
     */
    static paginated(items, pagination, message = 'Success', extraData = {}) {
        const meta = normalizeMeta({
            pagination,
            ...extraData,
        });

        return {
            success: true,
            message,
            data: normalizeData(Array.isArray(items) ? items : []),
            ...(meta ? { meta } : {}),
        };
    }
}

import assert from 'node:assert/strict';
import test from 'node:test';

import mongoose from 'mongoose';
import { ApiResponse } from '../api-response.js';

const collectKeys = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object') return [];
    if (seen.has(value)) return [];
    seen.add(value);

    const ownKeys = Object.keys(value);
    return [
        ...ownKeys,
        ...ownKeys.flatMap((key) => collectKeys(value[key], seen)),
    ];
};

test('success response strips internal Mongoose metadata from nested payloads', () => {
    const schema = new mongoose.Schema({
        firstName: String,
        pinHash: String,
        cloudinaryId: String,
        refreshTokenHash: String,
    });
    const Model = mongoose.models.ApiResponseSanitizerTest
        || mongoose.model('ApiResponseSanitizerTest', schema);
    const document = new Model({
        firstName: 'Jane',
        pinHash: 'secret-pin',
        cloudinaryId: 'cloudinary-secret',
        refreshTokenHash: 'refresh-secret',
    });

    const response = ApiResponse.success({
        customer: { ...document },
        populated: document,
        list: [{ parent: document, $__: { activePaths: true }, _doc: { unsafe: true }, $isNew: false }],
    });
    const keys = collectKeys(response);

    for (const forbiddenKey of ['$__', '_doc', '$isNew', '__v', 'parent', 'populated', 'pinHash', 'cloudinaryId', 'refreshTokenHash']) {
        assert.equal(
            keys.includes(forbiddenKey),
            false,
            `${forbiddenKey} should not be present anywhere in the response`,
        );
    }
});

test('paginated response returns list data and pagination metadata separately', () => {
    const response = ApiResponse.paginated(
        [{ _id: 'booking-1', status: 'pending' }],
        {
            currentPage: 1,
            totalPages: 1,
            totalDocuments: 1,
            hasNextPage: false,
            hasPrevPage: false,
        },
        'Bookings fetched',
        { counts: { customers: 1 } },
    );

    assert.deepEqual(response, {
        success: true,
        message: 'Bookings fetched',
        data: [
            {
                id: 'booking-1',
                status: 'pending',
            },
        ],
        meta: {
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalDocuments: 1,
                hasNextPage: false,
                hasPrevPage: false,
            },
            counts: {
                customers: 1,
            },
        },
    });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    notificationIdParamSchema,
    notificationListQuerySchema,
    registerFcmTokenSchema,
    unregisterFcmTokenSchema,
} from '../notification.validator.js';

test('registerFcmTokenSchema accepts a production mobile token registration payload', () => {
    const { error, value } = registerFcmTokenSchema.validate({
        token: 'fcm-token-a',
        platform: 'android',
        deviceId: 'pixel-8',
        appVersion: '2.4.1',
        locale: 'en-IN',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        token: 'fcm-token-a',
        platform: 'android',
        deviceId: 'pixel-8',
        appVersion: '2.4.1',
        locale: 'en-IN',
    });
});

test('registerFcmTokenSchema rejects unsupported platforms', () => {
    const { error } = registerFcmTokenSchema.validate({
        token: 'fcm-token-a',
        platform: 'desktop',
    });

    assert.match(error?.message || '', /must be one of/);
});

test('unregisterFcmTokenSchema requires the token owned by the caller', () => {
    const { error, value } = unregisterFcmTokenSchema.validate({
        token: 'fcm-token-a',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, { token: 'fcm-token-a' });
});

test('notificationListQuerySchema normalizes filters and pagination defaults', () => {
    const { error, value } = notificationListQuerySchema.validate({
        read: 'false',
        type: 'hybrid',
        eventType: 'booking.confirmed',
    });

    assert.equal(error, undefined);
    assert.deepEqual(value, {
        page: 1,
        limit: 20,
        read: false,
        type: 'hybrid',
        eventType: 'booking.confirmed',
    });
});

test('notificationIdParamSchema validates MongoDB ids', () => {
    const { error } = notificationIdParamSchema.validate({
        id: '507f1f77bcf86cd799439011',
    });

    assert.equal(error, undefined);
});

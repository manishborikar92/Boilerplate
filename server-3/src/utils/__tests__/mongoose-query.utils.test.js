import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import { trustQueryOperators } from '../mongoose-query.utils.js';

test('sanitizeFilter wraps untrusted operator objects', () => {
    const filter = {
        serviceFor: { $regex: /male/i },
    };

    mongoose.sanitizeFilter(filter);

    assert.deepEqual(Object.keys(filter.serviceFor), ['$eq']);
    assert.equal(filter.serviceFor.$eq.$regex.source, 'male');
});

test('trustQueryOperators preserves trusted operator objects during sanitizeFilter', () => {
    const filter = trustQueryOperators({
        serviceFor: { $regex: /male/i },
        employeeId: { $in: ['employee-1', 'employee-2'] },
    });

    mongoose.sanitizeFilter(filter);

    assert.equal(filter.serviceFor.$regex.source, 'male');
    assert.deepEqual(filter.employeeId.$in, ['employee-1', 'employee-2']);
});

test('trustQueryOperators preserves ObjectId values', () => {
    const shopId = new mongoose.Types.ObjectId();
    const filter = trustQueryOperators({ shopId });

    mongoose.sanitizeFilter(filter);

    assert.equal(filter.shopId, shopId);
});

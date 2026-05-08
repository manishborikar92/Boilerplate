import assert from 'node:assert/strict';
import test from 'node:test';

import Rating from '../../models/rating.model.js';
import ratingRepository from '../rating.repository.js';

test('addReply requests the updated document, runs validators, and populates customer photo data', async (t) => {
    let updateArgs = null;
    let populateArg = null;
    const query = {
        populate(arg) {
            populateArg = arg;
            return 'populated-rating';
        },
    };

    t.mock.method(Rating, 'findByIdAndUpdate', (...args) => {
        updateArgs = args;
        return query;
    });

    const result = await ratingRepository.addReply('rating-1', 'Thanks', 'owner-1');

    assert.equal(result, 'populated-rating');
    assert.deepEqual(updateArgs[2], { returnDocument: 'after', runValidators: true });
    assert.deepEqual(populateArg, {
        path: 'customerId',
        select: 'firstName lastName photoUrl',
    });
});

test('updateReply keeps validators enabled and records the replying owner', async (t) => {
    let updateArgs = null;
    const query = {
        populate() {
            return 'updated-rating';
        },
    };

    t.mock.method(Rating, 'findByIdAndUpdate', (...args) => {
        updateArgs = args;
        return query;
    });

    const result = await ratingRepository.updateReply('rating-1', 'Updated reply', 'owner-1');

    assert.equal(result, 'updated-rating');
    assert.deepEqual(updateArgs[1], {
        'reply.text': 'Updated reply',
        'reply.repliedAt': updateArgs[1]['reply.repliedAt'],
        'reply.repliedBy': 'owner-1',
    });
    assert.equal(updateArgs[1]['reply.repliedAt'] instanceof Date, true);
    assert.deepEqual(updateArgs[2], { returnDocument: 'after', runValidators: true });
});

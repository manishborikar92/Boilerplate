import assert from 'node:assert/strict';
import test from 'node:test';

import { addRatingSchema, addReplySchema } from '../rating.validator.js';

test('addRatingSchema trims review text', () => {
    const { error, value } = addRatingSchema.validate({
        shopId: '507f1f77bcf86cd799439011',
        rating: 5,
        review: '  Great service  ',
    });

    assert.equal(error, undefined);
    assert.equal(value.review, 'Great service');
});

test('addReplySchema rejects whitespace-only replies', () => {
    const { error } = addReplySchema.validate({
        replyText: '   ',
    });

    assert.match(error?.message || '', /Reply text is required/);
});

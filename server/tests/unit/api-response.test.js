import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiResponse } from '../../src/utils/api-response.js';

test('ApiResponse.success removes undefined values and normalizes ids', () => {
  const response = ApiResponse.success({
    _id: { toHexString: () => 'abc123' },
    keep: 'value',
    drop: undefined,
    nested: {
      _id: 'nested-id',
    },
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Success',
    data: {
      id: 'abc123',
      keep: 'value',
      nested: {
        id: 'nested-id',
      },
    },
  });
});

test('ApiResponse.paginated includes pagination metadata', () => {
  const response = ApiResponse.paginated([{ id: '1' }], {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.meta.pagination, {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  });
});

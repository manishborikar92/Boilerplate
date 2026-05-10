import assert from 'node:assert/strict';
import test from 'node:test';

import { createFirebaseAdmin } from '../src/index.js';

test('createFirebaseAdmin reuses an existing named app', () => {
  const existing = { name: 'api' };
  const admin = {
    apps: [existing],
    credential: { cert() {} },
    initializeApp() {
      throw new Error('should not initialize');
    },
  };

  assert.equal(createFirebaseAdmin({ admin, appName: 'api', credentials: {} }), existing);
});

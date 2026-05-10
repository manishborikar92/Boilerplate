import assert from 'node:assert/strict';
import test from 'node:test';

import { extractCloudinaryPublicId } from '../src/index.js';

test('extractCloudinaryPublicId extracts ids from versioned Cloudinary URLs', () => {
  assert.equal(
    extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/v123/folder/image.jpg'),
    'folder/image',
  );
});

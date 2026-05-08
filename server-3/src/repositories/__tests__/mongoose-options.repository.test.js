import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryDir = path.resolve(__dirname, '..');

const repositoryFiles = [
    'booking.repository.js',
    'customer.repository.js',
    'employee.repository.js',
    'payment.repository.js',
    'payout.repository.js',
    'rating.repository.js',
    'service.repository.js',
    'shop.repository.js',
    'user.repository.js',
];

test('repositories use returnDocument: after instead of deprecated new: true', async () => {
    const offenders = [];

    for (const file of repositoryFiles) {
        const contents = await readFile(path.join(repositoryDir, file), 'utf8');
        if (/\bnew\s*:\s*true\b/.test(contents)) {
            offenders.push(file);
        }
    }

    assert.deepEqual(offenders, []);
});

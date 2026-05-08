import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', '..');

const readSource = (relativePath) => readFile(path.join(srcDir, relativePath), 'utf8');

test('customer service-removal booking API and support symbols are removed', async () => {
    const files = [
        'routes/bookings.routes.js',
        'controllers/booking.controller.js',
        'services/booking.service.js',
        'validators/booking.validator.js',
    ];

    const sources = await Promise.all(files.map(readSource));

    assert.doesNotMatch(sources[0], /\/bookings\/:id\/services\/:serviceId/);
    for (const source of sources) {
        assert.doesNotMatch(source, /deleteServiceFromBooking|bookingServiceParamsSchema/);
    }
});

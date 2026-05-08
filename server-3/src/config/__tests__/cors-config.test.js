import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
    process.env = { ...ORIGINAL_ENV };
};

const loadConfig = async () => {
    const modulePath = `../cors.config.js?test=${Date.now()}-${Math.random()}`;
    return import(modulePath);
};

test.afterEach(resetEnv);

test('parseAllowedOrigins trims comma-separated origins and drops blanks', async () => {
    const { parseAllowedOrigins } = await loadConfig();

    assert.deepEqual(
        parseAllowedOrigins(' https://app.evercut.com, ,https://admin.evercut.com '),
        ['https://app.evercut.com', 'https://admin.evercut.com'],
    );
});

test('createCorsOptions allows native mobile requests without Origin header', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://merchant.evercut.com';
    const { createCorsOptions } = await loadConfig();

    const options = createCorsOptions();

    await new Promise((resolve, reject) => {
        options.origin(undefined, (error, allowed) => {
            try {
                assert.equal(error, null);
                assert.equal(allowed, true);
                resolve();
            } catch (assertionError) {
                reject(assertionError);
            }
        });
    });
});

test('createCorsOptions rejects unknown browser origins in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://merchant.evercut.com';
    const { createCorsOptions } = await loadConfig();

    const options = createCorsOptions();

    await new Promise((resolve, reject) => {
        options.origin('https://evil.example', (error) => {
            try {
                assert.equal(error.message, 'Origin not allowed by CORS');
                resolve();
            } catch (assertionError) {
                reject(assertionError);
            }
        });
    });
});

test('createCorsOptions allows configured production origins', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://merchant.evercut.com';
    const { createCorsOptions } = await loadConfig();

    const options = createCorsOptions();

    await new Promise((resolve, reject) => {
        options.origin('https://merchant.evercut.com', (error, allowed) => {
            try {
                assert.equal(error, null);
                assert.equal(allowed, true);
                resolve();
            } catch (assertionError) {
                reject(assertionError);
            }
        });
    });
});

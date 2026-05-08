import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configModuleUrl = pathToFileURL(
    path.resolve(__dirname, '../index.js'),
).href;

const loadFreshConfig = async () => {
    const cacheBuster = `${Date.now()}-${Math.random()}`;
    const module = await import(`${configModuleUrl}?test=${cacheBuster}`);
    return module.default;
};

const applyRequiredEnv = () => {
    const defaults = {
        MONGODB_URI: 'mongodb://localhost:27017/evercut-test',
        FIREBASE_PROJECT_ID: 'evercut-test',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
        CLOUDINARY_CLOUD_NAME: 'evercut',
        CLOUDINARY_API_KEY: 'cloudinary-key',
        CLOUDINARY_API_SECRET: 'cloudinary-secret',
        MSG91_AUTH_KEY: 'msg91-auth',
        MSG91_OTP_TEMPLATE_ID: 'msg91-template',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
    };

    for (const [key, value] of Object.entries(defaults)) {
        process.env[key] = value;
    }
};

test('payment config defaults expose native PhonePe SDK auth URLs without redirect settings', async () => {
    const originalEnv = { ...process.env };

    try {
        applyRequiredEnv();
        process.env.NODE_ENV = 'development';
        process.env.PORT = '';
        process.env.PHONEPE_ENV = 'SANDBOX';

        const config = await loadFreshConfig();

        assert.equal(config.port, 5000);
        assert.equal(
            config.phonepe.authUrl,
            'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
        );
        assert.equal(Object.hasOwn(config.payment, 'redirectBaseUrl'), false);
    } finally {
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                delete process.env[key];
            }
        }

        Object.assign(process.env, originalEnv);
    }
});

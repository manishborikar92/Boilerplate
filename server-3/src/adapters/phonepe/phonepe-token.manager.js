import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { PaymentError } from '../../utils/api-error.js';

const safeReadJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

class PhonePeTokenManager {
    constructor() {
        this._token = null;
        this._expiresAt = 0;
        this._refreshPromise = null;
        this._refreshBufferMs = 5 * 60 * 1000;
    }

    async getToken() {
        if (this._isTokenValid()) {
            return this._token;
        }

        if (!this._refreshPromise) {
            this._refreshPromise = this._refreshToken();
        }

        try {
            await this._refreshPromise;
            return this._token;
        } finally {
            this._refreshPromise = null;
        }
    }

    async forceRefresh() {
        this._token = null;
        this._expiresAt = 0;
        return this.getToken();
    }

    _isTokenValid() {
        return Boolean(this._token) && Date.now() < (this._expiresAt - this._refreshBufferMs);
    }

    async _refreshToken() {
        const url = config.phonepe.authUrl;
        const body = new URLSearchParams({
            client_id: config.phonepe.clientId,
            client_version: String(config.phonepe.clientVersion),
            client_secret: config.phonepe.clientSecret,
            grant_type: 'client_credentials',
        });

        logger.info('[PhonePeTokenManager] Refreshing access token', {
            environment: config.phonepe.env,
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const data = await safeReadJson(response);

        if (!response.ok || !data?.access_token) {
            logger.error('[PhonePeTokenManager] Token refresh failed', {
                status: response.status,
                error: data?.message || response.statusText,
            });
            throw new PaymentError('PhonePe token refresh failed');
        }

        this._token = data.access_token;
        this._expiresAt = Number(data.expires_at || 0) * 1000;

        logger.info('[PhonePeTokenManager] Token refreshed successfully', {
            expiresAt: this._expiresAt ? new Date(this._expiresAt).toISOString() : null,
        });
    }
}

const tokenManager = new PhonePeTokenManager();
export default tokenManager;

import { TooManyRequestsError } from '../utils/api-error.js';

// Dev-friendly in-memory store. Replace with Redis-backed storage
// before running multiple backend instances behind a load balancer.
const store = new Map();

const cleanupExpiredEntries = () => {
    const now = Date.now();

    for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
};

const cleanupTimer = setInterval(cleanupExpiredEntries, 10 * 60 * 1000);
cleanupTimer.unref();

const resolveKeyValue = (req, keySource) => {
    if (keySource === 'body.mobile') {
        const mobile = req.body?.mobile;
        return typeof mobile === 'string' && mobile.trim() ? mobile.trim() : req.ip;
    }

    return req.ip;
};

/**
 * Simple OTP-specific rate limiter for development and single-instance deployments.
 *
 * @param {{ windowMs: number, max: number, keyPrefix: string, keySource?: 'ip'|'body.mobile' }} options
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
export const otpRateLimiter = ({ windowMs, max, keyPrefix, keySource = 'ip' }) => {
    return (req, _res, next) => {
        const keyValue = resolveKeyValue(req, keySource);
        const key = `${keyPrefix}:${keyValue}`;
        const now = Date.now();
        const entry = store.get(key);

        if (!entry || now > entry.resetAt) {
            store.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        if (entry.count >= max) {
            const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            return next(
                new TooManyRequestsError(
                    `Too many requests. Please try again after ${retryAfter} seconds.`,
                ),
            );
        }

        entry.count += 1;
        return next();
    };
};

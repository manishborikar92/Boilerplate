/**
 * Structured logger with sensitive data redaction.
 *
 * Features:
 *   - JSON-formatted log entries with level, timestamp, message, and metadata
 *   - Automatic redaction of sensitive patterns (URIs, tokens, keys, passwords)
 *   - Configurable log levels via LOG_LEVEL env var
 *
 * Keeping it dependency-free for now; swap with winston/pino later if needed.
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const CURRENT_LEVEL =
    LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.debug;

const PHONE_KEY_PATTERN = /(phone|mobile)/i;

export const maskPhoneNumber = (value) => {
    if (value === null || value === undefined) return value;

    const raw = String(value).trim();
    if (!raw) return raw;

    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 4) return raw;

    let visibleDigits = 0;
    return [...raw]
        .reverse()
        .map((char) => {
            if (!/\d/.test(char)) return char;

            visibleDigits += 1;
            return visibleDigits <= 4 ? char : '*';
        })
        .reverse()
        .join('');
};

export const maskBankAccount = (value) => {
    if (value === null || value === undefined) return value;

    const raw = String(value).trim();
    if (!raw) return raw;

    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 4) return raw;

    const lastFour = digits.slice(-4);
    return `******${lastFour}`;
};

export const maskUpiId = (value) => {
    if (value === null || value === undefined) return value;

    const raw = String(value).trim();
    if (!raw || !raw.includes('@')) return raw;

    const [handle, domain] = raw.split('@');
    if (!handle) return raw;

    const visiblePrefix = handle.slice(0, 2);
    const visibleSuffix = handle.length > 4 ? handle.slice(-2) : '';
    const maskedMiddle = '*'.repeat(Math.max(handle.length - (visiblePrefix.length + visibleSuffix.length), 2));

    return `${visiblePrefix}${maskedMiddle}${visibleSuffix}@${domain}`;
};

// ---------------------------------------------------------------------------
// Sensitive data redaction
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate sensitive data which must NEVER appear in logs.
 * Each pattern replaces the matched content with a redacted placeholder.
 */
const SENSITIVE_PATTERNS = [
    // MongoDB connection URIs (mongodb:// or mongodb+srv://)
    { regex: /mongodb(\+srv)?:\/\/[^\s,'"}\]]+/gi, replacement: 'mongodb://***REDACTED***' },
    // Generic connection strings with credentials (user:pass@host)
    { regex: /\/\/[^:]+:[^@]+@[^\s,'"}\]]+/gi, replacement: '//***REDACTED***' },
    // Phone-bearing query params in URLs
    {
        regex: /([?&](?:mobile|phone(?:number)?)=)([^&\s]+)/gi,
        replacement: (_match, prefix, phoneValue) => `${prefix}${maskPhoneNumber(phoneValue)}`,
    },
    // Inline phone/mobile key-value strings
    {
        regex: /((?:phone(?:number)?|mobile)\s*[:=]\s*['"]?)(\+?[0-9][0-9()\s-]{5,}[0-9])/gi,
        replacement: (_match, prefix, phoneValue) => `${prefix}${maskPhoneNumber(phoneValue)}`,
    },
    // Bearer tokens
    { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer ***REDACTED***' },
    // Private keys
    { regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, replacement: '***PRIVATE_KEY_REDACTED***' },
    // API keys/secrets that look like long hex or base64 strings (32+ chars)
    { regex: /(?:api[_-]?key|api[_-]?secret|password|passwd|secret|token|authorization)\s*[:=]\s*['"]?([A-Za-z0-9+/=_\-]{20,})['"]?/gi, replacement: '$1: ***REDACTED***' },
];

/**
 * Redact sensitive information from a string.
 *
 * @param   {string} text
 * @returns {string}
 */
const redact = (text) => {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const { regex, replacement } of SENSITIVE_PATTERNS) {
        result = result.replace(regex, replacement);
    }
    return result;
};

const deepRedact = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redact(value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return { message: value.message, stack: value.stack };

    // Convert Mongoose ObjectIds or other objects that implement standard toString 
    // but aren't pure generic Objects/Arrays
    if (typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
        return value.toString();
    }

    if (Array.isArray(value)) return value.map(deepRedact);
    if (typeof value === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
            // Completely mask known-sensitive field names
            const lowerKey = k.toLowerCase();
            if (PHONE_KEY_PATTERN.test(lowerKey)) {
                if (Array.isArray(v)) {
                    cleaned[k] = v.map(maskPhoneNumber);
                } else if (v && typeof v === 'object') {
                    cleaned[k] = deepRedact(v);
                } else {
                    cleaned[k] = maskPhoneNumber(v);
                }
            } else if (
                lowerKey === 'upiid'
                || lowerKey === 'upi'
                || lowerKey === 'vpa'
                || lowerKey.includes('upi')
                || lowerKey.includes('vpa')
            ) {
                if (Array.isArray(v)) {
                    cleaned[k] = v.map(maskUpiId);
                } else {
                    cleaned[k] = maskUpiId(v);
                }
            } else if (
                lowerKey === 'bankaccount'
                || lowerKey.includes('bankaccount')
                || lowerKey.includes('accountnumber')
            ) {
                if (Array.isArray(v)) {
                    cleaned[k] = v.map(maskBankAccount);
                } else {
                    cleaned[k] = maskBankAccount(v);
                }
            } else if (
                lowerKey.includes('password') ||
                lowerKey.includes('secret') ||
                lowerKey.includes('pinhash') ||
                lowerKey.includes('private_key') ||
                lowerKey.includes('privatekey') ||
                lowerKey === 'authorization'
            ) {
                cleaned[k] = '***REDACTED***';
            } else {
                cleaned[k] = deepRedact(v);
            }
        }
        return cleaned;
    }
    return value;
};

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Format a log entry as a JSON string with redaction applied.
 */
const formatEntry = (level, message, meta = {}) => {
    const entry = {
        level,
        timestamp: new Date().toISOString(),
        message: redact(message),
        ...deepRedact(meta),
    };
    return JSON.stringify(entry);
};

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = {
    debug(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
            console.debug(formatEntry('debug', message, meta));
        }
    },

    info(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.info) {
            console.info(formatEntry('info', message, meta));
        }
    },

    warn(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
            console.warn(formatEntry('warn', message, meta));
        }
    },

    error(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.error) {
            console.error(formatEntry('error', message, meta));
        }
    },
};

export default logger;

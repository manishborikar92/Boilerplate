const DEFAULT_LOCAL_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
];

export const parseAllowedOrigins = (value) => String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const localDevelopmentOrigins = () => {
    const configured = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
    return configured.length > 0 ? configured : DEFAULT_LOCAL_ORIGINS;
};

export const resolveAllowedOrigins = (env = process.env.NODE_ENV || 'development') => {
    if (env === 'production' || env === 'staging') {
        return parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
    }

    return localDevelopmentOrigins();
};

export const createCorsOptions = () => {
    const env = process.env.NODE_ENV || 'development';
    const allowedOrigins = resolveAllowedOrigins(env);

    return {
        origin(origin, callback) {
            if (!origin) {
                callback(null, true);
                return;
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error('Origin not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false,
        maxAge: 600,
    };
};

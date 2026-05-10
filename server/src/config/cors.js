const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id'];

export const createCorsOptions = (config) => ({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.security.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: config.security.corsCredentials,
  methods: DEFAULT_METHODS,
  allowedHeaders: DEFAULT_HEADERS,
  maxAge: 600,
});

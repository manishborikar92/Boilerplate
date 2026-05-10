import helmet from 'helmet';

export const createHelmet = (config) => helmet({
  contentSecurityPolicy: config.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", ...config.security.allowedOrigins],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: config.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

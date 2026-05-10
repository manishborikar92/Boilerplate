import rateLimit from 'express-rate-limit';

import { ApiResponse } from '../utils/api-response.js';

export const createRateLimiter = (config) => rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (_req, res) => {
    res.status(429).json(ApiResponse.error('Too many requests'));
  },
});

import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const meta = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', meta);
    } else {
      logger.info('Request completed', meta);
    }
  });

  next();
};

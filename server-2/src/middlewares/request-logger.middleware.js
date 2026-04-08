import logger from '../utils/logger.js';

const getLogLevel = (statusCode) => {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode >= 400) {
    return 'warn';
  }

  return 'info';
};

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  req.logger = logger.child({
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = getLogLevel(res.statusCode);

    req.logger[level]('request.completed', {
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get('user-agent') || 'unknown',
    });
  });

  next();
};

export default requestLogger;

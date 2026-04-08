import createApp from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';

const app = createApp();
const server = app.listen(env.port, () => {
  logger.info('server.started', {
    appName: env.appName,
    environment: env.nodeEnv,
    port: env.port,
    apiPrefix: env.apiPrefix,
  });
});

let isShuttingDown = false;

const shutdown = (signal, error) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  const timeout = setTimeout(() => {
    logger.error('server.shutdown.forced', { signal });
    process.exit(1);
  }, 10_000);

  timeout.unref();

  if (error) {
    logger.fatal('server.shutdown.error', {
      signal,
      error,
    });
  } else {
    logger.info('server.shutdown.requested', { signal });
  }

  server.close((closeError) => {
    if (closeError) {
      logger.error('server.shutdown.failed', {
        signal,
        error: closeError,
      });
      process.exit(1);
      return;
    }

    logger.info('server.shutdown.complete', { signal });
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  shutdown('UNHANDLED_REJECTION', error);
});

process.on('uncaughtException', (error) => {
  shutdown('UNCAUGHT_EXCEPTION', error);
});

import { createGateway } from './create-gateway.js';

const gateway = await createGateway();
const server = gateway.app.listen(gateway.env.port, () => {
  gateway.logger.info('gateway.started', {
    port: gateway.env.port,
    apps: gateway.apps.map((app) => ({
      name: app.name,
      mountPath: app.mountPath,
    })),
  });
});

let isShuttingDown = false;

const shutdown = (signal, error) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  const timeout = setTimeout(() => {
    gateway.logger.error('gateway.shutdown.forced', { signal });
    process.exit(1);
  }, 10_000);

  timeout.unref();

  if (error) {
    gateway.logger.fatal('gateway.shutdown.error', {
      signal,
      error,
    });
  } else {
    gateway.logger.info('gateway.shutdown.requested', { signal });
  }

  server.close((closeError) => {
    if (closeError) {
      gateway.logger.error('gateway.shutdown.failed', {
        signal,
        error: closeError,
      });
      process.exit(1);
      return;
    }

    gateway.logger.info('gateway.shutdown.complete', { signal });
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

import { pathToFileURL } from 'url';
import createApp from './app.js';
import config from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createShutdownManager } from './core/lifecycle.js';
import logger from './utils/logger.js';

export const startServer = async () => {
  await connectDatabase(config);

  const app = createApp();
  const server = app.listen(config.app.port, config.app.host);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  logger.info('HTTP server started', {
    service: config.app.name,
    env: config.env,
    host: typeof address === 'object' ? address.address : config.app.host,
    port: typeof address === 'object' ? address.port : config.app.port,
    apiPrefix: config.app.apiPrefix,
  });

  const shutdownManager = createShutdownManager({
    server,
    config,
    cleanup: [disconnectDatabase],
  });

  process.on('SIGTERM', () => shutdownManager.shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdownManager.shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
    shutdownManager.shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdownManager.shutdown('uncaughtException');
  });

  return { app, server, shutdownManager };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

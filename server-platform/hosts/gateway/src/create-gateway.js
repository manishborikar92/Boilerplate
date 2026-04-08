import path from 'node:path';
import { fileURLToPath } from 'node:url';
import workspaceConfig from '../../../workspace.config.js';
import {
  createHostApp,
  createLogger,
  loadEnv,
} from '../../../packages/core/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

export const createGateway = async ({ envOverrides = {} } = {}) => {
  const env = loadEnv({
    ...process.env,
    ...envOverrides,
  });

  const logger = createLogger({
    serviceName: env.hostName,
    environment: env.nodeEnv,
    level: env.logLevel,
  });

  const gateway = await createHostApp({
    env,
    logger,
    workspaceConfig,
    rootDir,
  });

  return {
    ...gateway,
    env,
    logger,
  };
};

import env from '../config/env.js';

const toMegabytes = (value) => Number((value / (1024 * 1024)).toFixed(2));

const buildBasePayload = () => ({
  app: env.appName,
  version: env.appVersion,
  environment: env.nodeEnv,
  timestamp: new Date().toISOString(),
  uptimeSeconds: Number(process.uptime().toFixed(2)),
});

const buildRuntimeDetails = () => {
  const memory = process.memoryUsage();

  return {
    nodeVersion: process.version,
    pid: process.pid,
    platform: process.platform,
    memory: {
      rssMb: toMegabytes(memory.rss),
      heapTotalMb: toMegabytes(memory.heapTotal),
      heapUsedMb: toMegabytes(memory.heapUsed),
      externalMb: toMegabytes(memory.external),
    },
  };
};

const attachOptionalDetails = (payload, detailed) => {
  if (!detailed) {
    return payload;
  }

  return {
    ...payload,
    runtime: buildRuntimeDetails(),
  };
};

export const getHealth = ({ detailed = false } = {}) =>
  attachOptionalDetails(
    {
      status: 'ok',
      ...buildBasePayload(),
    },
    detailed,
  );

export const getLiveness = () => ({
  status: 'alive',
  timestamp: new Date().toISOString(),
});

export const getReadiness = ({ detailed = false } = {}) =>
  attachOptionalDetails(
    {
      status: 'ready',
      ...buildBasePayload(),
      checks: [
        { name: 'configuration', status: 'ok' },
        { name: 'http-server', status: 'ok' },
      ],
    },
    detailed,
  );

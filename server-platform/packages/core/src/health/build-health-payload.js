const toMegabytes = (value) => Number((value / (1024 * 1024)).toFixed(2));

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

export const buildHealthPayload = ({
  name,
  version,
  environment,
  detailed = false,
  checks = [],
  status = 'ok',
} = {}) => {
  const payload = {
    status,
    name,
    version,
    environment,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(2)),
  };

  if (checks.length > 0) {
    payload.checks = checks;
  }

  if (detailed) {
    payload.runtime = buildRuntimeDetails();
  }

  return payload;
};

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|token|secret|key)/i;
const CONNECTION_STRING_PATTERN = /:\/\/[^/\s:@]+:[^@\s]+@/g;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

const redactString = (value) =>
  value
    .replace(CONNECTION_STRING_PATTERN, '://[REDACTED]@')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]');

const sanitizeValue = (value, keyName = '') => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack,
    };
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, keyName));
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, nestedValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(keyName)) {
        result[key] = '[REDACTED]';
        return result;
      }

      result[key] = sanitizeValue(nestedValue, key);
      return result;
    }, {});
  }

  return value;
};

const createChildLogger = (baseConfig, bindings = {}) => ({
  debug(message, meta) {
    writeLog(baseConfig, bindings, 'debug', message, meta);
  },
  info(message, meta) {
    writeLog(baseConfig, bindings, 'info', message, meta);
  },
  warn(message, meta) {
    writeLog(baseConfig, bindings, 'warn', message, meta);
  },
  error(message, meta) {
    writeLog(baseConfig, bindings, 'error', message, meta);
  },
  fatal(message, meta) {
    writeLog(baseConfig, bindings, 'fatal', message, meta);
  },
  child(nextBindings = {}) {
    return createChildLogger(baseConfig, {
      ...bindings,
      ...nextBindings,
    });
  },
});

const writeLog = (baseConfig, bindings, level, message, meta = {}) => {
  if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) < baseConfig.currentLevelWeight) {
    return;
  }

  const payload = {
    level,
    message: redactString(message),
    service: baseConfig.serviceName,
    environment: baseConfig.environment,
    timestamp: new Date().toISOString(),
    ...sanitizeValue({
      ...bindings,
      ...meta,
    }),
  };

  const serialized = JSON.stringify(payload);

  if (level === 'fatal' || level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

export const createLogger = ({
  serviceName = 'gateway',
  environment = 'development',
  level = 'info',
} = {}) => {
  const baseConfig = {
    serviceName,
    environment,
    currentLevelWeight: LOG_LEVELS[level] ?? LOG_LEVELS.info,
  };

  return createChildLogger(baseConfig);
};

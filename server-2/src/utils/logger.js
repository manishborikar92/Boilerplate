import env from '../config/env.js';

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

const currentLevelWeight = LOG_LEVELS[env.logLevel] ?? LOG_LEVELS.info;

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

const writeLog = (level, message, meta = {}) => {
  if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) < currentLevelWeight) {
    return;
  }

  const payload = {
    level,
    message: redactString(message),
    service: env.appName,
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    ...sanitizeValue(meta),
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

const createChildLogger = (bindings = {}) => ({
  debug(message, meta) {
    writeLog('debug', message, { ...bindings, ...meta });
  },
  info(message, meta) {
    writeLog('info', message, { ...bindings, ...meta });
  },
  warn(message, meta) {
    writeLog('warn', message, { ...bindings, ...meta });
  },
  error(message, meta) {
    writeLog('error', message, { ...bindings, ...meta });
  },
  fatal(message, meta) {
    writeLog('fatal', message, { ...bindings, ...meta });
  },
  child(nextBindings = {}) {
    return createChildLogger({ ...bindings, ...nextBindings });
  },
});

const logger = createChildLogger();

export default logger;

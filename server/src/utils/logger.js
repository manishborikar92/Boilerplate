const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|api[_-]?key|private[_-]?key)/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const URI_WITH_CREDENTIALS_PATTERN = /\/\/[^:\s]+:[^@\s]+@[^\s,'"}\]]+/gi;

const redactString = (value) => value
  .replace(BEARER_PATTERN, 'Bearer ***REDACTED***')
  .replace(URI_WITH_CREDENTIALS_PATTERN, '//***REDACTED***');

const redact = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redact);

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '***REDACTED***' : redact(nested),
      ]),
    );
  }

  return value;
};

export const createLogger = ({ level = process.env.LOG_LEVEL || 'info', service = 'api' } = {}) => {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (logLevel, message, meta = {}) => {
    if ((LEVELS[logLevel] ?? LEVELS.info) < threshold) return;

    const entry = {
      level: logLevel,
      timestamp: new Date().toISOString(),
      service,
      message: redactString(String(message)),
      ...redact(meta),
    };

    const line = JSON.stringify(entry);
    if (logLevel === 'error') {
      console.error(line);
    } else if (logLevel === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
};

export default createLogger();

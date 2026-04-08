import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config({ quiet: true });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  HOST_NAME: Joi.string().trim().min(1).default('gateway'),
  HOST_VERSION: Joi.string().trim().min(1).default('1.0.0'),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error', 'fatal').default('info'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  JSON_BODY_LIMIT: Joi.string().trim().min(1).default('1mb'),
  TRUST_PROXY: Joi.alternatives()
    .try(
      Joi.boolean(),
      Joi.number().integer().min(0),
      Joi.string().valid('loopback', 'linklocal', 'uniquelocal'),
    )
    .default(false),
  HEALTH_DETAILS_ENABLED: Joi.boolean().default(true),
}).unknown();

const parseOrigins = (origins) =>
  origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const loadEnv = (source = process.env) => {
  const { error, value } = envSchema.validate(source, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    isDevelopment: value.NODE_ENV === 'development',
    isProduction: value.NODE_ENV === 'production',
    port: value.PORT,
    hostName: value.HOST_NAME,
    hostVersion: value.HOST_VERSION,
    logLevel: value.LOG_LEVEL,
    corsOrigins: parseOrigins(value.CORS_ORIGINS),
    jsonBodyLimit: value.JSON_BODY_LIMIT,
    trustProxy: value.TRUST_PROXY,
    healthDetailsEnabled: value.HEALTH_DETAILS_ENABLED,
  });
};

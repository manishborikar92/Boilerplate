import mongoose from 'mongoose';

import logger from '../utils/logger.js';

export const connectDatabase = async (config) => {
  if (!config.database.enabled) {
    logger.info('Database connection disabled');
    return null;
  }

  if (!config.database.uri) {
    throw new Error('MONGODB_URI is required when DATABASE_ENABLED=true');
  }

  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);

  await mongoose.connect(config.database.uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  logger.info('MongoDB connected', {
    dbName: mongoose.connection.name,
    host: mongoose.connection.host,
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB runtime error', { error });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

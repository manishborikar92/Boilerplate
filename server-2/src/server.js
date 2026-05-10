const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

const app = require('./app');
const { initializeSocket, closeSocket } = require('./config/socket');
const { initializeFirebase } = require('./config/firebase');
const { initializeCloudinary } = require('./config/cloudinary');
const { logger } = require('./middleware/logger');
const { stopCleanup } = require('./utils/tokenBlacklist');

// Styled console output
let boxen, chalk;
(async () => {
  boxen = (await import('boxen')).default;
  chalk = (await import('chalk')).default;
})();

// Suppress mongoose deprecation warnings
mongoose.set('strictQuery', true);

// Initialize Firebase
initializeFirebase();

// Initialize Cloudinary
initializeCloudinary();

// Database Connection with retry logic
const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });

    if (retries > 0) {
      logger.info(`Retrying MongoDB connection... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    } else {
      logger.error('Failed to connect to MongoDB after multiple attempts');
      process.exit(1);
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error', { error: err.message });
});

// Connect to database
connectDB();

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  await initializeSocket(server);

  // Wait for dynamic imports
  if (!boxen || !chalk) {
    boxen = (await import('boxen')).default;
    chalk = (await import('chalk')).default;
  }

  const serverInfo = [
    `${chalk.bold.cyan('CA-Flow API Server')}`,
    '',
    `${chalk.green('🚀 Server:')}      ${chalk.white.underline(`http://localhost:${PORT}`)}`,
    `${chalk.blue('📍 Environment:')} ${chalk.yellow(process.env.NODE_ENV || 'development')}`,
    `${chalk.magenta('🔐 Auth:')}        ${chalk.gray('JWT with token rotation')}`,
    `${chalk.cyan('📊 Sessions:')}    ${chalk.gray('Max 3 per user')}`
  ].join('\n');

  console.log(
    boxen(serverInfo, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: '✨ Server Ready',
      titleAlignment: 'center'
    })
  );

  logger.info(`Server started on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { error: err.message, stack: err.stack });

  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', { error: err.message, stack: err.stack });

  // Exit immediately for uncaught exceptions
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  // Stop token blacklist cleanup interval
  stopCleanup();

  (async () => {
    try {
      await closeSocket();
    } catch (err) {
      logger.error('Failed to close Socket.IO cleanly', { error: err.message });
    }

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        // Remove disconnected listener to avoid warning during intentional shutdown
        mongoose.connection.removeAllListeners('disconnected');
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed');
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });
  })();

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

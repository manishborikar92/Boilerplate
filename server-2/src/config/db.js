const mongoose = require('mongoose');
const { logger } = require('../middleware/logger');

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

module.exports = connectDB;

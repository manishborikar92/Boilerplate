const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { requestLogger } = require('./middleware/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { globalErrorHandler, NotFoundError } = require('./utils/errorHandler');

const app = express();

// Security Middleware - Enhanced helmet configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    noSniff: true,
    xssFilter: true,
    // ... helmet config ...
    hidePoweredBy: true
}));

// Prevention of parameter pollution
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

// Sanitize data
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(requestLogger);
} else {
    app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Basic Route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Reusable Server Boilerplate API',
        version: '1.0.0',
        status: 'Server is running'
    });
});

// Health Check Route
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// API Routes
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// 404 Handler - Must come before error handler
app.use((req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

module.exports = app;

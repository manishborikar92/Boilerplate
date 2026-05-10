const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const socketManager = require('./services/socketManager');
const { getFrontendCorsOrigin, getFrontendOriginList } = require('./config/frontendOrigins');
const { requestLogger, errorLogger } = require('./middleware/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { globalErrorHandler, NotFoundError } = require('./utils/errorHandler');

// Capture the precise time the application module started
const APP_START_TIME = new Date();
const frontendOriginList = getFrontendOriginList();
const corsOrigin = getFrontendCorsOrigin();

const app = express();

app.set('trust proxy', 1);

// Security Middleware - Enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", ...frontendOriginList],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : undefined, // Disable CSP in development for easier testing
  crossOriginEmbedderPolicy: false, // May need to be false for some integrations
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
  hidePoweredBy: true
}));

// CORS configuration
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(requestLogger);
} else {
  app.use(morgan('dev'));
}

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Basic Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CA-Flow API',
    version: '1.0.0',
    status: 'Server is running'
  });
});

// Health Check Route
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  
  const uptimeVal = process.uptime();
  const now = new Date();

  // Helper to format duration nicely
  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
  };

  res.json({
    status: 'OK',
    timestamp: now.toISOString(),
    timestampIST: now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'long'
    }),
    server: {
      startTime: APP_START_TIME.toISOString(),
      startTimeIST: APP_START_TIME.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'long'
      }),
      uptime: `${Math.floor(uptimeVal)}s`,
      uptimeFormatted: formatUptime(uptimeVal),
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      host: mongoose.connection.host || 'Unknown'
    },
    websocket: socketManager.getMetrics(),
    process: {
      memoryUsage: `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`,
      nodeVersion: process.version
    }
  });
});

// API Routes
const authRoutes = require('./routes/authRoutes');
const firmRoutes = require('./routes/firmRoutes');
const clientRoutes = require('./routes/clientRoutes');
const documentRoutes = require('./routes/documentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const threadRoutes = require('./routes/threadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/firms', firmRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Handler - Must come before error handler
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

module.exports = app;

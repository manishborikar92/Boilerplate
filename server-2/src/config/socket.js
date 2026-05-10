const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');
const User = require('../models/User');
const { logger } = require('../middleware/logger');
const { getFrontendCorsOrigin } = require('./frontendOrigins');

const CONNECTION_STATE_RECOVERY_MS = 2 * 60 * 1000;
const SOCKET_IO_PING_TIMEOUT = 60 * 1000;
const SOCKET_IO_PING_INTERVAL = 25 * 1000;

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Extract a bearer token from the Socket.IO handshake.
 * @param {import('socket.io').Socket} socket
 * @returns {string | null}
 */
function extractHandshakeToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers?.authorization;
  if (
    typeof authorizationHeader === 'string'
    && authorizationHeader.startsWith('Bearer ')
  ) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
}

/**
 * Authenticate a socket connection and attach the authenticated user payload.
 * @param {import('socket.io').Socket} socket
 * @param {(error?: Error) => void} next
 * @returns {Promise<void>}
 */
async function authenticateSocket(socket, next) {
  try {
    const token = extractHandshakeToken(socket);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    if (isTokenBlacklisted(token)) {
      return next(new Error('Token has been invalidated'));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId)
      .select('_id name email role firmId isDeleted lockUntil');

    if (!user || user.isDeleted) {
      return next(new Error('User not found'));
    }

    if (user.isLocked) {
      return next(new Error('Account is locked'));
    }

    socket.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      firmId: user.firmId ? user.firmId.toString() : null
    };

    return next();
  } catch (error) {
    logger.error('Socket authentication failed', {
      error: error.message,
      socketId: socket.id
    });
    return next(new Error('Authentication failed'));
  }
}

/**
 * Initialize the Socket.IO server on top of the existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
async function initializeSocket(httpServer) {
  if (io) {
    logger.warn('Socket.IO is already initialized');
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: getFrontendCorsOrigin(),
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: SOCKET_IO_PING_TIMEOUT,
    pingInterval: SOCKET_IO_PING_INTERVAL,
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: CONNECTION_STATE_RECOVERY_MS,
      skipMiddlewares: false
    }
  });

  io.use(authenticateSocket);

  const socketManager = require('../services/socketManager');
  socketManager.initialize(io);

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Close Socket.IO connections.
 * @returns {Promise<void>}
 */
async function closeSocket() {
  if (io) {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    io = null;
    logger.info('Socket.IO connections closed');
  }
}

/**
 * Get the active Socket.IO server instance.
 * @returns {import('socket.io').Server | null}
 */
function getIO() {
  return io;
}

module.exports = {
  initializeSocket,
  closeSocket,
  getIO
};

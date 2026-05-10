const { logger } = require('../middleware/logger');
const Client = require('../models/Client');
const Thread = require('../models/Thread');

/** @type {import('socket.io').Server | null} */
let io = null;

// Map<userId, Set<socketId>>
const onlineUsers = new Map();
const socketEventRateLimits = new Map();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const THREAD_JOIN_LIMIT_PER_WINDOW = 30;
const THREAD_TYPING_LIMIT_PER_WINDOW = 60;

/**
 * Normalize an identifier to a string for room names and map keys.
 * @param {string | import('mongoose').Types.ObjectId | null | undefined} value
 * @returns {string | null}
 */
function normalizeId(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toString();
}

/**
 * Resolve the client profile ID for a connected Client user.
 * @param {import('socket.io').Socket & { user?: object, clientProfileId?: string | null }} socket
 * @returns {Promise<string | null>}
 */
async function resolveClientProfileId(socket) {
  if (socket.clientProfileId) {
    return socket.clientProfileId;
  }

  const userId = normalizeId(socket.user?._id);
  if (!userId || socket.user?.role !== 'Client') {
    return null;
  }

  const client = await Client.findOne({
    userAccountId: userId,
    isDeleted: false
  })
    .select('_id')
    .lean();

  socket.clientProfileId = client?._id ? normalizeId(client._id) : null;
  return socket.clientProfileId;
}

/**
 * Verify whether the connected socket can access the requested thread.
 * @param {import('socket.io').Socket & { user?: object, clientProfileId?: string | null }} socket
 * @param {string} threadId
 * @returns {Promise<boolean>}
 */
async function canAccessThread(socket, threadId) {
  const normalizedThreadId = normalizeId(threadId);
  const userId = normalizeId(socket.user?._id);
  const userRole = socket.user?.role;
  const userFirmId = normalizeId(socket.user?.firmId);

  if (!normalizedThreadId || !userId || !userRole) {
    return false;
  }

  const thread = await Thread.findOne({
    _id: normalizedThreadId,
    isDeleted: false
  })
    .select('_id firmId clientId')
    .lean();

  if (!thread) {
    return false;
  }

  if (userRole === 'CA-Admin') {
    return normalizeId(thread.firmId) === userFirmId;
  }

  if (userRole === 'Client') {
    const clientProfileId = await resolveClientProfileId(socket);
    return !!clientProfileId && normalizeId(thread.clientId) === clientProfileId;
  }

  return false;
}

/**
 * Track a user socket as online.
 * @param {string} userId
 * @param {string} socketId
 * @returns {boolean} True when the user just became online
 */
function addOnlineUserSocket(userId, socketId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId || !socketId) {
    return false;
  }

  const existingSockets = onlineUsers.get(normalizedUserId) || new Set();
  const wasOffline = existingSockets.size === 0;

  existingSockets.add(socketId);
  onlineUsers.set(normalizedUserId, existingSockets);

  return wasOffline;
}

/**
 * Remove a socket from online tracking.
 * @param {string} userId
 * @param {string} socketId
 * @returns {boolean} True when the user just went offline
 */
function removeOnlineUserSocket(userId, socketId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId || !socketId) {
    return false;
  }

  const existingSockets = onlineUsers.get(normalizedUserId);
  if (!existingSockets) {
    return false;
  }

  existingSockets.delete(socketId);

  if (existingSockets.size === 0) {
    onlineUsers.delete(normalizedUserId);
    return true;
  }

  return false;
}

/**
 * Count only application rooms, excluding implicit per-socket rooms.
 * @returns {number}
 */
function getApplicationRoomCount() {
  if (!io?.sockets?.adapter?.rooms || !io?.sockets?.sockets) {
    return 0;
  }

  const socketIds = new Set(io.sockets.sockets.keys());
  let roomCount = 0;

  for (const roomName of io.sockets.adapter.rooms.keys()) {
    if (!socketIds.has(roomName)) {
      roomCount += 1;
    }
  }

  return roomCount;
}

/**
 * Enforce a simple fixed-window per-user event limit across all sockets.
 * @param {string | null} userId
 * @param {string} eventName
 * @param {number} limit
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
function consumeRateLimit(userId, eventName, limit) {
  const normalizedUserId = normalizeId(userId);

  if (!normalizedUserId || !eventName || !Number.isFinite(limit) || limit <= 0) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const now = Date.now();
  const key = `${normalizedUserId}:${eventName}`;
  const existingEntry = socketEventRateLimits.get(key);

  if (!existingEntry || existingEntry.resetAt <= now) {
    socketEventRateLimits.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existingEntry.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(existingEntry.resetAt - now, 0)
    };
  }

  existingEntry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Emit a structured rate-limit warning to the current socket.
 * @param {import('socket.io').Socket} socket
 * @param {string} eventName
 * @param {number} retryAfterMs
 */
function emitRateLimitWarning(socket, eventName, retryAfterMs) {
  socket.emit('socket:rate-limit', {
    event: eventName,
    retryAfterMs,
    message: `Rate limit exceeded for ${eventName}`
  });
}

/**
 * Attach all connection lifecycle handlers to the Socket.IO server.
 * @param {import('socket.io').Server} socketIO
 */
function initialize(socketIO) {
  if (io) {
    logger.warn('Socket manager is already initialized');
    return;
  }

  io = socketIO;

  io.on('connection', async (socket) => {
    const userId = normalizeId(socket.user?._id);
    const role = socket.user?.role;
    const firmId = normalizeId(socket.user?.firmId);
    socket.joinedThreadIds = new Set();

    logger.info('Socket connected', {
      userId,
      role,
      socketId: socket.id
    });

    if (userId) {
      socket.join(`user:${userId}`);
    }

    if (role === 'CA-Admin' && firmId) {
      socket.join(`firm:${firmId}`);
    }

    if (role === 'Client') {
      try {
        await resolveClientProfileId(socket);
      } catch (error) {
        logger.error('Failed to resolve client profile for socket', {
          userId,
          socketId: socket.id,
          error: error.message
        });
      }
    }

    const becameOnline = addOnlineUserSocket(userId, socket.id);

    if (becameOnline && firmId) {
      socket.to(`firm:${firmId}`).emit('user:online', {
        userId,
        role,
        name: socket.user?.name
      });
    }

    socket.on('thread:join', async (threadId) => {
      const normalizedThreadId = normalizeId(threadId);

      if (!normalizedThreadId) {
        return;
      }

      const rateLimitResult = consumeRateLimit(
        userId,
        'thread:join',
        THREAD_JOIN_LIMIT_PER_WINDOW
      );

      if (!rateLimitResult.allowed) {
        logger.warn('Socket thread join rate limit exceeded', {
          userId,
          threadId: normalizedThreadId,
          socketId: socket.id,
          retryAfterMs: rateLimitResult.retryAfterMs
        });
        emitRateLimitWarning(socket, 'thread:join', rateLimitResult.retryAfterMs);
        return;
      }

      try {
        const hasAccess = await canAccessThread(socket, normalizedThreadId);

        if (!hasAccess) {
          logger.warn('Unauthorized thread room join attempt', {
            userId,
            threadId: normalizedThreadId,
            socketId: socket.id
          });
          return;
        }

        socket.join(`thread:${normalizedThreadId}`);
        socket.joinedThreadIds.add(normalizedThreadId);
        logger.debug('Socket joined thread room', {
          userId,
          threadId: normalizedThreadId,
          socketId: socket.id
        });
      } catch (error) {
        logger.error('Failed to join thread room', {
          userId,
          threadId: normalizedThreadId,
          socketId: socket.id,
          error: error.message
        });
      }
    });

    socket.on('thread:leave', (threadId) => {
      const normalizedThreadId = normalizeId(threadId);

      if (!normalizedThreadId) {
        return;
      }

      socket.leave(`thread:${normalizedThreadId}`);
      socket.joinedThreadIds?.delete(normalizedThreadId);
      logger.debug('Socket left thread room', {
        userId,
        threadId: normalizedThreadId,
        socketId: socket.id
      });
    });

    socket.on('thread:typing', async (payload = {}) => {
      const normalizedThreadId = normalizeId(payload.threadId);

      if (!normalizedThreadId) {
        return;
      }

      const rateLimitResult = consumeRateLimit(
        userId,
        'thread:typing',
        THREAD_TYPING_LIMIT_PER_WINDOW
      );

      if (!rateLimitResult.allowed) {
        logger.warn('Socket typing rate limit exceeded', {
          userId,
          threadId: normalizedThreadId,
          socketId: socket.id,
          retryAfterMs: rateLimitResult.retryAfterMs
        });
        emitRateLimitWarning(socket, 'thread:typing', rateLimitResult.retryAfterMs);
        return;
      }

      try {
        const hasAccess = socket.joinedThreadIds?.has(normalizedThreadId)
          ? true
          : await canAccessThread(socket, normalizedThreadId);

        if (!hasAccess) {
          logger.warn('Unauthorized typing event attempt', {
            userId,
            threadId: normalizedThreadId,
            socketId: socket.id
          });
          return;
        }

        socket.to(`thread:${normalizedThreadId}`).emit('thread:typing', {
          threadId: normalizedThreadId,
          userId,
          name: socket.user?.name,
          role,
          isTyping: Boolean(payload.isTyping)
        });
      } catch (error) {
        logger.error('Failed to relay typing event', {
          userId,
          threadId: normalizedThreadId,
          socketId: socket.id,
          error: error.message
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        userId,
        reason,
        socketId: socket.id
      });

      const becameOffline = removeOnlineUserSocket(userId, socket.id);

      if (becameOffline && firmId) {
        socket.to(`firm:${firmId}`).emit('user:offline', {
          userId,
          role
        });
      }
    });
  });
}

/**
 * Emit a notification to a specific user room.
 * @param {string} recipientId
 * @param {object} notification
 */
function emitNotification(recipientId, notification) {
  const normalizedRecipientId = normalizeId(recipientId);
  if (!io || !normalizedRecipientId || !notification) {
    return;
  }

  io.to(`user:${normalizedRecipientId}`).emit('notification:new', {
    notification: {
      _id: normalizeId(notification._id),
      type: notification.type,
      subtype: notification.subtype,
      priority: notification.priority,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      relatedEntity: notification.relatedEntity,
      metadata: notification.metadata,
      createdAt: notification.createdAt
    }
  });
}

/**
 * Emit an unread count update to a specific user room.
 * @param {string} userId
 * @param {number} count
 */
function emitUnreadCount(userId, count) {
  const normalizedUserId = normalizeId(userId);
  if (!io || !normalizedUserId || typeof count !== 'number') {
    return;
  }

  io.to(`user:${normalizedUserId}`).emit('notification:unread-count', { count });
}

/**
 * Emit a new message to a thread room.
 * @param {string} threadId
 * @param {object} message
 * @param {string} [senderSocketId]
 */
function emitNewMessage(threadId, message, senderSocketId) {
  const normalizedThreadId = normalizeId(threadId);
  if (!io || !normalizedThreadId || !message) {
    return;
  }

  let target = io.to(`thread:${normalizedThreadId}`);

  if (senderSocketId) {
    target = target.except(senderSocketId);
  }

  target.emit('thread:new-message', {
    threadId: normalizedThreadId,
    message
  });
}

/**
 * Emit a thread status change event.
 * @param {string} threadId
 * @param {object} data
 */
function emitThreadStatusChange(threadId, data = {}) {
  const normalizedThreadId = normalizeId(threadId);
  if (!io || !normalizedThreadId) {
    return;
  }

  io.to(`thread:${normalizedThreadId}`).emit('thread:status-changed', {
    threadId: normalizedThreadId,
    ...data
  });
}

/**
 * Emit a thread list update to the firm room and, when available, the owning client user room.
 * @param {string} firmId
 * @param {object} threadSummary
 * @param {{ clientUserId?: string | import('mongoose').Types.ObjectId | null }} [options]
 */
function emitThreadListUpdate(firmId, threadSummary, options = {}) {
  const normalizedFirmId = normalizeId(firmId);
  const normalizedClientUserId = normalizeId(options.clientUserId);
  if (!io || !normalizedFirmId || !threadSummary) {
    return;
  }

  const payload = {
    thread: threadSummary
  };

  io.to(`firm:${normalizedFirmId}`).emit('thread:list-updated', payload);

  if (normalizedClientUserId) {
    io.to(`user:${normalizedClientUserId}`).emit('thread:list-updated', payload);
  }
}

/**
 * Emit a messages-read event to a thread room.
 * @param {string} threadId
 * @param {string} role
 */
function emitMessagesRead(threadId, role) {
  const normalizedThreadId = normalizeId(threadId);
  if (!io || !normalizedThreadId || !role) {
    return;
  }

  io.to(`thread:${normalizedThreadId}`).emit('thread:messages-read', {
    threadId: normalizedThreadId,
    role
  });
}

/**
 * Check whether a user currently has one or more active socket connections.
 * @param {string} userId
 * @returns {boolean}
 */
function isUserOnline(userId) {
  const normalizedUserId = normalizeId(userId);
  return !!normalizedUserId
    && onlineUsers.has(normalizedUserId)
    && onlineUsers.get(normalizedUserId).size > 0;
}

/**
 * Get all currently online user IDs.
 * @returns {string[]}
 */
function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Get current websocket metrics for health checks and monitoring.
 * @returns {{ totalConnections: number, onlineUsers: number, rooms: number }}
 */
function getMetrics() {
  return {
    totalConnections: io?.engine?.clientsCount || 0,
    onlineUsers: onlineUsers.size,
    rooms: getApplicationRoomCount()
  };
}

module.exports = {
  initialize,
  emitNotification,
  emitUnreadCount,
  emitNewMessage,
  emitThreadStatusChange,
  emitThreadListUpdate,
  emitMessagesRead,
  isUserOnline,
  getOnlineUserIds,
  getMetrics
};

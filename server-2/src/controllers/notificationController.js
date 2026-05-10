const Notification = require('../models/Notification');
const socketManager = require('../services/socketManager');
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../utils/errorHandler');

/**
 * @desc    Get all notifications for current user
 * @route   GET /api/notifications
 * @access  Private (CA-Admin, Client)
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const {
    type,
    subtype,
    isRead,
    isArchived = false,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const result = await Notification.getUserNotifications(req.user._id, {
    type,
    subtype,
    isRead: isRead !== undefined ? isRead === 'true' : undefined,
    isArchived: isArchived === 'true',
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder
  });

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private (CA-Admin, Client)
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);

  res.json({
    success: true,
    data: { count }
  });
});

/**
 * @desc    Get single notification
 * @route   GET /api/notifications/:id
 * @access  Private (CA-Admin, Client)
 */
exports.getNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipientId: req.user._id,
    isDeleted: false
  })
    .populate('recipientId', 'name email')
    .populate('firmId', 'firmName');

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  res.json({
    success: true,
    data: { notification }
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private (CA-Admin, Client)
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.markAsRead(req.params.id, req.user._id);

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  const unreadCount = await Notification.getUnreadCount(req.user._id);
  socketManager.emitUnreadCount(req.user._id.toString(), unreadCount);

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification }
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/mark-all-read
 * @access  Private (CA-Admin, Client)
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.markAllAsRead(req.user._id);
  socketManager.emitUnreadCount(req.user._id.toString(), 0);

  res.json({
    success: true,
    message: `${result.modifiedCount} notification(s) marked as read`,
    data: { count: result.modifiedCount }
  });
});

/**
 * @desc    Archive notification
 * @route   PUT /api/notifications/:id/archive
 * @access  Private (CA-Admin, Client)
 */
exports.archiveNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.archiveNotification(req.params.id, req.user._id);

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  const unreadCount = await Notification.getUnreadCount(req.user._id);
  socketManager.emitUnreadCount(req.user._id.toString(), unreadCount);

  res.json({
    success: true,
    message: 'Notification archived',
    data: { notification }
  });
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private (CA-Admin, Client)
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipientId: req.user._id
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  await notification.softDelete();
  const unreadCount = await Notification.getUnreadCount(req.user._id);
  socketManager.emitUnreadCount(req.user._id.toString(), unreadCount);

  res.json({
    success: true,
    message: 'Notification deleted'
  });
});

/**
 * @desc    Get notification statistics
 * @route   GET /api/notifications/stats
 * @access  Private (CA-Admin, Client)
 */
exports.getNotificationStats = asyncHandler(async (req, res) => {
  const [
    totalCount,
    unreadCount,
    archivedCount,
    typeStats,
    priorityStats
  ] = await Promise.all([
    // Total notifications
    Notification.countDocuments({
      recipientId: req.user._id,
      isDeleted: false,
      isArchived: false
    }),
    
    // Unread notifications
    Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false,
      isDeleted: false,
      isArchived: false
    }),
    
    // Archived notifications
    Notification.countDocuments({
      recipientId: req.user._id,
      isArchived: true,
      isDeleted: false
    }),
    
    // By type
    Notification.aggregate([
      {
        $match: {
          recipientId: req.user._id,
          isDeleted: false,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // By priority
    Notification.aggregate([
      {
        $match: {
          recipientId: req.user._id,
          isDeleted: false,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const typeStatsMap = {};
  typeStats.forEach(stat => {
    typeStatsMap[stat._id] = stat.count;
  });

  const priorityStatsMap = {};
  priorityStats.forEach(stat => {
    priorityStatsMap[stat._id] = stat.count;
  });

  res.json({
    success: true,
    data: {
      total: totalCount,
      unread: unreadCount,
      archived: archivedCount,
      byType: typeStatsMap,
      byPriority: priorityStatsMap
    }
  });
});

module.exports = exports;

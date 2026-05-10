const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationStats
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Routes accessible by both CA-Admin and Client
router.get(
  '/stats',
  authorize('CA-Admin', 'Client'),
  getNotificationStats
);

router.get(
  '/unread-count',
  authorize('CA-Admin', 'Client'),
  getUnreadCount
);

router.put(
  '/mark-all-read',
  authorize('CA-Admin', 'Client'),
  markAllAsRead
);

router.get(
  '/',
  authorize('CA-Admin', 'Client'),
  getNotifications
);

router.get(
  '/:id',
  authorize('CA-Admin', 'Client'),
  getNotification
);

router.put(
  '/:id/read',
  authorize('CA-Admin', 'Client'),
  markAsRead
);

router.put(
  '/:id/archive',
  authorize('CA-Admin', 'Client'),
  archiveNotification
);

router.delete(
  '/:id',
  authorize('CA-Admin', 'Client'),
  deleteNotification
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const threadController = require('../controllers/threadController');
const messageController = require('../controllers/messageController');

/**
 * Thread Routes
 * Base path: /api/threads
 */

// All routes require authentication
router.use(protect);

// Thread CRUD operations
router.route('/')
  .post(threadController.createThread)      // Create new thread (CA-Admin & Client)
  .get(threadController.getThreads);        // List threads with filters

// Thread statistics (CA-Admin & Client)
router.get('/stats', authorize('CA-Admin', 'Client'), threadController.getThreadStats);

// Single thread operations
router.route('/:id')
  .get(threadController.getThread)          // Get thread with messages
  .put(authorize('CA-Admin'), threadController.updateThread)    // Update thread
  .delete(authorize('CA-Admin'), threadController.deleteThread); // Delete thread

// Thread status operations (CA-Admin only)
router.put('/:id/resolve', authorize('CA-Admin'), threadController.resolveThread);
router.put('/:id/close', authorize('CA-Admin'), threadController.closeThread);
router.put('/:id/reopen', authorize('CA-Admin'), threadController.reopenThread);

/**
 * Message Routes (nested under threads)
 * Base path: /api/threads/:threadId/messages
 */

// Message CRUD operations
router.route('/:threadId/messages')
  .post(messageController.createMessage)    // Add message to thread
  .get(messageController.getMessages);      // Get messages for thread

// Pending payments for a thread
router.get('/:threadId/messages/pending-payments', messageController.getPendingPaymentMessages);

// Single message operations
router.route('/:threadId/messages/:messageId')
  .put(messageController.updateMessage)     // Edit message (before read)
  .delete(messageController.deleteMessage); // Delete message (before read)

// Message read status
router.put('/:threadId/messages/:messageId/read', messageController.markMessageAsRead);

// Payment operations
router.put('/:threadId/messages/:messageId/payment-complete', messageController.markPaymentComplete);
router.put('/:threadId/messages/:messageId/waive-payment', authorize('CA-Admin'), messageController.waivePayment);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  initiatePaymentOrder,
  verifyPayment,
  getPayments,
  getPayment,
  getMyPayments,
  handleWebhook
} = require('../controllers/paymentController');
const { getEarnings } = require('../controllers/earningsController');
const { protect, authorize } = require('../middleware/auth');

// Webhook route (no auth required)
router.post('/webhook', handleWebhook);

// Public verification route
router.post('/verify', verifyPayment);

// All other routes require authentication
router.use(protect);

// CA-Admin routes
router.get(
  '/',
  authorize('CA-Admin'),
  getPayments
);

// Earnings route (CA-Admin only)
router.get(
  '/earnings',
  authorize('CA-Admin'),
  getEarnings
);

// Client routes
router.post(
  '/initiate-order',
  authorize('Client'),
  initiatePaymentOrder
);

router.get(
  '/client/my-payments',
  authorize('Client'),
  getMyPayments
);

// Shared routes
router.get(
  '/:id',
  authorize('CA-Admin', 'Client'),
  getPayment
);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getPlans,
  getPlan,
  purchase,
  verifySubscription,
  cancel,
  getSubscription,
  getUsage
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @desc    Get all available subscription plans (Pro billing options)
 * @route   GET /api/subscriptions/plans
 * @access  Public
 */
router.get('/plans', getPlans);

/**
 * @desc    Get a specific subscription plan by ID
 * @route   GET /api/subscriptions/plans/:id
 * @access  Public
 */
router.get('/plans/:id', getPlan);

// ============================================
// PROTECTED ROUTES - Authentication required
// ============================================
router.use(protect);

/**
 * @desc    Get subscription usage statistics (limits, counters)
 * @route   GET /api/subscriptions/usage
 * @access  Private (CA-Admin)
 */
router.get('/usage', authorize('CA-Admin'), getUsage);

/**
 * @desc    Purchase/Upgrade to Pro subscription
 * @route   POST /api/subscriptions/purchase
 * @access  Private (CA-Admin)
 */
router.post('/purchase', authorize('CA-Admin'), purchase);

/**
 * @desc    Verify and sync subscription status from Razorpay
 * @route   POST /api/subscriptions/verify
 * @access  Private (CA-Admin)
 * 
 * CRITICAL: This endpoint solves the webhook failure problem
 * - Called by client after Razorpay payment completion
 * - Fetches subscription status directly from Razorpay
 * - Activates firm subscription if payment successful
 * - Works even if webhook fails
 */
router.post('/verify', authorize('CA-Admin'), verifySubscription);

/**
 * @desc    Get subscription details by Payment ID
 * @route   GET /api/subscriptions/:id
 * @access  Private (CA-Admin)
 */
router.get('/:id', authorize('CA-Admin'), getSubscription);

/**
 * @desc    Cancel subscription
 * @route   POST /api/subscriptions/:id/cancel
 * @access  Private (CA-Admin)
 */
router.post('/:id/cancel', authorize('CA-Admin'), cancel);

module.exports = router;

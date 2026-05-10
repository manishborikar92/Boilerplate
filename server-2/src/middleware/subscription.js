/**
 * Subscription Enforcement Middleware (REFACTORED)
 * 
 * Enforces plan limits based on firm's subscription status
 * 
 * Last Updated: January 29, 2026
 * Version: 5.0 - Refactored for clarity and consistency
 * 
 * 2-Tier Model:
 * - Starter (plan_ca_flow_free): 5 clients, 25 records/month, email only
 * - Pro (plan_ca_flow_pro): 100 clients, 500 records/month, all notifications
 */

const { asyncHandler, AuthorizationError } = require('../utils/errorHandler');
const subscriptionService = require('../services/subscriptionService');

/**
 * Middleware: Check client limit before creating a new client
 * 
 * Usage: router.post('/clients', checkClientLimit, createClient)
 * 
 * Enforces: PLAN_CONFIG[planId].maxClients
 * - Starter: 5 clients max
 * - Pro: 100 clients max
 */
const checkClientLimit = asyncHandler(async (req, res, next) => {
  const firmId = req.user.firmId;

  if (!firmId) {
    throw new AuthorizationError('Please complete your firm profile before adding clients');
  }

  // This will throw if limit is reached
  const { limits, clientCount } = await subscriptionService.assertClientLimit(firmId);

  // Attach data to request for potential use in controller
  req.subscriptionLimits = limits;
  req.currentClientCount = clientCount;

  next();
});

/**
 * Middleware Factory: Check monthly record limit
 * 
 * Usage: 
 *   router.post('/documents/upload', checkMonthlyLimit('Document'), uploadDocument)
 *   router.post('/payments/create', checkMonthlyLimit('Payment'), createPayment)
 * 
 * Enforces: PLAN_CONFIG[planId].monthlyRecords
 * - Starter: 25 records/month
 * - Pro: 500 records/month
 * 
 * Note: Monthly limits reset automatically at the start of each calendar month
 * because we count records created >= startOfMonth.
 * 
 * @param {string} modelType - 'Document' or 'Payment'
 * @returns {Function} Express middleware
 */
const checkMonthlyLimit = (modelType) => {
  return asyncHandler(async (req, res, next) => {
    const firmId = req.user.firmId;

    // This will throw if limit is reached
    const { limits, monthlyCount, monthStart } = await subscriptionService.assertMonthlyLimit({
      firmId,
      modelType,
      increment: 0
    });

    // Attach data to request for potential use in controller
    req.subscriptionLimits = limits;
    req.monthlyCount = monthlyCount;
    req.monthStart = monthStart;

    next();
  });
};

module.exports = {
  checkClientLimit,
  checkMonthlyLimit
};

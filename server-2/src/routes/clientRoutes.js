const express = require('express');
const router = express.Router();
const {
  addClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
  resendCredentials
} = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');
const { requireEmailVerification } = require('../middleware/emailVerification');
const {
  validate,
  addClientValidation,
  updateClientValidation
} = require('../middleware/validation');
const { checkClientLimit } = require('../middleware/subscription');

// All routes require authentication
router.use(protect);

// CA-Admin only routes (require email verification)
// checkClientLimit enforces subscription plan client limits
router.post(
  '/',
  authorize('CA-Admin'),
  requireEmailVerification,
  checkClientLimit, // Enforces: Starter=5, Pro=100 clients max
  addClientValidation,
  validate,
  addClient
);

router.put(
  '/:id',
  authorize('CA-Admin'),
  requireEmailVerification,
  updateClientValidation,
  validate,
  updateClient
);

router.delete(
  '/:id',
  authorize('CA-Admin'),
  requireEmailVerification,
  deleteClient
);

router.post(
  '/:id/resend-credentials',
  authorize('CA-Admin'),
  requireEmailVerification,
  resendCredentials
);

// Routes accessible by CA-Admin only
router.get(
  '/',
  authorize('CA-Admin'),
  getClients
);

router.get(
  '/:id',
  authorize('CA-Admin'),
  getClient
);

module.exports = router;

const express = require('express');
const router = express.Router();
const Firm = require('../models/Firm');
const {
  completeProfile,
  updateFirm,
  getFirm,
  getMyFirm,
  updateAdminProfile,
  deleteFirm
} = require('../controllers/firmController');
const { asyncHandler, ConflictError } = require('../utils/errorHandler');
const { protect, authorize } = require('../middleware/auth');
const { requireEmailVerification } = require('../middleware/emailVerification');
const {
  validate,
  parseFormDataJSON,
  completeProfileValidation,
  updateFirmValidation,
  updateAdminProfileValidation
} = require('../middleware/validation');
const {
  uploadFirmLogo,
  uploadFirmProfile,
  uploadAvatar,
  handleUploadError
} = require('../middleware/upload');

const rejectIfFirmExists = asyncHandler(async (req, res, next) => {
  const existingFirm = await Firm.findByAdmin(req.user._id);
  if (existingFirm) {
    throw new ConflictError('Firm profile already exists. Use update endpoint instead.');
  }
  next();
});

// All routes require authentication
router.use(protect);

// CA-Admin only routes
// Note: complete-profile does NOT require email verification to allow users to complete profile first
router.post(
  '/complete-profile',
  authorize('CA-Admin'),
  rejectIfFirmExists,
  uploadFirmProfile.fields([
    { name: 'firmLogo', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
  ]),
  handleUploadError,
  parseFormDataJSON(['primaryServices', 'customServices', 'address', 'bankDetails']),
  completeProfileValidation,
  validate,
  completeProfile
);

router.put(
  '/update-profile',
  authorize('CA-Admin'),
  requireEmailVerification,
  uploadAvatar.single('profilePhoto'),
  handleUploadError,
  updateAdminProfileValidation,
  validate,
  updateAdminProfile
);

router.put(
  '/:id',
  authorize('CA-Admin'),
  requireEmailVerification,
  uploadFirmLogo.single('firmLogo'),
  handleUploadError,
  parseFormDataJSON(['primaryServices', 'customServices', 'address', 'bankDetails']),
  updateFirmValidation,
  validate,
  updateFirm
);

router.delete(
  '/:id',
  authorize('CA-Admin'),
  requireEmailVerification,
  deleteFirm
);

router.get('/my-firm', authorize('CA-Admin', 'Client'), getMyFirm);
router.get('/:id', authorize('CA-Admin'), getFirm);

module.exports = router;

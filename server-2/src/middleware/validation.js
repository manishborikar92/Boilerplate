const { body, validationResult } = require('express-validator');
const phoneNumberUtil = require('../utils/phoneNumber');

// Validation middleware to check for errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Middleware to parse JSON fields in multipart/form-data
const parseFormDataJSON = (fields = []) => {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (error) {
            // If parsing fails, leave as string (validation will catch it)
          }
        }
      });

      const hasLegacyBankFields =
        req.body.bankName ||
        req.body.accountHolderName ||
        req.body.accountNumber ||
        req.body.ifscCode ||
        req.body.accountType ||
        req.body.branchName;

      if (!req.body.bankDetails && hasLegacyBankFields) {
        req.body.bankDetails = {
          bankName: req.body.bankName,
          accountHolderName: req.body.accountHolderName,
          accountNumber: req.body.accountNumber,
          ifscCode: req.body.ifscCode,
          accountType: req.body.accountType,
          branchName: req.body.branchName
        };
      }
    }
    next();
  };
};

// Register validation rules (CA-Admin only)
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('role')
    .optional()
    .custom((value) => {
      if (value && value !== 'CA-Admin') {
        throw new Error('Only CA-Admin accounts can be registered directly');
      }
      return true;
    })
];

// Login validation rules (supports both email and userId)
const loginValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('userId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('User ID cannot be empty'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  // Custom validation to ensure either email or userId is provided
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.userId) {
      throw new Error('Please provide either email or userId');
    }
    return true;
  })
];

// Google sign-in validation
const googleSignInValidation = [
  body('idToken')
    .notEmpty()
    .withMessage('Firebase ID token is required')
];

// Refresh token validation
const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Email validation
const emailValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

// Password validation (for reset)
const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character')
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('New password must contain at least one special character')
];

const deleteAccountValidation = [
  body('password')
    .optional()
    .notEmpty()
    .withMessage('Password is required')
];

// Complete profile validation (CA Admin post-signup)
const completeProfileValidation = [
  body('firmName')
    .trim()
    .notEmpty()
    .withMessage('Firm name is required'),
  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required'),
  body('officialEmail')
    .isEmail()
    .withMessage('Please provide a valid official email')
    .normalizeEmail(),
  body('contactNumber')
    .trim()
    .notEmpty()
    .withMessage('Contact number is required')
    .custom((value) => {
      if (!phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid contact number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('alternateContactNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid alternate contact number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('gstin')
    .optional()
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  body('pan')
    .trim()
    .notEmpty()
    .withMessage('PAN is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('PAN must be 10 characters'),
  body('bankDetails.bankName')
    .trim()
    .notEmpty()
    .withMessage('Bank name is required'),
  body('bankDetails.accountHolderName')
    .trim()
    .notEmpty()
    .withMessage('Account holder name is required'),
  body('bankDetails.accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .matches(/^\d{9,18}$/)
    .withMessage('Account number must be 9-18 digits'),
  body('bankDetails.ifscCode')
    .trim()
    .notEmpty()
    .withMessage('IFSC code is required')
    .isLength({ min: 11, max: 11 })
    .withMessage('IFSC code must be 11 characters')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code format'),
  body('address.pinCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('PIN code must be 6 digits'),
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country name cannot exceed 100 characters'),
  body('bankDetails.accountType')
    .optional()
    .isIn(['Savings', 'Current', 'Overdraft'])
    .withMessage('Invalid account type'),
  body('bankDetails.branchName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Branch name cannot exceed 100 characters'),
  body('primaryServices')
    .optional()
    .isArray()
    .withMessage('Primary services must be an array'),
  body('primaryServices.*')
    .optional()
    .isIn([
      'Audit & Assurance',
      'Taxation & GST',
      'Accounting & Bookkeeping',
      'Company Incorporation',
      'Compliance & Legal',
      'Financial Advisory',
      'Others'
    ])
    .withMessage('Invalid service type'),
  body('whatsappNotification')
    .optional()
    .isBoolean()
    .withMessage('WhatsApp notification must be a boolean'),
  body('emailNotification')
    .optional()
    .isBoolean()
    .withMessage('Email notification must be a boolean'),
  body('smsNotification')
    .optional()
    .isBoolean()
    .withMessage('SMS notification must be a boolean')
];

// Update firm validation
const updateFirmValidation = [
  body('firmName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Firm name cannot be empty'),
  body('registrationNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Registration number cannot be empty'),
  body('officialEmail')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid official email')
    .normalizeEmail(),
  body('contactNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid contact number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('alternateContactNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid alternate contact number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('gstin')
    .optional()
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  body('pan')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('PAN must be 10 characters'),
  body('websiteUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City name cannot exceed 100 characters'),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State name cannot exceed 100 characters'),
  body('address.pinCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('PIN code must be 6 digits'),
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country name cannot exceed 100 characters'),
  body('bankDetails.bankName')
    .optional()
    .trim(),
  body('bankDetails.accountHolderName')
    .optional()
    .trim(),
  body('bankDetails.accountNumber')
    .optional()
    .trim()
    .matches(/^\d{9,18}$/)
    .withMessage('Account number must be 9-18 digits'),
  body('bankDetails.ifscCode')
    .optional()
    .trim()
    .isLength({ min: 11, max: 11 })
    .withMessage('IFSC code must be 11 characters')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code format'),
  body('bankDetails.accountType')
    .optional()
    .isIn(['Savings', 'Current', 'Overdraft'])
    .withMessage('Invalid account type'),
  body('bankDetails.branchName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Branch name cannot exceed 100 characters'),
  body('primaryServices')
    .optional()
    .isArray()
    .withMessage('Primary services must be an array'),
  body('primaryServices.*')
    .optional()
    .isIn([
      'Audit & Assurance',
      'Taxation & GST',
      'Accounting & Bookkeeping',
      'Company Incorporation',
      'Compliance & Legal',
      'Financial Advisory',
      'Others'
    ])
    .withMessage('Invalid service type'),
  body('whatsappNotification')
    .optional()
    .isBoolean()
    .withMessage('WhatsApp notification must be a boolean'),
  body('emailNotification')
    .optional()
    .isBoolean()
    .withMessage('Email notification must be a boolean'),
  body('smsNotification')
    .optional()
    .isBoolean()
    .withMessage('SMS notification must be a boolean')
];

// Update admin profile validation
const updateAdminProfileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('professionalTitle')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Professional title cannot be empty'),
  body('phoneNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('profilePhoto')
    .optional()
    .isURL()
    .withMessage('Profile photo must be a valid URL')
];

// Add client validation
const addClientValidation = [
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ min: 2 })
    .withMessage('Company name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('companyType')
    .notEmpty()
    .withMessage('Company type is required')
    .isIn(['Proprietorship', 'Partnership', 'Pvt. Ltd.', 'LLP', 'Public Ltd.', 'NGO', 'Trust', 'Society'])
    .withMessage('Invalid company type'),
  body('gstin')
    .optional()
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  body('pan')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('PAN must be 10 characters'),
  body('address.pinCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('PIN code must be 6 digits')
];

// Update client validation
const updateClientValidation = [
  body('companyName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company name cannot be empty')
    .isLength({ min: 2 })
    .withMessage('Company name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phoneNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !phoneNumberUtil.isValidFormat(value)) {
        throw new Error('Please provide a valid phone number (e.g., +91 9822685547, 919822685547, or 9822685547)');
      }
      return true;
    }),
  body('companyType')
    .optional()
    .isIn(['Proprietorship', 'Partnership', 'Pvt. Ltd.', 'LLP', 'Public Ltd.', 'NGO', 'Trust', 'Society'])
    .withMessage('Invalid company type'),
  body('gstin')
    .optional()
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  body('pan')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('PAN must be 10 characters'),
  body('address.pinCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('PIN code must be 6 digits'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

module.exports = {
  validate,
  parseFormDataJSON,
  registerValidation,
  loginValidation,
  googleSignInValidation,
  refreshTokenValidation,
  emailValidation,
  passwordValidation,
  changePasswordValidation,
  deleteAccountValidation,
  completeProfileValidation,
  updateFirmValidation,
  updateAdminProfileValidation,
  addClientValidation,
  updateClientValidation
};

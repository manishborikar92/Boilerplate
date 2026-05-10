const { 
  asyncHandler, 
  AuthorizationError 
} = require('../utils/errorHandler');

// Middleware to check if user's email is verified
const requireEmailVerification = asyncHandler(async (req, res, next) => {
  // Check if user exists (should be set by protect middleware)
  if (!req.user) {
    throw new AuthorizationError('Authentication required');
  }

  // Check if email is verified
  if (!req.user.isEmailVerified) {
    throw new AuthorizationError(
      'Email verification required. Please verify your email to access this feature.'
    );
  }

  next();
});

module.exports = { 
  requireEmailVerification
};

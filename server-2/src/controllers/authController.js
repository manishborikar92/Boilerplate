const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const Firm = require('../models/Firm');
const Client = require('../models/Client');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const Thread = require('../models/Thread');
const Message = require('../models/Message');
const { verifyFirebaseToken } = require('../config/firebase');
const notificationService = require('../services/notificationService');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiration,
  getRefreshTokenExpirationDate
} = require('../utils/jwt');
const { blacklistToken } = require('../utils/tokenBlacklist');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} = require('../utils/email');
const {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');

// @desc    Register user with email/password (CA-Admin only)
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, password, name, role } = req.body;

  // Validation
  if (!email || !password || !name) {
    throw new ValidationError('Please provide email, password, and name');
  }

  // Only allow CA-Admin registration
  if (role && role !== 'CA-Admin') {
    throw new AuthorizationError('Only CA-Admin accounts can be registered directly');
  }

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  // Create user (always CA-Admin for direct registration)
  const user = await User.create({
    email,
    password,
    name,
    role: 'CA-Admin'
  });

  // Generate email verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email (non-blocking)
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendVerificationEmail(user.email, user.name, verificationUrl);
  } catch (error) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to send verification email', { error: error.message, email: user.email });
    // Continue with registration even if email fails
  }

  // NOTE: Free plan is now the default state and not stored in DB.
  // No subscription record is created initially.
  const { logger } = require('../middleware/logger');
  logger.info('User registered (Default Free state)', { userId: user._id, email: user.email });

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Create session (max 3 concurrent sessions per user)
  try {
    await Session.createSession({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection?.remoteAddress,
      expiresAt: getRefreshTokenExpirationDate()
    }, 3); // Max 3 sessions
  } catch (sessionError) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to create session during registration', { error: sessionError.message, userId: user._id });
    // Continue with registration even if session creation fails
  }

  // Remove sensitive data
  user.password = undefined;
  user.emailVerificationToken = undefined;

  res.status(201).json({
    success: true,
    message: 'User registered successfully with Free plan. Please check your email to verify your account.',
    data: {
      user,
      accessToken,
      refreshToken
    }
  });
});

// @desc    Login user with email/password or userId/password
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, userId, password } = req.body;

  // Validation
  if ((!email && !userId) || !password) {
    throw new ValidationError('Please provide email/userId and password');
  }

  let user;

  // For Client login with userId
  if (userId) {
    // Find client by userId
    const Client = require('../models/Client');
    const client = await Client.findByUserId(userId);

    if (!client) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if client has a user account
    if (!client.userAccountId) {
      throw new AuthenticationError('Account not activated. Please contact your CA firm.');
    }

    // Get the user account
    user = await User.findById(client.userAccountId).select('+password');

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if account is deleted
    if (user.isDeleted) {
      throw new AuthorizationError('Account has been deleted');
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new AuthorizationError('Account is locked due to multiple failed login attempts. Please try again later.');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      throw new AuthenticationError('Invalid credentials');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();
  } else {
    // For CA-Admin login with email
    user = await User.findByEmail(email);

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Get password
    user = await User.findById(user._id).select('+password');

    // Only CA-Admin can login with email
    if (user.role !== 'CA-Admin') {
      throw new AuthorizationError('Please use your User ID to login');
    }

    // Check if account is deleted
    if (user.isDeleted) {
      throw new AuthorizationError('Account has been deleted');
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new AuthorizationError('Account is locked due to multiple failed login attempts. Please try again later.');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      throw new AuthenticationError('Invalid credentials');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Create login notification (non-blocking)
  try {
    if (user.role === 'Client') {
      // Notify firm admins of client login
      const client = await Client.findOne({ userAccountId: user._id });
      if (client) {
        // Check if this is first login
        if (!client.firstLoginAt) {
          await notificationService.notifyClientFirstLogin(client, user);
          await client.recordFirstLogin();
        } else {
          await notificationService.notifyClientLogin(client, user);
        }
      }
    }
  } catch (notificationError) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to create login notification', { 
      error: notificationError.message, 
      userId: user._id 
    });
    // Continue with login even if notification fails
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Create session (max 3 concurrent sessions per user)
  try {
    await Session.createSession({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection?.remoteAddress,
      expiresAt: getRefreshTokenExpirationDate()
    }, 3); // Max 3 sessions
  } catch (sessionError) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to create session', { error: sessionError.message, userId: user._id });
    // Continue with login even if session creation fails
  }

  // Remove password from response
  user.password = undefined;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      accessToken,
      refreshToken
    }
  });
});

// @desc    Google Sign-In (Firebase)
// @route   POST /api/auth/google
// @access  Public
const googleSignIn = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new ValidationError('Firebase ID token is required');
  }

  // Verify Firebase token
  const decodedToken = await verifyFirebaseToken(idToken);

  const { uid, email, name, picture } = decodedToken;

  // Find or create user
  let user = await User.findOne({ firebaseUid: uid });

  if (!user) {
    // Check if email already exists
    user = await User.findOne({ email });

    if (user) {
      // Link Firebase UID to existing account (auto-verify email)
      user.firebaseUid = uid;
      user.photoURL = picture;
      user.isEmailVerified = true;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user (Google users are auto-verified as CA-Admin)
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        firebaseUid: uid,
        photoURL: picture,
        role: 'CA-Admin',
        isEmailVerified: true,
        lastLogin: new Date()
      });

      // Send welcome email for new users (non-blocking)
      try {
        await sendWelcomeEmail(user.email, user.name, user.role);
      } catch (error) {
        const { logger } = require('../middleware/logger');
        logger.warn('Failed to send welcome email', { error: error.message, email: user.email });
        // Continue with registration even if email fails
      }

      // NOTE: Free plan is now the default state and not stored in DB.
      // No subscription record is created initially.
      const { logger } = require('../middleware/logger');
      logger.info('User registered (Default Free state)', { userId: user._id, email: user.email });
    }
  } else {
    // Update last login
    user.lastLogin = new Date();
    await user.save();
  }

  // Generate JWT tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Create session (max 3 concurrent sessions per user)
  try {
    await Session.createSession({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection?.remoteAddress,
      expiresAt: getRefreshTokenExpirationDate()
    }, 3);
  } catch (sessionError) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to create session for Google Sign-In', { error: sessionError.message, userId: user._id });
  }

  // Remove sensitive data
  user.password = undefined;
  user.firebaseUid = undefined; // Optional: hide technical ID

  res.status(200).json({
    success: true,
    message: 'Google sign-in successful',
    data: {
      user,
      accessToken,
      refreshToken
    }
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Validate session exists and is active
  const session = await Session.validateAndRefreshSession(refreshToken);
  if (!session) {
    throw new AuthenticationError('Invalid or expired session. Please login again.');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Get user
  const user = await User.findById(decoded.userId);

  if (!user || user.isDeleted) {
    throw new AuthenticationError('User not found or account deleted');
  }

  // Generate new tokens (refresh token rotation for security)
  const newAccessToken = generateAccessToken(user._id, user.role);
  const newRefreshToken = generateRefreshToken(user._id);

  // Rotate the refresh token in the session
  try {
    await Session.rotateRefreshToken(
      refreshToken,
      newRefreshToken,
      getRefreshTokenExpirationDate()
    );
  } catch (rotationError) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to rotate refresh token', { error: rotationError.message, userId: user._id });
    // Continue with response even if rotation fails
  }

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken // Return new refresh token for rotation
    }
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.status(200).json({
    success: true,
    data: {
      user
    }
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Get the access token from the request header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    const accessToken = authHeader.split(' ')[1];

    // Blacklist the access token to prevent reuse
    const expiresAt = getTokenExpiration(accessToken);
    blacklistToken(accessToken, expiresAt);
  }

  // Invalidate the session if refresh token provided
  if (refreshToken) {
    try {
      await Session.invalidateSession(refreshToken);
    } catch (sessionError) {
      const { logger } = require('../middleware/logger');
      logger.warn('Failed to invalidate session on logout', { error: sessionError.message });
    }
  }

  const { logger } = require('../middleware/logger');
  logger.info('User logged out', { userId: req.user?._id });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Invalidate all sessions for this user
  await Session.invalidateAllUserSessions(userId, 'forced_logout');

  const { logger } = require('../middleware/logger');
  logger.info('User logged out from all devices', { userId });

  res.status(200).json({
    success: true,
    message: 'Logged out from all devices successfully'
  });
});

// @desc    Get active sessions
// @route   GET /api/auth/sessions
// @access  Private
const getActiveSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sessions = await Session.getActiveSessions(userId);

  // Format sessions for response (hide sensitive data)
  const formattedSessions = sessions.map(session => ({
    id: session._id,
    deviceType: session.deviceType,
    clientName: session.clientName,
    ipAddress: session.ipAddress,
    lastActivityAt: session.lastActivityAt,
    createdAt: session.createdAt
  }));

  res.status(200).json({
    success: true,
    data: {
      sessions: formattedSessions,
      count: formattedSessions.length
    }
  });
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Hash the token to compare with database
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new ValidationError('Invalid or expired verification token');
  }

  // Update user
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Send welcome email after successful verification (non-blocking)
  try {
    await sendWelcomeEmail(user.email, user.name, user.role);
  } catch (error) {
    const { logger } = require('../middleware/logger');
    logger.warn('Failed to send welcome email', { error: error.message, email: user.email });
    // Continue even if welcome email fails
  }

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Please provide email address');
  }

  // Find user
  const user = await User.findOne({ email });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if already verified
  if (user.isEmailVerified) {
    throw new ValidationError('Email is already verified');
  }

  // Generate new verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  await sendVerificationEmail(user.email, user.name, verificationUrl);

  res.status(200).json({
    success: true,
    message: 'Verification email sent successfully'
  });
});

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Please provide email address');
  }

  // Find user
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not for security
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Send reset email
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    // If email fails, clear the reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    const { logger } = require('../middleware/logger');
    logger.error('Failed to send password reset email', { error: error.message, email: user.email });

    throw new InternalError('Error sending password reset email');
  }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    throw new ValidationError('Please provide new password');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }

  // Hash the token to compare with database
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  }).select('+password');

  if (!user) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Generate new tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    data: {
      accessToken,
      refreshToken
    }
  });
});

// @desc    Change password (for logged in users)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Please provide current and new password');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user.password) {
    throw new ValidationError('Cannot change password for social login accounts');
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Delete account (soft delete)
// @route   DELETE /api/auth/delete-account
// @access  Private
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.password) {
    if (!password) {
      throw new ValidationError('Password is required to delete this account');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Password is incorrect');
    }
  }

  if (user.role === 'CA-Admin' && user.firmId) {
    const firm = await Firm.findOne({ _id: user.firmId, isDeleted: false });

    if (firm) {
      await firm.softDelete(user._id);
      const deletedAt = new Date();

      await Promise.all([
        Client.updateMany(
          { firmId: firm._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletedBy: user._id } }
        ),
        Document.updateMany(
          { firmId: firm._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletedBy: user._id } }
        ),
        Folder.updateMany(
          { firmId: firm._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletedBy: user._id } }
        ),
        Thread.updateMany(
          { firmId: firm._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletedBy: user._id } }
        ),
        Message.updateMany(
          { firmId: firm._id, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletedBy: user._id } }
        )
      ]);
    }
  }

  await user.softDelete(user._id);

  await Session.invalidateAllUserSessions(user._id, 'account_deleted');

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    const accessToken = authHeader.split(' ')[1];
    const expiresAt = getTokenExpiration(accessToken);
    blacklistToken(accessToken, expiresAt);
  }

  const { logger } = require('../middleware/logger');
  logger.info('Account deleted', { userId: user._id, role: user.role });

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

module.exports = {
  register,
  login,
  googleSignIn,
  refreshAccessToken,
  getMe,
  logout,
  logoutAllDevices,
  getActiveSessions,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount
};

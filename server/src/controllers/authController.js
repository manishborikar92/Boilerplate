const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { verifyFirebaseToken } = require('../config/firebase');
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

const register = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    if (await User.findOne({ email })) {
        throw new ConflictError('User already exists with this email');
    }

    const user = await User.create({
        email,
        password,
        name
    });

    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendVerificationEmail(user.email, user.name, verificationUrl);
    } catch (error) {
        console.warn('Failed to send verification email:', error);
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    try {
        await Session.createSession({
            userId: user._id, refreshToken,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            expiresAt: getRefreshTokenExpirationDate()
        });
    } catch (e) { console.warn('Session creation failed', e); }

    user.password = undefined;
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user, accessToken, refreshToken }
    });
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isDeleted: false }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        if (user) await user.incLoginAttempts();
        throw new AuthenticationError('Invalid credentials');
    }

    if (user.isLocked) throw new AuthorizationError('Account is locked');

    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    try {
        await Session.createSession({
            userId: user._id, refreshToken,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            expiresAt: getRefreshTokenExpirationDate()
        });
    } catch (e) { console.warn('Session creation failed', e); }

    user.password = undefined;
    res.status(200).json({
        success: true,
        data: { user, accessToken, refreshToken }
    });
});

const googleSignIn = asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    const { uid, email, name, picture } = await verifyFirebaseToken(idToken);

    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
        user = await User.findOne({ email });
        if (user) {
            user.firebaseUid = uid;
            user.photoURL = picture;
            user.isEmailVerified = true;
            await user.save();
        } else {
            user = await User.create({
                email, name: name || email.split('@')[0], firebaseUid: uid, photoURL: picture, role: 'User', isEmailVerified: true
            });
            sendWelcomeEmail(user.email, user.name).catch(console.warn);
        }
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    try {
        await Session.createSession({
            userId: user._id, refreshToken,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            expiresAt: getRefreshTokenExpirationDate()
        });
    } catch (e) { console.warn('Session creation failed', e); }

    res.status(200).json({ success: true, data: { user, accessToken, refreshToken } });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!await Session.validateAndRefreshSession(refreshToken)) {
        throw new AuthenticationError('Invalid or expired session');
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    if (!user || user.isDeleted) throw new AuthenticationError('User not found');

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await Session.rotateRefreshToken(refreshToken, newRefreshToken, getRefreshTokenExpirationDate());

    res.status(200).json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
});

const getMe = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: { user: req.user } });
});

const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) blacklistToken(token, getTokenExpiration(token));
    if (refreshToken) await Session.invalidateSession(refreshToken);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

const logoutAllDevices = asyncHandler(async (req, res) => {
    await Session.invalidateAllUserSessions(req.user._id);
    res.status(200).json({ success: true, message: 'Logged out from all devices' });
});

const getActiveSessions = asyncHandler(async (req, res) => {
    const sessions = await Session.getActiveSessions(req.user._id);
    res.status(200).json({ success: true, data: { sessions } });
});

const verifyEmail = asyncHandler(async (req, res) => {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ emailVerificationToken: hashedToken, emailVerificationExpires: { $gt: Date.now() } });

    if (!user) throw new ValidationError('Invalid or expired token');

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();
    res.status(200).json({ success: true, message: 'Email verified' });
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) throw new NotFoundError('User not found');
    if (user.isEmailVerified) throw new ValidationError('Already verified');

    const token = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const url = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    await sendVerificationEmail(user.email, user.name, url);
    res.status(200).json({ success: true, message: 'Verification email sent' });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
        const token = user.generatePasswordResetToken();
        await user.save({ validateBeforeSave: false });
        const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        await sendPasswordResetEmail(user.email, user.name, url);
    }
    res.status(200).json({ success: true, message: 'If account exists, email sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } }).select('+password');

    if (!user) throw new ValidationError('Invalid token');

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    await user.save();

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    res.status(200).json({ success: true, data: { accessToken, refreshToken } });
});

const changePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user.password) throw new ValidationError('Social login user cannot change password');
    if (!(await user.comparePassword(req.body.currentPassword))) throw new AuthenticationError('Incorrect current password');

    user.password = req.body.newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed' });
});

module.exports = {
    register, login, googleSignIn, refreshAccessToken, getMe, logout, logoutAllDevices,
    getActiveSessions, verifyEmail, resendVerificationEmail, forgotPassword, resetPassword, changePassword
};

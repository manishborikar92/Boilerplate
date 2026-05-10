const mongoose = require('mongoose');

const buildAuthController = (overrides = {}) => {
  jest.resetModules();

  const userModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn()
  };
  const sessionModel = {
    createSession: jest.fn(),
    validateAndRefreshSession: jest.fn(),
    rotateRefreshToken: jest.fn(),
    invalidateSession: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
    getActiveSessions: jest.fn()
  };
  const firmModel = { findOne: jest.fn() };
  const clientModel = {
    findByUserId: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn()
  };
  const documentModel = { updateMany: jest.fn() };
  const folderModel = { updateMany: jest.fn() };
  const threadModel = { updateMany: jest.fn() };
  const messageModel = { updateMany: jest.fn() };

  const jwtUtils = {
    generateAccessToken: jest.fn(() => 'access'),
    generateRefreshToken: jest.fn(() => 'refresh'),
    verifyRefreshToken: jest.fn(() => ({ userId: new mongoose.Types.ObjectId().toString() })),
    getTokenExpiration: jest.fn(() => Date.now() + 1000),
    getRefreshTokenExpirationDate: jest.fn(() => new Date(Date.now() + 1000))
  };
  const emailUtils = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendWelcomeEmail: jest.fn()
  };
  const tokenBlacklist = { blacklistToken: jest.fn() };
  const firebaseConfig = { verifyFirebaseToken: jest.fn() };
  const notificationService = {
    notifyClientFirstLogin: jest.fn(),
    notifyClientLogin: jest.fn()
  };

  Object.assign(userModel, overrides.User || {});
  Object.assign(sessionModel, overrides.Session || {});
  Object.assign(firmModel, overrides.Firm || {});
  Object.assign(clientModel, overrides.Client || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(folderModel, overrides.Folder || {});
  Object.assign(threadModel, overrides.Thread || {});
  Object.assign(messageModel, overrides.Message || {});
  Object.assign(jwtUtils, overrides.jwt || {});
  Object.assign(emailUtils, overrides.email || {});
  Object.assign(tokenBlacklist, overrides.tokenBlacklist || {});
  Object.assign(firebaseConfig, overrides.firebase || {});
  Object.assign(notificationService, overrides.notificationService || {});

  jest.doMock('../../src/models/User', () => userModel);
  jest.doMock('../../src/models/Session', () => sessionModel);
  jest.doMock('../../src/models/Firm', () => firmModel);
  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/models/Folder', () => folderModel);
  jest.doMock('../../src/models/Thread', () => threadModel);
  jest.doMock('../../src/models/Message', () => messageModel);
  jest.doMock('../../src/utils/jwt', () => jwtUtils);
  jest.doMock('../../src/utils/email', () => emailUtils);
  jest.doMock('../../src/utils/tokenBlacklist', () => tokenBlacklist);
  jest.doMock('../../src/config/firebase', () => firebaseConfig);
  jest.doMock('../../src/services/notificationService', () => notificationService);
  jest.doMock('../../src/middleware/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }));

  const controller = require('../../src/controllers/authController');
  return {
    controller,
    mocks: {
      User: userModel,
      Session: sessionModel,
      Firm: firmModel,
      Client: clientModel,
      Document: documentModel,
      Folder: folderModel,
      Thread: threadModel,
      Message: messageModel,
      jwt: jwtUtils,
      email: emailUtils,
      tokenBlacklist,
      firebase: firebaseConfig,
      notificationService
    }
  };
};

const run = async (handler, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  await handler(req, res, next);
  await new Promise(setImmediate);
  return { res, next };
};

describe('authController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects registration with missing fields', async () => {
    const { controller } = buildAuthController();
    const { next } = await run(controller.register, { body: {} });
    expect(next.mock.calls[0][0].message).toContain('Please provide email');
  });

  it('rejects registration for non CA-Admin role', async () => {
    const { controller } = buildAuthController();
    const { next } = await run(controller.register, { body: { email: 'a@test.com', password: 'Pass1!', name: 'A', role: 'Client' } });
    expect(next.mock.calls[0][0].message).toContain('Only CA-Admin');
  });

  it('registers user and continues on email/session failures', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      email: 'a@test.com',
      name: 'A',
      role: 'CA-Admin',
      generateEmailVerificationToken: jest.fn(() => 'token'),
      save: jest.fn(),
      password: 'hashed'
    };
    const { controller, mocks } = buildAuthController({
      User: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user)
      },
      email: {
        sendVerificationEmail: jest.fn().mockRejectedValue(new Error('fail'))
      },
      Session: {
        createSession: jest.fn().mockRejectedValue(new Error('fail'))
      }
    });

    const { res, next } = await run(controller.register, {
      body: { email: 'a@test.com', password: 'Pass1!', name: 'A' },
      headers: {},
      ip: '1.1.1.1'
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.jwt.generateAccessToken).toHaveBeenCalled();
    expect(mocks.jwt.generateRefreshToken).toHaveBeenCalled();
  });

  it('logs in client userId flow and handles notification failure', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      role: 'Client',
      isDeleted: false,
      isLocked: false,
      comparePassword: jest.fn().mockResolvedValue(true),
      resetLoginAttempts: jest.fn(),
      save: jest.fn()
    };
    const { controller } = buildAuthController({
      Client: {
        findByUserId: jest.fn().mockResolvedValue({ userAccountId: user._id }),
        findOne: jest.fn().mockResolvedValue({ userAccountId: user._id, firstLoginAt: null, recordFirstLogin: jest.fn() })
      },
      User: {
        findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) })
      },
      notificationService: {
        notifyClientFirstLogin: jest.fn().mockRejectedValue(new Error('fail'))
      }
    });

    const { res, next } = await run(controller.login, {
      body: { userId: 'CA-CLT-123', password: 'Pass1!' },
      headers: {},
      ip: '1.1.1.1'
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects CA login when user is not CA-Admin', async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      role: 'Client',
      isDeleted: false,
      isLocked: false,
      comparePassword: jest.fn().mockResolvedValue(true),
      resetLoginAttempts: jest.fn()
    };
    const { controller } = buildAuthController({
      User: {
        findByEmail: jest.fn().mockResolvedValue({ _id: user._id }),
        findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) })
      }
    });

    const { next } = await run(controller.login, { body: { email: 'a@test.com', password: 'Pass1!' } });
    expect(next.mock.calls[0][0].message).toContain('Please use your User ID');
  });

  it('refreshes access tokens and ignores rotation failures', async () => {
    const user = { _id: new mongoose.Types.ObjectId(), role: 'CA-Admin', isDeleted: false };
    const { controller } = buildAuthController({
      Session: {
        validateAndRefreshSession: jest.fn().mockResolvedValue({ _id: 's1' }),
        rotateRefreshToken: jest.fn().mockRejectedValue(new Error('fail'))
      },
      User: { findById: jest.fn().mockResolvedValue(user) }
    });

    const { res, next } = await run(controller.refreshAccessToken, { body: { refreshToken: 'token' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('logs out and invalidates session', async () => {
    const { controller, mocks } = buildAuthController({
      Session: { invalidateSession: jest.fn() }
    });

    const { res } = await run(controller.logout, {
      body: { refreshToken: 'token' },
      headers: { authorization: 'Bearer access' },
      user: { _id: 'u1' }
    });

    expect(mocks.tokenBlacklist.blacklistToken).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns active sessions', async () => {
    const { controller } = buildAuthController({
      Session: {
        getActiveSessions: jest.fn().mockResolvedValue([
          { _id: 's1', deviceType: 'desktop', clientName: 'Chrome', ipAddress: '1.1.1.1', lastActivityAt: new Date(), createdAt: new Date() }
        ])
      }
    });

    const { res } = await run(controller.getActiveSessions, { user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ count: 1 })
    }));
  });

  it('verifies email and handles welcome email failure', async () => {
    const user = {
      email: 'a@test.com',
      name: 'A',
      role: 'CA-Admin',
      isEmailVerified: false,
      save: jest.fn()
    };
    const { controller } = buildAuthController({
      User: { findOne: jest.fn().mockResolvedValue(user) },
      email: { sendWelcomeEmail: jest.fn().mockRejectedValue(new Error('fail')) }
    });

    const { res, next } = await run(controller.verifyEmail, { params: { token: 'token' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects resend verification for verified users', async () => {
    const { controller } = buildAuthController({
      User: { findOne: jest.fn().mockResolvedValue({ isEmailVerified: true }) }
    });
    const { next } = await run(controller.resendVerificationEmail, { body: { email: 'a@test.com' } });
    expect(next.mock.calls[0][0].message).toContain('already verified');
  });

  it('returns success for forgot password when user missing', async () => {
    const { controller } = buildAuthController({
      User: { findOne: jest.fn().mockResolvedValue(null) }
    });
    const { res, next } = await run(controller.forgotPassword, { body: { email: 'a@test.com' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects reset password for invalid token', async () => {
    const { controller } = buildAuthController({
      User: { findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }) }
    });
    const { next } = await run(controller.resetPassword, { params: { token: 'x' }, body: { password: 'newpass' } });
    expect(next.mock.calls[0][0].message).toContain('Invalid or expired');
  });

  it('rejects change password on wrong current password', async () => {
    const user = {
      password: 'hash',
      comparePassword: jest.fn().mockResolvedValue(false),
      save: jest.fn()
    };
    const { controller } = buildAuthController({
      User: { findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) }) }
    });
    const { next } = await run(controller.changePassword, {
      user: { _id: 'u1' },
      body: { currentPassword: 'old', newPassword: 'newpass' }
    });
    expect(next.mock.calls[0][0].message).toContain('incorrect');
  });

  it('requires password when deleting account', async () => {
    const user = {
      password: 'hash',
      comparePassword: jest.fn(),
      softDelete: jest.fn()
    };
    const { controller } = buildAuthController({
      User: { findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) }) }
    });
    const { next } = await run(controller.deleteAccount, {
      user: { _id: 'u1' },
      body: {},
      headers: {}
    });
    expect(next.mock.calls[0][0].message).toContain('Password is required');
  });
});

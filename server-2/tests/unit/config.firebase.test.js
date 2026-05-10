const buildAdminMock = (verifyIdToken = jest.fn()) => {
  return {
    initializeApp: jest.fn(() => ({ app: 'firebase' })),
    credential: {
      cert: jest.fn((payload) => ({ payload }))
    },
    auth: jest.fn(() => ({
      verifyIdToken
    }))
  };
};

const loadModule = () => {
  let initializeFirebase;
  let verifyFirebaseToken;
  let logger;
  let admin;

  jest.isolateModules(() => {
    ({ initializeFirebase, verifyFirebaseToken, admin } = require('../../src/config/firebase'));
    ({ logger } = require('../../src/middleware/logger'));
  });

  return { initializeFirebase, verifyFirebaseToken, logger, admin };
};

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('firebase config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('initializes with service account path', () => {
    const serviceAccountPath = 'firebase-service.json';
    jest.doMock('firebase-admin', () => buildAdminMock());
    jest.doMock(serviceAccountPath, () => ({
      project_id: 'proj',
      private_key: 'key',
      client_email: 'email'
    }), { virtual: true });

    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = serviceAccountPath;

    const { initializeFirebase, admin } = loadModule();
    const app = initializeFirebase();

    expect(app).toBeTruthy();
    expect(admin.initializeApp).toHaveBeenCalled();
    expect(admin.credential.cert).toHaveBeenCalled();
  });

  it('initializes with environment variables', () => {
    const verifyIdToken = jest.fn();
    jest.doMock('firebase-admin', () => buildAdminMock(verifyIdToken));

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'line1\\nline2';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, admin } = loadModule();
    const app = initializeFirebase();

    expect(app).toBeTruthy();
    expect(admin.initializeApp).toHaveBeenCalled();
    expect(admin.credential.cert).toHaveBeenCalledWith({
      projectId: 'proj',
      privateKey: 'line1\nline2',
      clientEmail: 'email'
    });
  });

  it('returns null when firebase not configured', () => {
    jest.doMock('firebase-admin', () => buildAdminMock());

    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    const { initializeFirebase, logger } = loadModule();
    const app = initializeFirebase();

    expect(app).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns null when initialize fails', () => {
    const adminMock = buildAdminMock();
    adminMock.initializeApp.mockImplementation(() => {
      throw new Error('init-fail');
    });
    jest.doMock('firebase-admin', () => adminMock);

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'key';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, logger } = loadModule();
    const app = initializeFirebase();

    expect(app).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws when verifyFirebaseToken called without init', async () => {
    jest.doMock('firebase-admin', () => buildAdminMock());

    const { verifyFirebaseToken } = loadModule();

    await expect(verifyFirebaseToken('token')).rejects.toThrow('Firebase authentication not configured');
  });

  it('verifies firebase token', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: '123' });
    jest.doMock('firebase-admin', () => buildAdminMock(verifyIdToken));

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'key';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, verifyFirebaseToken } = loadModule();
    initializeFirebase();

    const decoded = await verifyFirebaseToken('token');
    expect(decoded.uid).toBe('123');
  });

  it('maps firebase auth errors', async () => {
    const error = new Error('invalid');
    error.code = 'auth/invalid-id-token';
    const verifyIdToken = jest.fn().mockRejectedValue(error);
    jest.doMock('firebase-admin', () => buildAdminMock(verifyIdToken));

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'key';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, verifyFirebaseToken } = loadModule();
    initializeFirebase();

    await expect(verifyFirebaseToken('token')).rejects.toThrow('Invalid Firebase token');
  });

  it('maps firebase expired token error', async () => {
    const error = new Error('expired');
    error.code = 'auth/id-token-expired';
    const verifyIdToken = jest.fn().mockRejectedValue(error);
    jest.doMock('firebase-admin', () => buildAdminMock(verifyIdToken));

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'key';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, verifyFirebaseToken } = loadModule();
    initializeFirebase();

    await expect(verifyFirebaseToken('token')).rejects.toThrow('Firebase token has expired');
  });

  it('maps firebase revoked token error', async () => {
    const error = new Error('revoked');
    error.code = 'auth/id-token-revoked';
    const verifyIdToken = jest.fn().mockRejectedValue(error);
    jest.doMock('firebase-admin', () => buildAdminMock(verifyIdToken));

    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_PRIVATE_KEY = 'key';
    process.env.FIREBASE_CLIENT_EMAIL = 'email';

    const { initializeFirebase, verifyFirebaseToken } = loadModule();
    initializeFirebase();

    await expect(verifyFirebaseToken('token')).rejects.toThrow('Firebase token has been revoked');
  });
});

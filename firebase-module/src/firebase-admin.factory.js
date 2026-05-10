export const createFirebaseAdmin = ({ admin, credentials, appName, logger = console } = {}) => {
  if (!admin) {
    throw new Error('createFirebaseAdmin requires firebase-admin');
  }

  const existingApp = appName
    ? admin.apps.find((app) => app.name === appName)
    : admin.apps[0];

  if (existingApp) {
    return existingApp;
  }

  const credential = admin.credential.cert({
    ...credentials,
    privateKey: credentials.privateKey?.replace(/\\n/g, '\n'),
  });

  const app = admin.initializeApp({ credential }, appName);
  logger.info?.('Firebase Admin initialized', { projectId: credentials.projectId, appName: app.name });
  return app;
};

export const verifyFirebaseIdToken = async ({ admin, idToken, checkRevoked = false }) => {
  if (!admin?.auth) {
    throw new Error('verifyFirebaseIdToken requires firebase-admin');
  }

  try {
    return await admin.auth().verifyIdToken(idToken, checkRevoked);
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      error.statusCode = 401;
      error.publicMessage = 'Firebase token has expired';
    } else if (error.code === 'auth/id-token-revoked') {
      error.statusCode = 401;
      error.publicMessage = 'Firebase token has been revoked';
    } else if (error.code === 'auth/invalid-id-token') {
      error.statusCode = 401;
      error.publicMessage = 'Invalid Firebase token';
    }
    throw error;
  }
};

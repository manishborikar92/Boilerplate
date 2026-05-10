const admin = require('firebase-admin');
const { AuthenticationError, InternalError } = require('../utils/errorHandler');
const { logger } = require('../middleware/logger');

let firebaseApp;

const initializeFirebase = () => {
    try {
        // Check if already initialized
        if (firebaseApp) {
            return firebaseApp;
        }

        // Initialize with service account (production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        // Initialize with environment variables (development)
        else if (process.env.FIREBASE_PROJECT_ID) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
                })
            });
        } else {
            console.warn('⚠️  Firebase not configured. Google Sign-In will not work.');
            logger.warn('Firebase not configured');
            return null;
        }

        logger.info('Firebase Admin initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
        logger.error('Firebase initialization failed', { error: error.message });
        return null;
    }
};

const verifyFirebaseToken = async (idToken) => {
    if (!firebaseApp) {
        logger.error('Firebase token verification attempted but Firebase not initialized');
        throw new InternalError('Firebase authentication not configured');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        logger.warn('Firebase token verification failed', { error: error.message });

        // Handle specific Firebase errors
        if (error.code === 'auth/id-token-expired') {
            throw new AuthenticationError('Firebase token has expired');
        }
        if (error.code === 'auth/id-token-revoked') {
            throw new AuthenticationError('Firebase token has been revoked');
        }
        if (error.code === 'auth/invalid-id-token') {
            throw new AuthenticationError('Invalid Firebase token');
        }

        throw new AuthenticationError('Firebase authentication failed');
    }
};

module.exports = {
    initializeFirebase,
    verifyFirebaseToken,
    admin
};

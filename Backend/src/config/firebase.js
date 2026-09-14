import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let db = null;
let messaging = null;
let cachedServiceAccount = null;

const sanitizeString = (value) => String(value ?? '').trim();

const getServiceAccountFromEnv = () => {
    if (cachedServiceAccount) return cachedServiceAccount;

    const rawJson = sanitizeString(config.firebaseServiceAccount);
    if (rawJson) {
        try {
            cachedServiceAccount = JSON.parse(rawJson);
            return cachedServiceAccount;
        } catch (err) {
            logger.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
        }
    }

    const pathValue = sanitizeString(config.firebaseServiceAccountPath);
    if (pathValue) {
        const filePath = resolve(process.cwd(), pathValue);
        if (existsSync(filePath)) {
            try {
                cachedServiceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
                return cachedServiceAccount;
            } catch (err) {
                logger.error(`Error reading or parsing firebase service account file at ${filePath}:`, err.message);
            }
        }
    }

    return null;
};

/**
 * Initializes Firebase Admin SDK with Service Account.
 * Supports both FCM and Realtime Database.
 */
export const initializeFirebaseRealtime = () => {
    try {
        if (admin.apps.length > 0) {
            db = admin.database();
            messaging = admin.messaging();
            return { db, messaging };
        }

        const serviceAccount = getServiceAccountFromEnv();
        const databaseURL = config.firebaseDatabaseUrl;

        if (!serviceAccount) {
            logger.warn('⚠️ Firebase service account not configured. Firebase features may not work.');
            return null;
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL || undefined
        });

        if (databaseURL) {
            db = admin.database();
            logger.info('✅ Firebase Realtime Database Initialized Successfully');
        } else {
            logger.warn('⚠️ Firebase Database URL not provided. Realtime Database features will be unavailable.');
        }

        messaging = admin.messaging();
        logger.info('✅ Firebase Messaging (FCM) Initialized Successfully');

        return { db, messaging };
    } catch (error) {
        logger.error(`❌ Firebase Initialization Error: ${error.message}`);
        return null;
    }
};

/**
 * Returns the initialized Firebase Realtime Database instance.
 * @returns {admin.database.Database}
 * @throws Error if not initialized
 */
export const getFirebaseDB = () => {
    if (!db) {
        throw new Error('⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first.');
    }
    return db;
};

/**
 * Returns the initialized Firebase Messaging instance.
 * @returns {admin.messaging.Messaging}
 * @throws Error if not initialized
 */
export const getFirebaseMessaging = () => {
    if (!messaging) {
        throw new Error('⚠️ Firebase Messaging not initialized. Call initializeFirebaseRealtime() first.');
    }
    return messaging;
};

export const getFirebaseDatabase = () => {
    try {
        return getFirebaseDB();
    } catch (_error) {
        return null;
    }
};

export const firebaseServerTimestamp = () => admin.database.ServerValue.TIMESTAMP;

export default admin;

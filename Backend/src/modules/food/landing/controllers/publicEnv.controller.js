import { config } from '../../../../config/env.js';

const sanitize = (value) => (value ? String(value).trim().replace(/^['"]|['"]$/g, '') : '');

/**
 * Public environment variables for frontend runtime.
 * IMPORTANT: Only expose non-secret keys safe for clients.
 */
export const getPublicEnvController = async (_req, res, next) => {
    try {
        // Browser-only key (HTTP referrer restricted). Never expose GOOGLE_MAPS_API_KEY here.
        const googleMapsKey = sanitize(process.env.VITE_GOOGLE_MAPS_API_KEY);

        return res.status(200).json({
            success: true,
            message: 'Public environment variables fetched',
            data: {
                VITE_GOOGLE_MAPS_API_KEY: googleMapsKey || '',
                VITE_FIREBASE_API_KEY: sanitize(process.env.VITE_FIREBASE_API_KEY) || '',
                VITE_FIREBASE_AUTH_DOMAIN: sanitize(process.env.VITE_FIREBASE_AUTH_DOMAIN) || '',
                VITE_FIREBASE_PROJECT_ID: sanitize(process.env.VITE_FIREBASE_PROJECT_ID) || '',
                VITE_FIREBASE_STORAGE_BUCKET: sanitize(process.env.VITE_FIREBASE_STORAGE_BUCKET) || '',
                VITE_FIREBASE_MESSAGING_SENDER_ID: sanitize(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || '',
                VITE_FIREBASE_APP_ID: sanitize(process.env.VITE_FIREBASE_APP_ID) || '',
                VITE_FIREBASE_MEASUREMENT_ID: sanitize(process.env.VITE_FIREBASE_MEASUREMENT_ID) || '',
                VITE_FIREBASE_VAPID_KEY: sanitize(process.env.VITE_FIREBASE_VAPID_KEY) || '',
                FIREBASE_API_KEY: sanitize(process.env.VITE_FIREBASE_API_KEY) || '',
                FIREBASE_AUTH_DOMAIN: sanitize(process.env.VITE_FIREBASE_AUTH_DOMAIN) || '',
                FIREBASE_PROJECT_ID: sanitize(process.env.VITE_FIREBASE_PROJECT_ID) || '',
                FIREBASE_STORAGE_BUCKET: sanitize(process.env.VITE_FIREBASE_STORAGE_BUCKET) || '',
                FIREBASE_MESSAGING_SENDER_ID: sanitize(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || '',
                FIREBASE_APP_ID: sanitize(process.env.VITE_FIREBASE_APP_ID) || '',
                FIREBASE_MEASUREMENT_ID: sanitize(process.env.VITE_FIREBASE_MEASUREMENT_ID) || '',
                FIREBASE_VAPID_KEY: sanitize(process.env.VITE_FIREBASE_VAPID_KEY) || '',
                NODE_ENV: config.nodeEnv || 'development'
            }
        });
    } catch (error) {
        next(error);
    }
};


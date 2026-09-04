import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Basic server config
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    mongodbUri: process.env.MONGO_URI || process.env.MONGODB_URI,

    // JWT
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',

    // OTP
    otpExpiry: process.env.OTP_EXPIRY || '5m',
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
    otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
    otpExpirySeconds: Number(process.env.OTP_EXPIRY_SECONDS || 300),
    otpRateLimit: Number(process.env.OTP_RATE_LIMIT || 3),
    get useDefaultOtp() {
        return String(process.env.USE_DEFAULT_OTP ?? '').trim().toLowerCase() === 'true';
    },

    // SMS India Hub
    smsIndiaHubUsername: process.env.SMS_INDIA_HUB_USERNAME,
    smsApiKey: process.env.SMS_INDIA_HUB_API_KEY,
    smsSenderId: process.env.SMS_INDIA_HUB_SENDER_ID,
    smsDltTemplateId: process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID,

    // Rate limiting
    rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW || 15),
    rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
    authRateLimitWindowMinutes: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 15),
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),

    // Security
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),

    // Uploads
    // UPLOAD_STORAGE decides where every image/file in the app is stored:
    //   'cloudinary' -> Cloudinary CDN (used on local/dev machines)
    //   'local'      -> a folder on the server disk (used on the live VPS)
    // Legacy true/false values are accepted too: UPLOAD_USE_CLOUDINARY=true|false.
    uploadStorage: (() => {
        const useCloudinary = String(process.env.UPLOAD_USE_CLOUDINARY || '').trim().toLowerCase();
        if (useCloudinary === 'true') return 'cloudinary';
        if (useCloudinary === 'false') return 'local';
        return String(process.env.UPLOAD_STORAGE || 'local').trim().toLowerCase();
    })(),
    // Absolute (or project-relative) directory the 'local' driver writes into.
    // On the VPS point this at the shared folder, e.g. /var/www/uploades
    uploadLocalDir: process.env.UPLOAD_LOCAL_DIR || 'uploads',
    // Optional absolute prefix for locally stored files, e.g. https://itzo.in
    // Leave empty to keep returning relative "/uploads/..." URLs.
    uploadPublicBaseUrl: (process.env.UPLOAD_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    uploadPath: process.env.UPLOAD_PATH || 'uploads/',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '50mb',

    // Redis
    redisEnabled: process.env.REDIS_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL,

    // BullMQ
    bullmqEnabled: process.env.BULLMQ_ENABLED === 'true',

    // Cloudinary
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

    // Firebase / FCM
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
    firebaseWebApiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    firebaseWebAuthDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    firebaseWebStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    firebaseWebMessagingSenderId:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseWebAppId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    firebaseWebMeasurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID,
    firebaseWebVapidKey: process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY,
    firebaseVapidPrivateKey: process.env.FIREBASE_VAPID_PRIVATE_KEY,

    // Socket.io
    socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || 'https://itzo-two.vercel.app',

    // Razorpay (payments)
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET, // ✅ NEW

    // Email (SMTP) – for admin forgot password OTP etc.
    emailHost: process.env.EMAIL_HOST,
    emailPort: Number(process.env.EMAIL_PORT) || 587,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS ? String(process.env.EMAIL_PASS).replace(/\s/g, '') : '',
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@example.com',

    // Google Maps (HRMS location tracking & office validation)
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
};

export const env = {
    nodeEnv: config.nodeEnv,
    port: Number(config.port),
    mongoUri: config.mongodbUri,
    mongoDbName: process.env.MONGODB_DB_NAME || 'appzeto_food',
    jwtSecret: config.jwtAccessSecret,
    jwtExpiresIn: config.jwtAccessExpiresIn,
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'https://itzo-two.vercel.app',
    cloudinary: {
        cloudName: config.cloudinaryCloudName || '',
        apiKey: config.cloudinaryApiKey || '',
        apiSecret: config.cloudinaryApiSecret || '',
        folder: process.env.CLOUDINARY_FOLDER || 'appzeto-food',
    },
    firebase: {
        databaseURL: process.env.FIREBASE_DATABASE_URL || config.firebaseDatabaseUrl || '',
        serviceAccountPath: config.firebaseServiceAccountPath || '',
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || config.firebaseServiceAccount || '',
        vapidPrivateKey: process.env.FIREBASE_VAPID_PRIVATE_KEY || '',
    },

};

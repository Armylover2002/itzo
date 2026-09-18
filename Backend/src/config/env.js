import dotenv from 'dotenv';

dotenv.config();

const parsePositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
    otpRateLimit: parsePositiveNumber(process.env.OTP_RATE_LIMIT, 5),
    otpRateWindow: parsePositiveNumber(process.env.OTP_RATE_WINDOW, 600),
    useDefaultOtp: process.env.USE_DEFAULT_OTP === 'true',

    // SMS India Hub
    smsIndiaHubUsername: process.env.SMS_INDIA_HUB_USERNAME,
    smsApiKey: process.env.SMS_INDIA_HUB_API_KEY,
    smsSenderId: process.env.SMS_INDIA_HUB_SENDER_ID,
    smsDltTemplateId: process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID,
    smsTransactionalDltTemplateId: process.env.SMS_INDIA_HUB_TXN_DLT_TEMPLATE_ID,

    // Rate limiting — window is minutes-based via RATE_LIMIT_WINDOW only. (A
    // RATE_LIMIT_WINDOW_MS variable previously also existed in .env, but this
    // resolver always preferred RATE_LIMIT_WINDOW when both were set, so the _MS
    // value never took effect. Dropped to avoid two vars appearing to control the
    // same setting — see .env.example.)
    rateLimitWindowMinutes: parsePositiveNumber(process.env.RATE_LIMIT_WINDOW, 15),
    // General/public per-IP API limiter (apiRateLimiter in middleware/rateLimit.js),
    // applied to every /api/* request as the shared baseline. 600/15min: a cold
    // Home-screen load fires ~13 requests (see frontend request-burst audit), so 600
    // supports ~46 such loads per IP per 15 minutes — comfortably covers one real
    // user's normal session (repeated visits, tab switches, a few concurrent
    // tabs/devices behind one NAT) while staying well below the dev-only ceiling
    // below. Sensitive endpoints are NOT sized by this number — auth/OTP/maps traffic
    // stacks its own, separately-configured, much stricter limiter on top of this one.
    rateLimitMaxRequests: parsePositiveNumber(process.env.RATE_LIMIT_MAX, 600),
    authRateLimitWindowMinutes: parsePositiveNumber(process.env.AUTH_RATE_LIMIT_WINDOW, 15),
    // Per-IP ceiling on auth traffic; per-account lockout handles brute force.
    authRateLimitMax: parsePositiveNumber(process.env.AUTH_RATE_LIMIT_MAX, 50),
    // Failed verify attempts per phone/email (successes are not counted).
    authVerifyRateLimitMax: parsePositiveNumber(process.env.AUTH_VERIFY_RATE_LIMIT_MAX, 10),
    mapsRateLimitWindowMinutes: parsePositiveNumber(process.env.MAPS_RATE_LIMIT_WINDOW, 15),
    mapsRateLimitMax: parsePositiveNumber(process.env.MAPS_RATE_LIMIT_MAX, 60),
    authLoginMaxAttempts: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5),
    authLoginLockoutMinutes: Number(process.env.AUTH_LOGIN_LOCKOUT_MINUTES || 15),

    // Security
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),

    // Uploads
    // UPLOAD_STORAGE decides where the storage-abstraction (upload.service.js,
    // used by HRMS payslips etc.) writes files:
    //   'cloudinary' -> Cloudinary CDN
    //   'local'      -> a folder on the server disk
    // Legacy true/false values are accepted too: UPLOAD_USE_CLOUDINARY=true|false.
    // Defaults to 'cloudinary' because this project stores every other upload
    // (media, documents, images) on Cloudinary and does not serve /uploads statically.
    uploadStorage: (() => {
        const useCloudinary = String(process.env.UPLOAD_USE_CLOUDINARY || '').trim().toLowerCase();
        if (useCloudinary === 'true') return 'cloudinary';
        if (useCloudinary === 'false') return 'local';
        return String(process.env.UPLOAD_STORAGE || 'cloudinary').trim().toLowerCase();
    })(),
    // Absolute (or project-relative) directory the 'local' driver writes into.
    uploadLocalDir: process.env.UPLOAD_LOCAL_DIR || 'uploads',
    // Optional absolute prefix for locally stored files, e.g. https://itzo.in
    uploadPublicBaseUrl: (process.env.UPLOAD_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    uploadPath: process.env.UPLOAD_PATH || 'uploads/',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '2mb',

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
    socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',

    // Razorpay (payments)
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET, // ✅ NEW

    // Google Maps (server-side distance matrix, directions, geocoding)
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY || '',

    // Email (SMTP) – for admin forgot password OTP etc.
    emailHost: process.env.EMAIL_HOST,
    emailPort: Number(process.env.EMAIL_PORT) || 587,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS ? String(process.env.EMAIL_PASS).replace(/\s/g, '') : '',
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@example.com'
};

export const env = {
    nodeEnv: config.nodeEnv,
    port: Number(config.port),
    mongoUri: config.mongodbUri,
    mongoDbName: process.env.MONGODB_DB_NAME || 'appzeto_food',
    jwtSecret: config.jwtAccessSecret,
    jwtExpiresIn: config.jwtAccessExpiresIn,
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
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

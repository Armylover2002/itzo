const isProd = process.env.NODE_ENV === 'production';

export const logger = {
    info: (msg) => {
        // In production, suppress noisy info logs to reduce I/O pressure
        if (!isProd) {
            console.log(`✅ [INFO] ${new Date().toLocaleTimeString()}: ${msg}`);
        } else {
            console.log(`[INFO] ${msg}`);
        }
    },
    error: (msg, meta) => {
        console.error(`❌ [ERROR] ${new Date().toLocaleTimeString()}: ${msg}`, meta || '');
    },
    warn: (msg) => {
        console.warn(`⚠️ [WARN] ${new Date().toLocaleTimeString()}: ${msg}`);
    },
    // No-op debug — only logs in development to avoid log volume in production
    debug: (msg) => {
        if (!isProd) {
            console.log(`🔍 [DEBUG] ${new Date().toLocaleTimeString()}: ${msg}`);
        }
    }
};

import http from 'http';
import app from './src/app.js';
import { config } from './src/config/env.js';
import { validateConfig } from './src/config/validateEnv.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { connectRedis, closeRedis } from './src/config/redis.js';
import { initSocket } from './src/config/socket.js';
import { initializeQueues, closeBullMQConnection } from './src/queues/index.js';
import { expireExpiredOffers } from './src/modules/food/admin/services/admin.service.js';
import { syncExpiredFssaiNotifications } from './src/modules/food/restaurant/services/fssaiExpiry.service.js';
import { runReportAbsentCheck } from './src/modules/hrms/crons/reportAbsentCron.js';

import { logger } from './src/utils/logger.js';
import { initializeFirebaseRealtime } from './src/config/firebase.js';
import { ensureQuickCommerceSeedData } from './src/modules/quick-commerce/services/seed.service.js';

const SHUTDOWN_TIMEOUT_MS = 10000;
let server = null;
let expireOffersInterval = null;
let fssaiExpiryInterval = null;
let reportAbsentInterval = null;

const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`);
    if (!server) {
        process.exit(0);
        return;
    }
    server.close(async () => {
        try {
            await disconnectDB();
            await closeRedis();
            await closeBullMQConnection();
            if (expireOffersInterval) clearInterval(expireOffersInterval);
            if (fssaiExpiryInterval) clearInterval(fssaiExpiryInterval);
            if (reportAbsentInterval) clearInterval(reportAbsentInterval);
            logger.info('Graceful shutdown complete');
            process.exit(0);
        } catch (err) {
            logger.error(`Shutdown error: ${err.message}`);
            process.exit(1);
        }
    });
    setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
};

const startServer = async () => {
    try {
        validateConfig();
        initializeFirebaseRealtime();

        // 1. Connect to Database (MongoDB)
        await connectDB();

        // 1.5 Initialize Settings Cache
        try {
            const { initSettingsCache } = await import('./src/modules/common/utils/settingsCache.js');
            await initSettingsCache();
        } catch (err) {
            logger.error(`Settings cache initialization error: ${err.message}`);
        }

        // 2. Create HTTP server from Express app
        const httpServer = http.createServer(app);

        // 3. Initialize Socket.IO with the HTTP server (Redis adapter when Redis enabled)
        await initSocket(httpServer);

        if (config.redisEnabled) {
            await connectRedis();
        }
        
        // 5a. Watchdog: Recover stuck orders from previous run
        try {
            const { recoverStuckOrders } = await import('./src/modules/food/orders/services/order.service.js');
            await recoverStuckOrders();
        } catch (err) {
            logger.error(`Watchdog startup error: ${err.message}`);
        }

        // 5. Conditionally initialize BullMQ queues.
        // BullMQ requires Redis; skip queue bootstrap when Redis is disabled.
        if (config.bullmqEnabled && config.redisEnabled) {
            try {
                initializeQueues();
            } catch (err) {
                logger.error(`BullMQ initialization error (server continues): ${err.message}`);
            }
        } else if (config.bullmqEnabled && !config.redisEnabled) {
            logger.warn('BullMQ is enabled but Redis is disabled. Queue initialization skipped.');
        }

        await ensureQuickCommerceSeedData();

        // 6. Start the HTTP server
        server = httpServer.listen(config.port, config.host, () => {
            logger.info(`Server running in ${config.nodeEnv} mode on ${config.host}:${config.port}`);
            console.log(`🌐 [URL] http://localhost:${config.port}`);
        });

        const withRetry = async (fn, label, retries = 3) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    await fn();
                    return;
                } catch (err) {
                    const isTransient = ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN'].includes(err.code)
                        || /ECONNRESET|ETIMEDOUT|EPIPE|topology was destroyed|pool was cleared/i.test(err.message);
                    if (isTransient && attempt < retries) {
                        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
                        logger.warn(`${label} transient error (attempt ${attempt}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        logger.error(`${label} error: ${err.message}`);
                    }
                }
            }
        };

        const runExpire = () => withRetry(expireExpiredOffers, 'Expire offers');
        runExpire();
        expireOffersInterval = setInterval(runExpire, 5 * 60 * 1000);

        const runFssaiExpirySync = () => withRetry(syncExpiredFssaiNotifications, 'FSSAI expiry sync');
        runFssaiExpirySync();
        fssaiExpiryInterval = setInterval(runFssaiExpirySync, 60 * 60 * 1000);

        // Report Absent Cron — runs every 24 hours (recommended to start at ~11 PM IST)
        const runReportAbsent = async () => {
            try {
                await runReportAbsentCheck();
            } catch (err) {
                logger.error(`Report absent cron error: ${err.message}`);
            }
        };
        // Run once at startup (will only affect if startup happens after 10 PM) then every 24h
        reportAbsentInterval = setInterval(runReportAbsent, 24 * 60 * 60 * 1000);

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Handle nodemon restart

        // Handle server errors (like EADDRINUSE)
        server.on('error', async (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use.`);
                if (config.nodeEnv === 'development') {
                    logger.info('Attempting to clear the port automatically...');
                    try {
                        const { execSync } = await import('child_process');
                        if (process.platform === 'win32') {
                            const stdout = execSync(`netstat -ano | findstr :${config.port}`).toString();
                            const lines = stdout.split('\n');
                            const listeningLine = lines.find(line => line.includes('LISTENING'));
                            if (listeningLine) {
                                const pid = listeningLine.trim().split(/\s+/).pop();
                                if (pid && pid !== process.pid.toString()) {
                                    execSync(`taskkill /F /PID ${pid}`);
                                    logger.info(`Successfully killed process ${pid} on port ${config.port}. Restarting...`);
                                    // Give it a moment then restart or exit and let nodemon handle it
                                    setTimeout(() => process.exit(0), 1000);
                                    return;
                                }
                            }
                        }
                    } catch (killErr) {
                        logger.error(`Failed to auto-kill process: ${killErr.message}`);
                    }
                }
                logger.info(`Try running: netstat -ano | findstr :${config.port} then taskkill /F /PID <PID>`);
            } else {
                logger.error(`Server Error: ${err.message}`);
            }
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err) => {
            logger.error(`Unhandled Rejection: ${err?.message || err}`);
            if (config.nodeEnv === 'production') {
                if (server) server.close(() => process.exit(1));
                else process.exit(1);
            }
        });

        process.on('uncaughtException', (err) => {
            logger.error(`Uncaught Exception: ${err?.message || err}`);
            if (config.nodeEnv === 'production') {
                process.exit(1);
            }
        });

    } catch (error) {
        logger.error(`Error starting server: ${error.message}`);
        process.exit(1);
    }
};

startServer();


// Restart nodemon
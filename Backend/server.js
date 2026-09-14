import http from 'http';
import app from './src/app.js';
import { config } from './src/config/env.js';
import { validateConfig } from './src/config/validateEnv.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { connectRedis, closeRedis } from './src/config/redis.js';
import { initSocket } from './src/config/socket.js';
import { initializeQueues, closeBullMQConnection, initSubscriptionSchedules, initOrderSchedules } from './src/queues/index.js';
import { expireExpiredOffers } from './src/modules/food/admin/services/admin.service.js';
import { syncExpiredFssaiNotifications } from './src/modules/food/restaurant/services/fssaiExpiry.service.js';
import { syncExpiredSellerLicenseNotifications } from './src/modules/quick-commerce/seller/services/sellerLicenseExpiry.service.js';

import { logger } from './src/utils/logger.js';
import { initializeFirebaseRealtime } from './src/config/firebase.js';
import { ensureQuickCommerceSeedData } from './src/modules/quick-commerce/services/seed.service.js';

const SHUTDOWN_TIMEOUT_MS = 10000;
let server = null;
let expireOffersInterval = null;
let fssaiExpiryInterval = null;
let foodScheduledReconcileInterval = null;

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
            if (foodScheduledReconcileInterval) clearInterval(foodScheduledReconcileInterval);
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

        // 2. Create HTTP server from Express app
        const httpServer = http.createServer(app);

        // 3. Initialize Socket.IO with the HTTP server (Redis adapter when Redis enabled)
        await initSocket(httpServer);

        if (config.redisEnabled) {
            await connectRedis();
            try {
                const { createRedisClient } = await import('./src/config/redis.js');
                const {
                    FOOD_SCHEDULE_ACTIVATED_CHANNEL,
                    handleScheduleActivatedBridgeMessage,
                } = await import('./src/modules/food/orders/services/order.service.js');
                const scheduleSub = createRedisClient();
                if (scheduleSub) {
                    await scheduleSub.connect();
                    await scheduleSub.subscribe(FOOD_SCHEDULE_ACTIVATED_CHANNEL, (message) => {
                        void handleScheduleActivatedBridgeMessage(message).catch((err) => {
                            logger.error(
                                `Schedule activated bridge handler failed: ${err?.message || err}`
                            );
                        });
                    });
                    logger.info(
                        `Subscribed to ${FOOD_SCHEDULE_ACTIVATED_CHANNEL} for worker→API schedule notify`
                    );
                }
            } catch (err) {
                logger.warn(
                    `Schedule activated Redis bridge not started: ${err?.message || err}`
                );
            }
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
                await initSubscriptionSchedules(); // Also ensure subscription schedule is called
                await initOrderSchedules();
            } catch (err) {
                logger.error(`BullMQ initialization error (server continues): ${err.message}`);
            }
        } else if (config.bullmqEnabled && !config.redisEnabled) {
            logger.warn('BullMQ is enabled but Redis is disabled. Queue initialization skipped.');
        }

        // Cleanup legacy mock products only — categories are never auto-seeded.
        await ensureQuickCommerceSeedData();

        // 6. Start the HTTP server
        server = httpServer.listen(config.port, config.host, () => {
            logger.info(`Server running in ${config.nodeEnv} mode on ${config.host}:${config.port}`);
            console.log(`🌐 [URL] http://localhost:${config.port}`);
        });

        const runExpire = async () => {
            try {
                await expireExpiredOffers();
            } catch (err) {
                logger.error(`Expire offers error: ${err.message}`);
            }
        };
        runExpire();
        expireOffersInterval = setInterval(runExpire, 5 * 60 * 1000);

        const runFssaiExpirySync = async () => {
            try {
                await syncExpiredFssaiNotifications();
            } catch (err) {
                logger.error(`FSSAI expiry sync error: ${err.message}`);
            }
        };
        runFssaiExpirySync();
        fssaiExpiryInterval = setInterval(runFssaiExpirySync, 60 * 60 * 1000);

        const runSellerLicenseExpirySync = async () => {
            try {
                await syncExpiredSellerLicenseNotifications();
            } catch (err) {
                logger.error(`Seller License expiry sync error: ${err.message}`);
            }
        };
        runSellerLicenseExpirySync();
        const sellerLicenseExpiryInterval = setInterval(runSellerLicenseExpirySync, 60 * 60 * 1000);

        const runFoodScheduledReconcile = async () => {
            try {
                // FALLBACK ONLY — activates when BullMQ job is missing/stuck/failed.
                // Healthy delayed jobs are skipped (primary path = order worker).
                const { processDueScheduledFoodOrders } = await import(
                    './src/modules/food/orders/services/order.service.js'
                );
                await processDueScheduledFoodOrders();
            } catch (err) {
                logger.error(`Food scheduled reconcile error: ${err.message}`);
            }
        };
        runFoodScheduledReconcile();
        foodScheduledReconcileInterval = setInterval(runFoodScheduledReconcile, 60 * 1000);

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Handle nodemon restart

        // Handle server errors (like EADDRINUSE).
        // Do NOT auto-kill other processes — multiple nodemon instances fighting
        // over the port causes a restart death spiral and hung connections that
        // browsers report as cryptic CORS failures (status null).
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use.`);
                logger.info(
                    process.platform === 'win32'
                        ? `Stop the other process: netstat -ano | findstr :${config.port} then taskkill /F /PID <PID>`
                        : `Stop the other process: lsof -i :${config.port} then kill <PID>`
                );
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

import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import { getBullMQConnection } from '../connection.js';
import { TRACKING_QUEUE } from '../queue.constants.js';
import { processTrackingJob } from '../processors/tracking.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startTrackingWorker = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Tracking worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Tracking worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    // Set concurrency to handle multiple high-frequency updates without blocking
    const worker = new Worker(TRACKING_QUEUE, processTrackingJob, {
        connection,
        concurrency: 10,
        defaultJobOptions
    });
    
    // Silence high-frequency logs in production for health but log major errors
    worker.on('completed', (job) => logger.debug(`Tracking job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Tracking job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Tracking worker error: ${err.message}`));
    
    logger.info('Tracking worker started (Scalable Real-time Persistence)');
    return worker;
};

const bootstrap = async () => {
    try {
        // The processor reads/writes FoodDeliveryPartner and FoodOrder directly.
        await connectDB();
        const worker = startTrackingWorker();
        if (!worker) {
            process.exit(0);
            return;
        }
        const shutdown = async () => {
            logger.info('Graceful shutdown: closing tracking worker');
            await worker.close();
            await disconnectDB().catch(() => {});
            process.exit(0);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        logger.error(`Tracking worker bootstrap failed: ${err?.message || err}`);
        process.exit(1);
    }
};

bootstrap();

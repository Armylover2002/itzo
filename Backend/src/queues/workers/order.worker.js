import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import { getBullMQConnection } from '../connection.js';
import { ORDER_QUEUE } from '../queue.constants.js';
import { processOrderJob } from '../processors/order.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startOrderWorker = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Order worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Order worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(ORDER_QUEUE, processOrderJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => logger.info(`Order job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Order job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Order worker error: ${err.message}`));
    logger.info('Order worker started (Mongo connected)');
    return worker;
};

const bootstrap = async () => {
    try {
        // Schedule activation + dispatch jobs require mongoose models.
        await connectDB();
        const worker = startOrderWorker();
        if (!worker) {
            process.exit(0);
            return;
        }
        const shutdown = async () => {
            await worker.close();
            await disconnectDB().catch(() => {});
            process.exit(0);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        logger.error(`Order worker bootstrap failed: ${err?.message || err}`);
        process.exit(1);
    }
};

bootstrap();

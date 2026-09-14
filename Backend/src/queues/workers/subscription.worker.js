import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import { getBullMQConnection } from '../connection.js';
import { SUBSCRIPTION_QUEUE } from '../queue.constants.js';
import { processSubscriptionJob } from '../processors/subscription.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startSubscriptionWorker = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Subscription worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Subscription worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }

    const worker = new Worker(SUBSCRIPTION_QUEUE, processSubscriptionJob, {
        connection,
        concurrency: 1, // Expiry check is a batch operation, no need for high concurrency
        defaultJobOptions
    });
    
    worker.on('completed', (job) => logger.debug(`Subscription job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Subscription job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Subscription worker error: ${err.message}`));
    
    logger.info('Subscription worker started (Lifecycle Management)');
    return worker;
};

const bootstrap = async () => {
    try {
        // The expiry sweep runs through subscriptionPlan.service, which uses mongoose.
        await connectDB();
        const worker = startSubscriptionWorker();
        if (!worker) {
            process.exit(0);
            return;
        }
        const shutdown = async () => {
            logger.info('Graceful shutdown: closing subscription worker');
            await worker.close();
            await disconnectDB().catch(() => {});
            process.exit(0);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        logger.error(`Subscription worker bootstrap failed: ${err?.message || err}`);
        process.exit(1);
    }
};

bootstrap();

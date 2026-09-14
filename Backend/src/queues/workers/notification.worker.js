import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { getBullMQConnection } from '../connection.js';
import { NOTIFICATION_QUEUE } from '../queue.constants.js';
import { processNotificationJob } from '../processors/notification.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startNotificationWorker = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Notification worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Notification worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(NOTIFICATION_QUEUE, processNotificationJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => logger.info(`Notification job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Notification job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Notification worker error: ${err.message}`));
    logger.info('Notification worker started');
    return worker;
};

const worker = startNotificationWorker();
if (worker) {
    const shutdown = async () => {
        await worker.close();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

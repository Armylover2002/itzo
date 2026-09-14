import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import { getBullMQConnection } from '../connection.js';
import { PAYMENT_QUEUE } from '../queue.constants.js';
import { processPaymentJob } from '../processors/payment.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startPaymentWorker = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Payment worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Payment worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(PAYMENT_QUEUE, processPaymentJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => logger.info(`Payment job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Payment job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Payment worker error: ${err.message}`));
    logger.info('Payment worker started');
    return worker;
};

const bootstrap = async () => {
    try {
        // wallet/payment/refund services all query mongoose models — without this the
        // worker starts, accepts jobs, and every query buffers until it times out.
        await connectDB();
        const worker = startPaymentWorker();
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
        logger.error(`Payment worker bootstrap failed: ${err?.message || err}`);
        process.exit(1);
    }
};

bootstrap();

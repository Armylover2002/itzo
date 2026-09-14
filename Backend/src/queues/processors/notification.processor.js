import { logger } from '../../utils/logger.js';

/**
 * Placeholder processor for notification jobs. No external API calls yet.
 * @param {import('bullmq').Job} job
 */
export const processNotificationJob = async (job) => {
    logger.info(`Processing notification job ${job.id}`);
    // Placeholder: business logic (e.g. push/FCM) will be integrated later
    return { processed: true, jobId: job.id };
};

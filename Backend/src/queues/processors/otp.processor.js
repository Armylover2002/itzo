import { logger } from '../../utils/logger.js';

/**
 * Placeholder processor for OTP jobs. No external API calls yet.
 * @param {import('bullmq').Job} job
 */
export const processOtpJob = async (job) => {
    logger.info(`Processing OTP job ${job.id}`);
    // Placeholder: business logic (e.g. send SMS) will be integrated later
    return { processed: true, jobId: job.id };
};

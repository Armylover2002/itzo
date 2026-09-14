import { getOtpQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/**
 * Add an OTP job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { phone, otp, purpose })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addOtpJob = async (data, options = {}) => {
    const queue = getOtpQueue();
    if (!queue) {
        logger.warn('BullMQ OTP queue not available. Job not added.');
        return null;
    }
    try {
        const job = await queue.add('send-otp', data, options);
        logger.info(`OTP job added: ${job.id}`);
        return job;
    } catch (err) {
        logger.error(`Failed to add OTP job: ${err.message}`);
        throw err;
    }
};

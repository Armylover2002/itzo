import { getPaymentQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/**
 * Add a payment processing job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { paymentId, action })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addPaymentJob = async (data, options = {}) => {
    const queue = getPaymentQueue();
    if (!queue) {
        logger.warn('BullMQ payment queue not available. Job not added.');
        return null;
    }
    try {
        const job = await queue.add('process-payment', data, options);
        logger.info(`Payment job added: ${job.id}`);
        return job;
    } catch (err) {
        logger.error(`Failed to add payment job: ${err.message}`);
        throw err;
    }
};

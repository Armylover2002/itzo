import { getNotificationQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/**
 * Add a notification job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { userId, title, body, channel })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addNotificationJob = async (data, options = {}) => {
    const queue = getNotificationQueue();
    if (!queue) {
        logger.warn('BullMQ notification queue not available. Job not added.');
        return null;
    }
    try {
        const job = await queue.add('send-notification', data, options);
        logger.info(`Notification job added: ${job.id}`);
        return job;
    } catch (err) {
        logger.error(`Failed to add notification job: ${err.message}`);
        throw err;
    }
};

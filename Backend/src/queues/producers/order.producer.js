import { getOrderQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/**
 * Add an order processing job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { orderId, action })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addOrderJob = async (data, options = {}) => {
    const queue = getOrderQueue();
    if (!queue) {
        const action = data?.action || 'unknown';
        const documentType = data?.documentType || 'forward_order';
        const targetId = data?.orderMongoId || data?.orderId || '';
        logger.warn(
            `[BullMQ] Order queue unavailable — job not added (action=${action}, documentType=${documentType}, targetId=${targetId}). Start Redis and the order worker to enable DISPATCH_TIMEOUT_CHECK retries.`,
        );
        return null;
    }
    try {
        const job = await queue.add('process-order', data, options);
        logger.info(`Order job added: ${job.id}`);
        return job;
    } catch (err) {
        // Duplicate custom jobId (e.g. food-schedule-<mongoId>) — treat as success for idempotency.
        if (String(err?.message || '').includes('Job') && String(err?.message || '').includes('exists')) {
            logger.warn(`Order job already exists (idempotent): ${options?.jobId || data?.orderMongoId || ''}`);
            return { id: options?.jobId || null, duplicate: true };
        }
        logger.error(`Failed to add order job: ${err.message}`);
        throw err;
    }
};

/** Remove a delayed/queued order job by id (e.g. schedule activation). Best-effort. */
export const removeOrderJob = async (jobId) => {
    if (!jobId) return false;
    const queue = getOrderQueue();
    if (!queue) return false;
    try {
        const job = await queue.getJob(String(jobId));
        if (!job) return false;
        await job.remove();
        logger.info(`Order job removed: ${jobId}`);
        return true;
    } catch (err) {
        logger.warn(`Failed to remove order job ${jobId}: ${err?.message || err}`);
        return false;
    }
};

/**
 * Inspect a BullMQ order job for schedule fallback decisions.
 * @returns {Promise<{ exists: boolean, state?: string, queueUnavailable?: boolean }>}
 */
export const getOrderJobMeta = async (jobId) => {
    if (!jobId) return { exists: false };
    const queue = getOrderQueue();
    if (!queue) {
        return { exists: false, queueUnavailable: true };
    }
    try {
        const job = await queue.getJob(String(jobId));
        if (!job) return { exists: false };
        const state = await job.getState();
        return { exists: true, state: String(state || '') };
    } catch (err) {
        logger.warn(`Failed to inspect order job ${jobId}: ${err?.message || err}`);
        return { exists: false, queueUnavailable: true };
    }
};

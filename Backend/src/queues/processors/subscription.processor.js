import { logger } from '../../utils/logger.js';
import * as subscriptionService from '../../modules/food/admin/services/subscriptionPlan.service.js';

/**
 * BullMQ processor for Subscription lifecycle management.
 * @param {import('bullmq').Job} job
 */
export const processSubscriptionJob = async (job) => {
    const action = job?.data?.action || 'CHECK_EXPIRY';

    logger.info(`[BullMQ:subscription] action=${action} jobId=${job.id}`);

    try {
        if (action === 'CHECK_EXPIRY') {
            const results = await subscriptionService.processSubscriptionExpiry();
            return { processed: true, ...results };
        }
    } catch (err) {
        logger.error(`[BullMQ:subscription] Job ${job.id} failed: ${err.message}`);
        throw err;
    }

    return { processed: false, reason: 'unknown_action' };
};

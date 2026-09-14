import { logger } from '../../utils/logger.js';
import { PAYMENT_QUEUE_ACTIONS } from '../../modules/food/orders/services/order.helpers.js';

/**
 * BullMQ processor for order lifecycle jobs.
 *
 * Payment settlement actions are bridged to the payment processor so older
 * jobs still on the order queue do not silently skip wallet credits.
 * @param {import('bullmq').Job} job
 */
export const processOrderJob = async (job) => {
    const data = job?.data || {};
    const action = data.action || 'unknown';
    const orderId = data.orderId || '';
    const orderMongoId = data.orderMongoId || '';

    logger.info(
        `[BullMQ:order] action=${action} jobId=${job.id} orderId=${orderId} orderMongoId=${orderMongoId}`
    );

    // Bridge payment settlement actions (legacy order-queue jobs / misroutes).
    if (PAYMENT_QUEUE_ACTIONS.includes(action)) {
        try {
            const { processPaymentJob } = await import('./payment.processor.js');
            return await processPaymentJob(job);
        } catch (err) {
            logger.error(`[BullMQ:order] payment bridge failed for ${action}: ${err.message}`);
            throw err;
        }
    }

    // Handle Smart Dispatch Timeout
    if (action === 'DISPATCH_TIMEOUT_CHECK') {
        try {
            const { processDispatchTimeout } = await import('../../modules/food/orders/services/order.service.js');
            // Pass full data object to allow attempt count and other options
            await processDispatchTimeout(orderMongoId, data.partnerId, data);
        } catch (err) {
            logger.error(`[BullMQ:order] DISPATCH_TIMEOUT_CHECK failed: ${err.message}`);
        }
    }

    // Handle Periodic Watchdog Recovery
    if (action === 'WATCHDOG_AUTO_RECOVER') {
        try {
            const { recoverStuckOrders } = await import('../../modules/food/orders/services/order.service.js');
            await recoverStuckOrders();
            return { processed: true, action, jobId: job.id };
        } catch (err) {
            logger.error(`[BullMQ:order] WATCHDOG_AUTO_RECOVER failed: ${err.message}`);
            throw err;
        }
    }

    // Handle Scheduled Order Activation (PRIMARY path — T−lead delayed job)
    if (action === 'NOTIFY_SCHEDULED_ORDER') {
        const { processScheduledOrderNotification } = await import('../../modules/food/orders/services/order.service.js');
        const result = await processScheduledOrderNotification(orderMongoId, {
            source: 'bullmq',
        });
        // Already activated / cancelled → ack job (no retry spam when Redis returns)
        if (result?.alreadyHandled) {
            logger.info(
                `[BullMQ:order] NOTIFY_SCHEDULED_ORDER skipped (alreadyHandled) orderMongoId=${orderMongoId}`
            );
            return { processed: true, action, jobId: job.id, skipped: true };
        }
        if (!result?.success) {
            throw new Error(result?.reason || 'NOTIFY_SCHEDULED_ORDER failed');
        }
    }

    // Food Quick Delivery SLA compensation (wallet / pending refund)
    if (action === 'QUICK_SLA_COMPENSATE') {
        const { processQuickSlaCompensation } = await import(
            '../../modules/food/orders/services/quick-sla.service.js'
        );
        const result = await processQuickSlaCompensation(orderMongoId);
        if (!result?.success && !result?.alreadyHandled) {
            throw new Error(result?.reason || 'QUICK_SLA_COMPENSATE failed');
        }
        return { processed: true, action, jobId: job.id, ...result };
    }

    return { processed: true, action, jobId: job.id };
};

import { logger } from '../../utils/logger.js';

/**
 * Order-lifecycle events that carry money movement and are handled by the payment
 * processor. Keep in sync with the switch in payment.processor.js.
 */
const PAYMENT_ACTIONS = new Set(['delivery_completed', 'order_cancelled', 'payment_verified']);

/**
 * BullMQ processor for order lifecycle jobs.
 *
 * Current implementation is intentionally logging-only to avoid changing API behavior.
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

    // NOTE ON IMPORT DEPTH: this file lives at src/queues/processors/, so the modules
    // tree is '../../modules/…'. These imports previously used '../../../modules/…',
    // which resolves outside src/ to a directory that does not exist — every call threw
    // and was swallowed by the catch below, silently disabling dispatch timeouts and
    // scheduled-order activation.

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

    // Handle Scheduled Order Activation
    if (action === 'NOTIFY_SCHEDULED_ORDER') {
        try {
            const { processScheduledOrderNotification } = await import('../../modules/food/orders/services/order.service.js');
            await processScheduledOrderNotification(orderMongoId);
        } catch (err) {
            logger.error(`[BullMQ:order] NOTIFY_SCHEDULED_ORDER failed: ${err.message}`);
        }
    }

    // Money-movement events are produced onto this queue, but the payout logic lives in
    // the payment processor. Nothing ever enqueued onto PAYMENT_QUEUE, so without this
    // hand-off rider earnings and platform profit were never credited in production.
    if (PAYMENT_ACTIONS.has(action)) {
        try {
            const { processPaymentJob } = await import('./payment.processor.js');
            await processPaymentJob(job);
        } catch (err) {
            logger.error(`[BullMQ:order] payment handling for action=${action} failed: ${err.message}`);
            throw err; // let BullMQ retry — this is money, not a notification
        }
    }

    return { processed: true, action, jobId: job.id };
};

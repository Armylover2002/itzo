import { Queue } from 'bullmq';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getBullMQConnection } from './connection.js';
import {
    OTP_QUEUE,
    NOTIFICATION_QUEUE,
    ORDER_QUEUE,
    PAYMENT_QUEUE,
    TRACKING_QUEUE,
    SUBSCRIPTION_QUEUE,
    QUEUE_NAMES
} from './queue.constants.js';

/** @type {Map<string, Queue>} */
const queueInstances = new Map();

/**
 * Default job options: retry, backoff, cleanup.
 * Applied to all queues when BULLMQ_ENABLED=true.
 */
const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000
    },
    removeOnComplete: {
        count: 1000
    },
    removeOnFail: {
        age: 24 * 3600
    }
};

/**
 * Create and cache a single queue by name.
 * @param {string} queueName
 * @returns {Queue | null}
 */
const createQueue = (queueName) => {
    const conn = getBullMQConnection();
    if (!conn) return null;
    const queue = new Queue(queueName, {
        connection: conn,
        defaultJobOptions
    });
    queueInstances.set(queueName, queue);
    return queue;
};

/**
 * Get or create a queue by name. Returns null if BullMQ is disabled or Redis unavailable.
 * @param {string} queueName
 * @returns {Queue | null}
 */
export const getQueue = (queueName) => {
    if (!config.bullmqEnabled) {
        return null;
    }
    if (!config.redisEnabled) {
        return null;
    }
    if (queueInstances.has(queueName)) {
        return queueInstances.get(queueName);
    }
    return createQueue(queueName);
};

/**
 * Initialize all queue instances (for producer use). Does NOT start workers.
 * Workers run in separate processes and use workers/*.js.
 * @returns {{ initialized: boolean, queues: string[] }}
 */
export const initializeQueues = () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled (BULLMQ_ENABLED is not true). Queues will not be initialized.');
        return { initialized: false, queues: [] };
    }

    if (!config.redisEnabled) {
        logger.warn('BullMQ is enabled but Redis is disabled. Queues will not be initialized.');
        return { initialized: false, queues: [] };
    }

    const conn = getBullMQConnection();
    if (!conn) {
        logger.warn('BullMQ enabled but REDIS_URL missing or connection failed. Queues not initialized.');
        return { initialized: false, queues: [] };
    }

    const initialized = [];
    for (const name of QUEUE_NAMES) {
        try {
            createQueue(name);
            initialized.push(name);
        } catch (err) {
            logger.error(`BullMQ queue "${name}" initialization failed: ${err.message}`);
        }
    }
    if (initialized.length > 0) {
        logger.info(`BullMQ initialized with ${initialized.length} queues: ${initialized.join(', ')}`);
        
        // Initialize recurring schedules
        initSubscriptionSchedules();
    }
    return { initialized: initialized.length === QUEUE_NAMES.length, queues: initialized };
};

/**
 * Named queue getters for convenience.
 */
export const getOtpQueue = () => getQueue(OTP_QUEUE);
export const getNotificationQueue = () => getQueue(NOTIFICATION_QUEUE);
export const getOrderQueue = () => getQueue(ORDER_QUEUE);
export const getPaymentQueue = () => getQueue(PAYMENT_QUEUE);
export const getTrackingQueue = () => getQueue(TRACKING_QUEUE);
export const getSubscriptionQueue = () => getQueue(SUBSCRIPTION_QUEUE);

/**
 * ✅ NEW: Schedules the hourly subscription expiry check.
 */
export const initSubscriptionSchedules = async () => {
    if (!config.bullmqEnabled) return;
    const queue = getSubscriptionQueue();
    if (!queue) return;

    try {
        // Schedule hourly check
        await queue.add(
            'check_subscription_expiry',
            { action: 'CHECK_EXPIRY' },
            {
                repeat: { pattern: '0 * * * *' }, // Every hour at minute 0
                jobId: 'hourly_subscription_check', // Unique ID to prevent duplicates
                removeOnComplete: true,
                removeOnFail: true
            }
        );
        logger.info('Subscription Schedule: Hourly expiry check initialized');
    } catch (err) {
        logger.error(`Subscription Schedule Failed: ${err.message}`);
    }
};

/**
 * Schedules the periodic watchdog for stuck orders.
 */
export const initOrderSchedules = async () => {
    if (!config.bullmqEnabled) return;
    const queue = getOrderQueue();
    if (!queue) return;

    try {
        // Schedule every 30 minutes
        await queue.add(
            'watchdog_auto_recover',
            { action: 'WATCHDOG_AUTO_RECOVER' },
            {
                repeat: { pattern: '*/30 * * * *' }, // Every 30 minutes
                jobId: 'watchdog_auto_recover_periodic', // Unique ID to prevent duplicates
                removeOnComplete: true,
                removeOnFail: true
            }
        );
        logger.info('Order Schedule: Periodic watchdog initialized');
    } catch (err) {
        logger.error(`Order Schedule Failed: ${err.message}`);
    }
};

/**
 * Get job counts per queue for admin observability. Returns [] if BullMQ disabled.
 * @returns {Promise<Array<{ name: string, waiting: number, active: number, completed: number, failed: number }>>}
 */
export const getQueueStats = async () => {
    if (!config.bullmqEnabled) return [];
    const stats = [];
    for (const name of QUEUE_NAMES) {
        const queue = getQueue(name);
        if (!queue) continue;
        try {
            const counts = await queue.getJobCounts();
            stats.push({ name, ...counts });
        } catch (err) {
            logger.error(`Queue ${name} getJobCounts failed: ${err.message}`);
            stats.push({ name, waiting: 0, active: 0, completed: 0, failed: 0, error: err.message });
        }
    }
    return stats;
};

export { OTP_QUEUE, NOTIFICATION_QUEUE, ORDER_QUEUE, PAYMENT_QUEUE, TRACKING_QUEUE, SUBSCRIPTION_QUEUE, QUEUE_NAMES } from './queue.constants.js';
export { getBullMQConnection, closeBullMQConnection } from './connection.js';

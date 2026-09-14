import IORedis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

/**
 * BullMQ requires ioredis with maxRetriesPerRequest: null.
 * Uses REDIS_URL from environment. Does not interfere with existing Redis (config/redis.js).
 */
const getRetryStrategy = () => (times) => {
    const delay = Math.min(DEFAULT_RETRY_DELAY_MS * Math.pow(2, times), MAX_RETRY_DELAY_MS);
    logger.warn(`BullMQ Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
};

let connection = null;

/**
 * Creates and returns a BullMQ-compatible Redis connection.
 * Caller should check BULLMQ_ENABLED and redisUrl before using.
 * @returns {IORedis | null}
 */
export const getBullMQConnection = () => {
    if (!config.redisEnabled) {
        logger.warn('BullMQ: Redis is disabled (REDIS_ENABLED is not true), queue connection skipped.');
        return null;
    }

    if (!config.redisUrl) {
        logger.warn('BullMQ: REDIS_URL not set, queue connection skipped.');
        return null;
    }

    if (connection) {
        return connection;
    }

    connection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy: getRetryStrategy()
    });

    connection.on('error', (err) => {
        logger.error(`BullMQ Redis connection error: ${err.message}`);
    });

    connection.on('connect', () => {
        logger.info('BullMQ Redis connection established');
    });

    connection.on('close', () => {
        logger.warn('BullMQ Redis connection closed');
    });

    return connection;
};

/**
 * Close the BullMQ Redis connection (e.g. on graceful shutdown).
 * @returns {Promise<void>}
 */
export const closeBullMQConnection = async () => {
    if (connection) {
        await connection.quit();
        connection = null;
        logger.info('BullMQ Redis connection closed');
    }
};

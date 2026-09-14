import mongoose from 'mongoose';
import { config } from './env.js';
import { getRedisClient } from './redis.js';

/**
 * Minimal health check: server, MongoDB, Redis (if enabled).
 * Does not expose internal secrets.
 */
export const healthCheck = async () => {
    const mongoState = mongoose.connection.readyState;
    const mongoOk = mongoState === 1; // 1 = connected

    let redisOk = null;
    if (config.redisEnabled) {
        const client = getRedisClient();
        redisOk = client ? 'ok' : 'unavailable';
        if (client) {
            try {
                await client.ping();
            } catch {
                redisOk = 'unavailable';
            }
        }
    } else {
        redisOk = 'disabled';
    }

    return {
        status: 'UP',
        mongo: mongoOk ? 'connected' : 'disconnected',
        redis: redisOk
    };
};

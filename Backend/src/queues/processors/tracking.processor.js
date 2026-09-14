import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodOrder } from '../../modules/food/orders/models/order.model.js';
import { logger } from '../../utils/logger.js';
import { connectDB } from '../../config/db.js';
import { getRedisClient } from '../../config/redis.js';

let isDBConnected = false;

const ensureDB = async () => {
    if (isDBConnected) return;
    await connectDB();
    isDBConnected = true;
};

/**
 * Syncs the latest location from "HOT" Redis storage to "COLD" MongoDB storage.
 */
export const processTrackingJob = async (job) => {
    await ensureDB();
    const { name, data } = job;

    if (name === 'sync-hot-locations') {
        return await handleHotSync(data);
    }
    return null;
};

const handleHotSync = async ({ userId, orderId }) => {
    const redis = getRedisClient();
    if (!redis) return;

    try {
        // Fetch the absolute latest location for both rider and order from Redis
        const [riderRaw, orderRaw] = await Promise.all([
            redis.hGet('rider:locations:hot', String(userId)),
            redis.hGet('order:locations:hot', String(orderId))
        ]);

        const riderData = riderRaw ? JSON.parse(riderRaw) : null;
        const orderData = orderRaw ? JSON.parse(orderRaw) : null;

        const updates = [];

        if (riderData && userId) {
            updates.push(
                FoodDeliveryPartner.findByIdAndUpdate(userId, {
                    $set: {
                        lastLocation: {
                            type: 'Point',
                            coordinates: [riderData.lng, riderData.lat]
                        }
                    }
                })
            );
        }

        if (orderData && orderId) {
            updates.push(
                FoodOrder.findOneAndUpdate({ orderId }, {
                    $set: {
                        lastRiderLocation: {
                            type: 'Point',
                            coordinates: [orderData.lng, orderData.lat]
                        }
                    }
                })
            );
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            logger.info(`Synced hot location to MongoDB for Order ${orderId} / Rider ${userId}`);
        }
    } catch (err) {
        logger.error(`Failed to handle hot sync for ${orderId}: ${err.message}`);
        throw err;
    }
};

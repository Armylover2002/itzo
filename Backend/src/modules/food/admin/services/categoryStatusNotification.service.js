import mongoose from 'mongoose';
import { FoodItem } from '../models/food.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { notifyOwnersSafely } from '../../../../core/notifications/firebase.service.js';
import { computeNotificationExpiresAt } from '../../../../core/notifications/utils/notificationTtl.js';
import { bulkWriteInChunks } from '../../../../core/notifications/utils/bulkWriteChunks.js';
import { getIO, rooms } from '../../../../config/socket.js';

const INACTIVE_WARNING = 'This category is currently inactive and is not available for use.';

const toIdString = (value) => {
    if (!value) return '';
    if (value._id) return String(value._id);
    return String(value);
};

/**
 * Collect every restaurant that is associated with a category so we can notify them
 * when the category is deactivated/reactivated by an admin. Association means either:
 * - the restaurant owns/created the category, or
 * - the restaurant has one or more food items linked to the category.
 */
const resolveAssociatedRestaurantIds = async (category) => {
    const categoryId = toIdString(category?._id || category?.id);
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) return [];

    const ids = new Set();

    const ownerId = toIdString(category?.restaurantId);
    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) ids.add(ownerId);

    const creatorId = toIdString(category?.createdByRestaurantId);
    if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) ids.add(creatorId);

    const linkedRestaurantIds = await FoodItem.distinct('restaurantId', {
        categoryId: new mongoose.Types.ObjectId(categoryId)
    });
    for (const value of linkedRestaurantIds) {
        const id = toIdString(value);
        if (id && mongoose.Types.ObjectId.isValid(id)) ids.add(id);
    }

    return [...ids];
};

const emitRealtimeCategoryNotification = (restaurantIds = [], payload = {}) => {
    const io = getIO();
    if (!io) return;

    for (const restaurantId of restaurantIds) {
        io.to(rooms.restaurant(restaurantId)).emit('admin_notification', {
            ...payload,
            targetType: 'RESTAURANT'
        });
    }
};

/**
 * Notify all restaurants associated with a food category when an admin flips its
 * active status. Deactivation surfaces the standard inactive warning; reactivation
 * clears it. Failures here must never break the admin status-toggle flow, so all
 * work is wrapped defensively.
 */
export const notifyCategoryStatusChange = async (category, { isActive } = {}) => {
    try {
        if (!category) return { notifiedCount: 0 };

        const restaurantIds = await resolveAssociatedRestaurantIds(category);
        if (!restaurantIds.length) return { notifiedCount: 0 };

        const categoryId = toIdString(category?._id || category?.id);
        const categoryName = String(category?.name || 'A category').trim() || 'A category';
        const deactivated = isActive === false;

        const title = deactivated ? 'Category Deactivated' : 'Category Reactivated';
        const message = deactivated
            ? `"${categoryName}" has been deactivated by the admin. ${INACTIVE_WARNING}`
            : `"${categoryName}" is active again and available for use.`;

        const metadata = {
            categoryId,
            categoryName,
            isActive: !deactivated,
            warning: deactivated ? INACTIVE_WARNING : ''
        };

        const now = new Date();
        const createdAt = now.toISOString();

        const operations = restaurantIds.map((restaurantId) => ({
            updateOne: {
                filter: {
                    ownerType: 'RESTAURANT',
                    ownerId: new mongoose.Types.ObjectId(restaurantId),
                    source: 'CATEGORY_STATUS',
                    'metadata.categoryId': categoryId
                },
                update: {
                    $set: {
                        ownerType: 'RESTAURANT',
                        ownerId: new mongoose.Types.ObjectId(restaurantId),
                        title,
                        message,
                        link: '/restaurant/menu-categories',
                        category: 'category',
                        source: 'CATEGORY_STATUS',
                        metadata,
                        dismissedAt: null,
                        isRead: false,
                        readAt: null,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        broadcastId: new mongoose.Types.ObjectId(),
                        createdAt: now,
                        expiresAt: computeNotificationExpiresAt(now)
                    }
                },
                upsert: true
            }
        }));

        if (operations.length) {
            await bulkWriteInChunks(FoodNotification.collection, operations, { ordered: false });
        }

        await notifyOwnersSafely(
            restaurantIds.map((restaurantId) => ({ ownerType: 'RESTAURANT', ownerId: restaurantId })),
            {
                title,
                body: message,
                data: {
                    type: 'category_status',
                    categoryId,
                    isActive: String(!deactivated)
                }
            }
        );

        emitRealtimeCategoryNotification(restaurantIds, {
            id: `category-status-${categoryId}`,
            title,
            message,
            link: '/restaurant/menu-categories',
            category: 'category',
            createdAt
        });

        return { notifiedCount: restaurantIds.length };
    } catch (error) {
        // Notification issues should never block the admin status change itself.
        console.error('notifyCategoryStatusChange failed:', error?.message || error);
        return { notifiedCount: 0, error: true };
    }
};

export const CATEGORY_INACTIVE_WARNING = INACTIVE_WARNING;

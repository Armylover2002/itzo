import mongoose from 'mongoose';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { notifyAdminsSafely } from '../../../../core/notifications/firebase.service.js';
import { notifyOwnerWithInbox } from '../../../../core/notifications/ownerInboxNotify.js';
import { computeNotificationExpiresAt } from '../../../../core/notifications/utils/notificationTtl.js';
import { bulkWriteInChunks } from '../../../../core/notifications/utils/bulkWriteChunks.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateLabel = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const nextDay = (date) => new Date(date.getTime() + DAY_MS);

const buildRestaurantNotificationPayload = (restaurant) => {
    const expiryDate = restaurant?.fssaiExpiry ? new Date(restaurant.fssaiExpiry) : null;
    const restaurantName = restaurant?.restaurantName || 'Restaurant';
    const ownerName = restaurant?.ownerName || 'Restaurant owner';
    const expiryLabel = toDateLabel(expiryDate);
    const title = 'FSSAI License Expired';
    const message = `${restaurantName} FSSAI license expired on ${expiryLabel}. Owner: ${ownerName}. FSSAI No: ${restaurant?.fssaiNumber || 'N/A'}.`;

    return {
        title,
        message,
        link: '/restaurant/fssai',
        category: 'compliance',
        source: 'FSSAI_EXPIRY',
        metadata: {
            restaurantId: String(restaurant?._id || ''),
            restaurantName,
            ownerName,
            ownerPhone: restaurant?.ownerPhone || '',
            fssaiNumber: restaurant?.fssaiNumber || '',
            expiryDate: expiryDate ? expiryDate.toISOString() : null
        }
    };
};

const buildAdminSummary = (restaurant) => {
    const expiryDate = restaurant?.fssaiExpiry ? new Date(restaurant.fssaiExpiry) : null;
    const expiryLabel = toDateLabel(expiryDate);
    return {
        id: `fssai-expired-${String(restaurant?._id || '')}`,
        restaurantId: String(restaurant?._id || ''),
        restaurantName: restaurant?.restaurantName || 'Restaurant',
        ownerName: restaurant?.ownerName || '',
        ownerPhone: restaurant?.ownerPhone || '',
        fssaiNumber: restaurant?.fssaiNumber || '',
        fssaiExpiry: expiryDate ? expiryDate.toISOString() : null,
        expiryLabel,
        title: 'FSSAI License Expired',
        message: `${restaurant?.restaurantName || 'Restaurant'} FSSAI expired on ${expiryLabel}. Owner: ${restaurant?.ownerName || 'N/A'}.`,
        createdAt: expiryDate ? expiryDate.toISOString() : restaurant?.updatedAt || restaurant?.createdAt || new Date().toISOString(),
        path: '/admin/food/restaurants'
    };
};

export const listExpiredFssaiRestaurants = async () => {
    const today = startOfToday();

    const restaurants = await FoodRestaurant.find({
        status: 'approved',
        fssaiExpiry: { $lt: nextDay(today) }
    })
        .select('restaurantName ownerName ownerPhone fssaiNumber fssaiExpiry')
        .sort({ fssaiExpiry: -1, updatedAt: -1 })
        .lean();

    return restaurants
        .filter((restaurant) => restaurant?.fssaiExpiry)
        .map(buildAdminSummary);
};

export const syncExpiredFssaiNotifications = async () => {
    const restaurants = await listExpiredFssaiRestaurants();

    const candidates = [];
    for (const summary of restaurants) {
        const expiryIso = summary.fssaiExpiry;
        const restaurantId = summary.restaurantId;
        if (!restaurantId || !expiryIso || !mongoose.Types.ObjectId.isValid(restaurantId)) {
            continue;
        }

        candidates.push({
            summary,
            restaurantId,
            expiryIso,
            payload: buildRestaurantNotificationPayload({
                _id: restaurantId,
                restaurantName: summary.restaurantName,
                ownerName: summary.ownerName,
                ownerPhone: summary.ownerPhone,
                fssaiNumber: summary.fssaiNumber,
                fssaiExpiry: expiryIso
            })
        });
    }

    if (!candidates.length) {
        return {
            totalExpired: restaurants.length,
            createdCount: 0
        };
    }

    const now = new Date();
    const expiresAt = computeNotificationExpiresAt(now);

    // Atomic upsert: create once per restaurant + expiryDate (same dedupe as former findOne + create).
    const operations = candidates.map(({ restaurantId, expiryIso, payload }) => ({
        updateOne: {
            filter: {
                ownerType: 'RESTAURANT',
                ownerId: new mongoose.Types.ObjectId(restaurantId),
                source: 'FSSAI_EXPIRY',
                'metadata.expiryDate': expiryIso
            },
            update: {
                $setOnInsert: {
                    ownerType: 'RESTAURANT',
                    ownerId: new mongoose.Types.ObjectId(restaurantId),
                    title: payload.title,
                    message: payload.message,
                    link: payload.link,
                    category: payload.category,
                    source: payload.source,
                    metadata: payload.metadata,
                    isRead: false,
                    readAt: null,
                    dismissedAt: null,
                    createdAt: now,
                    updatedAt: now,
                    expiresAt
                }
            },
            upsert: true
        }
    }));

    const writeResult = await bulkWriteInChunks(FoodNotification.collection, operations, {
        ordered: false
    });
    const upsertedIds = writeResult?.upsertedIds || {};
    const newlyCreated = Object.keys(upsertedIds)
        .map((index) => candidates[Number(index)])
        .filter(Boolean);

    // Push/admin alerts only for newly inserted inbox rows (unchanged business behavior).
    for (const item of newlyCreated) {
        const { summary, restaurantId, expiryIso, payload } = item;

        await notifyOwnerWithInbox(
            { ownerType: 'RESTAURANT', ownerId: restaurantId },
            {
                title: payload.title,
                body: payload.message,
                skipInbox: true,
                link: '/restaurant/fssai',
                data: {
                    type: 'fssai_expired',
                    restaurantId,
                    expiryDate: expiryIso,
                    fssaiNumber: summary.fssaiNumber || '',
                    link: '/restaurant/fssai',
                }
            }
        );

        await notifyAdminsSafely({
            title: 'Restaurant FSSAI Expired',
            body: `${summary.restaurantName} FSSAI expired on ${summary.expiryLabel}. Owner: ${summary.ownerName || 'N/A'}.`,
            data: {
                type: 'restaurant_fssai_expired',
                restaurantId,
                expiryDate: expiryIso,
                fssaiNumber: summary.fssaiNumber || ''
            }
        });
    }

    return {
        totalExpired: restaurants.length,
        createdCount: newlyCreated.length
    };
};

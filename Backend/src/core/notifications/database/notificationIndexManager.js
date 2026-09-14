import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { FoodNotification } from '../models/notification.model.js';
import { BroadcastNotification } from '../models/notificationBroadcast.model.js';
import { NotificationChannelSettings } from '../models/notificationChannel.model.js';
import {
    computeNotificationExpiresAt,
    NOTIFICATION_TTL_MS
} from '../utils/notificationTtl.js';

function indexKeyMatches(existingKey, desiredKey) {
    const a = existingKey || {};
    const b = desiredKey || {};
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return bKeys.every((k) => a[k] === b[k]);
}

async function createIndexIfMissing(collection, key, options = {}, existingIndexes = null) {
    const indexes = existingIndexes || (await collection.indexes());
    const name = options.name;

    const alreadyPresent = indexes.some((idx) => {
        if (name && idx.name === name) return true;
        if (!indexKeyMatches(idx.key, key)) return false;
        if (options.expireAfterSeconds !== undefined) {
            return Number(idx.expireAfterSeconds) === Number(options.expireAfterSeconds);
        }
        if (options.unique) {
            return idx.unique === true;
        }
        return true;
    });

    if (alreadyPresent) {
        return false;
    }

    try {
        await collection.createIndex(key, options);
        return true;
    } catch (err) {
        if (
            err?.code === 85 ||
            err?.code === 86 ||
            /already exists|equivalent index/i.test(String(err?.message || ''))
        ) {
            return false;
        }
        throw err;
    }
}

function findTtlIndex(indexes, field = 'expiresAt') {
    return (indexes || []).find((idx) => {
        if (!idx?.key || idx.key[field] !== 1) return false;
        return Number(idx.expireAfterSeconds) === 0;
    });
}

/**
 * Backfill expiresAt = createdAt + 24h for legacy docs missing the field.
 * Required so TTL can delete pre-TTL documents.
 */
async function backfillExpiresAt(collection) {
    const filter = {
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }]
    };
    const result = await collection.updateMany(filter, [
        {
            $set: {
                expiresAt: {
                    $add: [{ $ifNull: ['$createdAt', '$$NOW'] }, NOTIFICATION_TTL_MS]
                }
            }
        }
    ]);
    return Number(result?.modifiedCount || 0);
}

/**
 * Keep one document per role. Merge topics from duplicates into the newest doc, then delete extras.
 */
async function dedupeChannelRoles(db) {
    const col = db.collection('food_notification_channels');
    const duplicates = await col
        .aggregate([
            {
                $group: {
                    _id: '$role',
                    ids: { $push: '$_id' },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ])
        .toArray();

    let removed = 0;
    for (const group of duplicates) {
        const docs = await col
            .find({ _id: { $in: group.ids } })
            .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
            .toArray();
        if (docs.length < 2) continue;

        const [keeper, ...extras] = docs;
        const topicMap = new Map();
        for (const doc of docs) {
            for (const topic of doc.topics || []) {
                const key = String(topic?.key || '').trim();
                if (!key || topicMap.has(key)) continue;
                topicMap.set(key, topic);
            }
        }

        await col.updateOne(
            { _id: keeper._id },
            {
                $set: {
                    topics: [...topicMap.values()],
                    updatedAt: new Date()
                }
            }
        );

        const extraIds = extras.map((doc) => doc._id);
        if (extraIds.length) {
            const del = await col.deleteMany({ _id: { $in: extraIds } });
            removed += Number(del?.deletedCount || 0);
        }
    }

    return removed;
}

async function assertNotificationTtlIndexes(db) {
    const missing = [];

    {
        const indexes = await db.collection('food_notifications').indexes();
        if (!findTtlIndex(indexes, 'expiresAt')) {
            missing.push('food_notifications.expiresAt TTL (expireAfterSeconds:0)');
        }
    }

    {
        const indexes = await db.collection('food_notification_broadcasts').indexes();
        if (!findTtlIndex(indexes, 'expiresAt')) {
            missing.push('food_notification_broadcasts.expiresAt TTL (expireAfterSeconds:0)');
        }
    }

    {
        const indexes = await db.collection('food_notification_channels').indexes();
        const roleUnique = indexes.some(
            (idx) => idx?.key?.role === 1 && idx.unique === true
        );
        if (!roleUnique) {
            missing.push('food_notification_channels.role unique');
        }
    }

    if (missing.length) {
        const err = new Error(
            `Critical notification indexes missing after create: ${missing.join('; ')}`
        );
        err.code = 'NOTIFICATION_CRITICAL_INDEX_MISSING';
        throw err;
    }
}

let notificationIndexesReady = null;

/**
 * Ensure TTL indexes, backfill expiresAt, seed missing channel roles, and dedupe duplicates.
 * Creates indexes only when missing (autoIndex is disabled).
 * Throws if TTL / unique role indexes cannot be verified.
 */
export async function ensureNotificationIndexes() {
    if (notificationIndexesReady) return notificationIndexesReady;

    notificationIndexesReady = (async () => {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB not connected; cannot ensure notification indexes');
        }
        const db = mongoose.connection.db;

        await Promise.all([
            FoodNotification.createCollection().catch(() => {}),
            BroadcastNotification.createCollection().catch(() => {}),
            NotificationChannelSettings.createCollection().catch(() => {})
        ]);

        const notifCol = db.collection('food_notifications');
        const broadcastCol = db.collection('food_notification_broadcasts');
        const channelCol = db.collection('food_notification_channels');

        const [notifBackfill, broadcastBackfill] = await Promise.all([
            backfillExpiresAt(notifCol),
            backfillExpiresAt(broadcastCol)
        ]);
        if (notifBackfill || broadcastBackfill) {
            logger.info(
                `Notification TTL backfill: food_notifications=${notifBackfill}, food_notification_broadcasts=${broadcastBackfill}`
            );
        }

        // Strip duplicated profile fields from legacy documents (no-op when already clean).
        const [labelUnset, targetLabelUnset] = await Promise.all([
            notifCol.updateMany(
                {
                    $or: [
                        { 'metadata.ownerLabel': { $exists: true } },
                        { 'metadata.ownerSubLabel': { $exists: true } }
                    ]
                },
                {
                    $unset: {
                        'metadata.ownerLabel': '',
                        'metadata.ownerSubLabel': ''
                    }
                }
            ),
            broadcastCol.updateMany(
                {
                    $or: [
                        { 'targets.label': { $exists: true } },
                        { 'targets.subLabel': { $exists: true } }
                    ]
                },
                {
                    $unset: {
                        'targets.$[].label': '',
                        'targets.$[].subLabel': ''
                    }
                }
            )
        ]);
        if (labelUnset.modifiedCount || targetLabelUnset.modifiedCount) {
            logger.info(
                `Stripped legacy notification labels: inbox=${labelUnset.modifiedCount}, broadcasts=${targetLabelUnset.modifiedCount}`
            );
        }

        const channelDupesRemoved = await dedupeChannelRoles(db);
        if (channelDupesRemoved > 0) {
            logger.info(
                `Merged duplicate food_notification_channels docs; removed=${channelDupesRemoved}`
            );
        }

        // Create missing role docs only — never rewrite existing channel settings.
        // Seeding is performed by notificationStartupValidator (after indexes).

        const [notifIndexes, broadcastIndexes, channelIndexes, sellerNotifIndexes] = await Promise.all([
            notifCol.indexes(),
            broadcastCol.indexes(),
            channelCol.indexes(),
            db.collection('quick_seller_notifications').indexes().catch(() => [])
        ]);

        const sellerNotifCol = db.collection('quick_seller_notifications');

        const indexSpecs = [
            [notifCol, { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_1' }, notifIndexes],
            [
                broadcastCol,
                { expiresAt: 1 },
                { expireAfterSeconds: 0, name: 'expiresAt_1' },
                broadcastIndexes
            ],
            [channelCol, { role: 1 }, { unique: true, name: 'role_1' }, channelIndexes],
            [
                notifCol,
                { ownerType: 1, ownerId: 1, createdAt: -1 },
                { name: 'ownerType_1_ownerId_1_createdAt_-1' },
                notifIndexes
            ],
            [
                notifCol,
                { ownerType: 1, ownerId: 1, isRead: 1, dismissedAt: 1 },
                { name: 'ownerType_1_ownerId_1_isRead_1_dismissedAt_1' },
                notifIndexes
            ],
            [
                notifCol,
                { broadcastId: 1, ownerType: 1, ownerId: 1 },
                { unique: true, sparse: true, name: 'broadcastId_1_ownerType_1_ownerId_1' },
                notifIndexes
            ],
            [broadcastCol, { createdAt: -1 }, { name: 'createdAt_-1' }, broadcastIndexes],
            // Broadcast delete: SellerNotification.deleteMany({ key: 'broadcast:…' })
            [sellerNotifCol, { key: 1 }, { name: 'key_1' }, sellerNotifIndexes]
        ];

        let createdCount = 0;
        for (const [col, key, options, existing] of indexSpecs) {
            const created = await createIndexIfMissing(col, key, options, existing);
            if (created) createdCount += 1;
        }
        if (createdCount > 0) {
            logger.info(`Notification indexes created (missing only): ${createdCount}`);
        }

        await assertNotificationTtlIndexes(db);

        return {
            ok: true,
            computeExpiresAt: computeNotificationExpiresAt
        };
    })().catch((err) => {
        notificationIndexesReady = null;
        throw err;
    });

    return notificationIndexesReady;
}

export { computeNotificationExpiresAt, NOTIFICATION_TTL_MS };

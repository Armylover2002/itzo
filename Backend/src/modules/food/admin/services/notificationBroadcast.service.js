import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { Seller } from '../../../quick-commerce/seller/models/seller.model.js';
import { SellerNotification } from '../../../quick-commerce/seller/models/sellerNotification.model.js';
import { BroadcastNotification } from '../../../../core/notifications/models/notificationBroadcast.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { createInboxNotifications } from '../../../../core/notifications/notification.service.js';
import { notifyOwnersWithReport } from '../../../../core/notifications/firebase.service.js';
import { computeNotificationExpiresAt } from '../../../../core/notifications/utils/notificationTtl.js';
import { bulkWriteInChunks } from '../../../../core/notifications/utils/bulkWriteChunks.js';
import { getTopicChannelFlagsByOwnerTypes } from './notificationChannel.service.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { logger } from '../../../../utils/logger.js';
import { buildPaginationMeta, buildPaginationOptions } from '../../../../utils/helpers.js';

/** Audience / delivery batch size — keeps peak memory nearly constant. */
const BROADCAST_BATCH_SIZE = 750;
/** Yield the event loop every N socket emits within a batch. */
const SOCKET_EMIT_YIELD_EVERY = 100;

const TARGET_TYPE_MAP = {
    ALL: 'ALL',
    ALL_QC: 'ALL_QC',
    USER: 'USER',
    RESTAURANT: 'RESTAURANT',
    SELLER: 'SELLER',
    DELIVERY: 'DELIVERY',
    CUSTOM: 'CUSTOM'
};

const OWNER_LABEL_MAP = {
    ALL: 'All (Food)',
    ALL_QC: 'All (Quick Commerce)',
    USER: 'Users',
    RESTAURANT: 'Restaurants',
    SELLER: 'Sellers',
    DELIVERY: 'Delivery Partners',
    DELIVERY_PARTNER: 'Delivery Partners'
};

const toObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

const normalizeText = (value, fieldName, required = true) => {
    const text = String(value || '').trim();
    if (required && !text) {
        throw new ValidationError(`${fieldName} is required`);
    }
    return text;
};

const normalizeTargetType = (value) => {
    const nextValue = String(value || '').trim().toUpperCase();
    const normalized = TARGET_TYPE_MAP[nextValue];
    if (!normalized) {
        throw new ValidationError('targetType is invalid');
    }
    return normalized;
};

const modelConfigMap = {
    USER: {
        model: FoodUser,
        query: { isActive: true }
    },
    RESTAURANT: {
        model: FoodRestaurant,
        query: { status: 'approved' }
    },
    SELLER: {
        model: Seller,
        query: { approvalStatus: 'approved' }
    },
    DELIVERY_PARTNER: {
        model: FoodDeliveryPartner,
        query: { status: 'approved' }
    }
};

const ownerTypesForTargetType = (targetType) => {
    if (targetType === 'ALL') return ['USER', 'RESTAURANT', 'DELIVERY_PARTNER'];
    if (targetType === 'ALL_QC') return ['USER', 'SELLER', 'DELIVERY_PARTNER'];
    if (targetType === 'USER') return ['USER'];
    if (targetType === 'RESTAURANT') return ['RESTAURANT'];
    if (targetType === 'SELLER') return ['SELLER'];
    if (targetType === 'DELIVERY') return ['DELIVERY_PARTNER'];
    return [];
};

const dedupeTargets = (targets = []) => {
    const map = new Map();
    for (const target of Array.isArray(targets) ? targets : []) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        const ownerId = String(target?.ownerId || '').trim();
        if (!ownerType || !ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) continue;
        map.set(`${ownerType}:${ownerId}`, { ownerType, ownerId });
    }
    return [...map.values()];
};

const emptyPushSummary = () => ({
    attemptedRecipients: 0,
    recipientsWithSuccess: 0,
    recipientsWithoutTokens: 0,
    recipientsWithFailures: 0,
    totalTokenAttempts: 0,
    totalTokenSuccess: 0,
    totalTokenFailures: 0
});

const mergePushSummary = (acc, next = {}) => ({
    attemptedRecipients: acc.attemptedRecipients + Number(next.attemptedRecipients || 0),
    recipientsWithSuccess: acc.recipientsWithSuccess + Number(next.recipientsWithSuccess || 0),
    recipientsWithoutTokens: acc.recipientsWithoutTokens + Number(next.recipientsWithoutTokens || 0),
    recipientsWithFailures: acc.recipientsWithFailures + Number(next.recipientsWithFailures || 0),
    totalTokenAttempts: acc.totalTokenAttempts + Number(next.totalTokenAttempts || 0),
    totalTokenSuccess: acc.totalTokenSuccess + Number(next.totalTokenSuccess || 0),
    totalTokenFailures: acc.totalTokenFailures + Number(next.totalTokenFailures || 0)
});

/**
 * Count audience without materializing documents (role-based).
 * CUSTOM / explicit lists are counted from the request payload (already in memory).
 */
const countAudience = async ({ targetType, hasExplicitTargets, explicitTargets }) => {
    if (hasExplicitTargets) {
        return explicitTargets.length;
    }

    const ownerTypes = ownerTypesForTargetType(targetType);
    let total = 0;
    for (const ownerType of ownerTypes) {
        const config = modelConfigMap[ownerType];
        if (!config) continue;
        total += await config.model.countDocuments(config.query);
    }
    return total;
};

/**
 * Stream role-based recipients via cursor — never loads the full audience.
 * Order preserved: ownerTypes sequence, then _id ascending within each type
 * (same stable order as a sorted full find).
 */
async function* iterateOwnerTypeBatches(ownerType) {
    const config = modelConfigMap[ownerType];
    if (!config) return;

    const cursor = config.model
        .find(config.query)
        .select('_id')
        .lean()
        .cursor({ batchSize: BROADCAST_BATCH_SIZE });

    let batch = [];
    try {
        for await (const row of cursor) {
            const ownerId = String(row?._id || '');
            if (!ownerId) continue;
            batch.push({ ownerType, ownerId });
            if (batch.length >= BROADCAST_BATCH_SIZE) {
                yield batch;
                batch = [];
            }
        }
        if (batch.length) {
            yield batch;
        }
    } finally {
        if (typeof cursor.close === 'function') {
            await cursor.close().catch(() => {});
        }
    }
}

/**
 * Stream CUSTOM / explicit targets in fixed-size slices (request-bounded memory).
 * When only targetIds are provided, resolve active users in ID chunks (not one huge $in).
 */
async function* iterateExplicitTargetBatches(explicitTargets, targetIds = []) {
    if (explicitTargets.length > 0) {
        for (let i = 0; i < explicitTargets.length; i += BROADCAST_BATCH_SIZE) {
            yield explicitTargets.slice(i, i + BROADCAST_BATCH_SIZE);
        }
        return;
    }

    const ids = [
        ...new Set(
            (Array.isArray(targetIds) ? targetIds : [])
                .map((value) => String(value || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    ];
    if (!ids.length) {
        throw new ValidationError('Please select at least one recipient for custom broadcast');
    }

    for (let i = 0; i < ids.length; i += BROADCAST_BATCH_SIZE) {
        const chunkIds = ids.slice(i, i + BROADCAST_BATCH_SIZE);
        const users = await FoodUser.find({
            _id: { $in: chunkIds },
            isActive: true
        })
            .select('_id')
            .lean();

        if (!users.length) continue;
        yield users.map((row) => ({
            ownerType: 'USER',
            ownerId: String(row._id)
        }));
    }
}

async function* iterateAudienceBatches({
    targetType,
    hasExplicitTargets,
    explicitTargets,
    targetIds
}) {
    if (hasExplicitTargets) {
        yield* iterateExplicitTargetBatches(explicitTargets, targetIds);
        return;
    }

    for (const ownerType of ownerTypesForTargetType(targetType)) {
        yield* iterateOwnerTypeBatches(ownerType);
    }
}

/** Preload inApp/push flags once per ownerType — no per-recipient channel reads. */
const loadChannelFlagsByOwnerType = async (topicKey = 'admin_broadcast') =>
    getTopicChannelFlagsByOwnerTypes({
        ownerTypes: ['USER', 'RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'],
        topicKey
    });

const partitionBatchByChannels = (batch, flagsByOwnerType) => {
    const inAppTargets = [];
    const pushTargets = [];

    for (const target of batch) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        const flags = flagsByOwnerType.get(ownerType) || { inApp: true, push: true };
        if (flags.inApp) inAppTargets.push(target);
        if (flags.push) pushTargets.push(target);
    }

    return { inAppTargets, pushTargets };
};

const buildNotificationPayload = ({ title, message, link, broadcastId, target }) => {
    const trimmedLink = String(link || '').trim();
    return {
        ownerType: target.ownerType,
        ownerId: target.ownerId,
        title,
        message,
        broadcastId,
        ...(trimmedLink ? { link: trimmedLink } : {})
    };
};

const upsertSellerInboxNotifications = async ({ targets = [], broadcast, title, message, link }) => {
    const sellerTargets = (Array.isArray(targets) ? targets : []).filter(
        (target) => target?.ownerType === 'SELLER'
    );
    if (!sellerTargets.length) return;

    const broadcastId = String(broadcast?._id || '');
    if (!broadcastId) return;

    const operations = sellerTargets
        .map((target) => String(target?.ownerId || '').trim())
        .filter((sellerId) => mongoose.Types.ObjectId.isValid(sellerId))
        .map((sellerId) => ({
            updateOne: {
                filter: {
                    sellerId: new mongoose.Types.ObjectId(sellerId),
                    key: `broadcast:${broadcastId}`
                },
                update: {
                    $set: {
                        type: 'system',
                        title,
                        message,
                        metadata: {
                            source: 'admin_broadcast',
                            broadcastId,
                            ...(String(link || '').trim()
                                ? { link: String(link || '').trim() }
                                : {})
                        }
                    },
                    $setOnInsert: {
                        isRead: false,
                        expiresAt: computeNotificationExpiresAt(new Date())
                    }
                },
                upsert: true
            }
        }));

    if (!operations.length) return;
    await bulkWriteInChunks(SellerNotification, operations, { ordered: false });
};

/**
 * Emit socket events for one batch; yield periodically so the event loop stays responsive.
 * Payload object is built once per batch (not per recipient).
 */
const emitRealtimeNotificationsBatch = async (targets = [], broadcast) => {
    const io = getIO();
    if (!io || !targets.length) return;

    const payload = {
        id: String(broadcast._id),
        title: broadcast.title,
        message: broadcast.message,
        link: broadcast.link || '',
        targetType: broadcast.targetType,
        createdAt: broadcast.createdAt
    };

    for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        const ownerId = String(target.ownerId || '');
        if (!ownerId) continue;

        if (target.ownerType === 'USER') {
            io.to(rooms.user(ownerId)).emit('admin_notification', payload);
        } else if (target.ownerType === 'RESTAURANT') {
            io.to(rooms.restaurant(ownerId)).emit('admin_notification', payload);
        } else if (target.ownerType === 'SELLER') {
            io.to(rooms.seller(ownerId)).emit('admin_notification', payload);
        } else if (target.ownerType === 'DELIVERY_PARTNER') {
            io.to(rooms.delivery(ownerId)).emit('admin_notification', payload);
        }

        if (i > 0 && i % SOCKET_EMIT_YIELD_EVERY === 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
};

const paginationMeta = ({ page = 1, limit = 10 } = {}) => {
    const { page: nextPage, limit: nextLimit, skip } = buildPaginationOptions(
        { page, limit },
        { defaultLimit: 10, maxLimit: 100 }
    );

    return { page: nextPage, limit: nextLimit, skip };
};

export const createBroadcastNotification = async ({
    body = {},
    adminId,
    includeRecipientDetails = false
} = {}) => {
    const title = normalizeText(body?.title, 'title');
    const message = normalizeText(body?.message, 'message');
    const link = normalizeText(body?.link, 'link', false);
    const targetType = normalizeTargetType(body?.targetType);

    const hasExplicitTargets =
        (Array.isArray(body?.targets) && body.targets.length > 0) ||
        (Array.isArray(body?.targetIds) && body.targetIds.length > 0);

    const explicitTargets = hasExplicitTargets ? dedupeTargets(body?.targets) : [];
    // When only targetIds are sent, count after active-user resolution during streaming;
    // pre-count uses id list length as upper bound — prefer accurate count via streaming tally
    // for targetIds-only: countDocuments on those ids.
    let targetCount;
    if (hasExplicitTargets && explicitTargets.length > 0) {
        targetCount = explicitTargets.length;
    } else if (hasExplicitTargets) {
        const ids = [
            ...new Set(
                (Array.isArray(body?.targetIds) ? body.targetIds : [])
                    .map((value) => String(value || '').trim())
                    .filter((id) => mongoose.Types.ObjectId.isValid(id))
            )
        ];
        if (!ids.length) {
            throw new ValidationError('Please select at least one recipient for custom broadcast');
        }
        targetCount = await FoodUser.countDocuments({
            _id: { $in: ids },
            isActive: true
        });
    } else {
        targetCount = await countAudience({
            targetType,
            hasExplicitTargets: false,
            explicitTargets: []
        });
    }

    if (!targetCount) {
        throw new ValidationError(`No recipients found for ${targetType.toLowerCase()} broadcast`);
    }

    const createdAt = new Date();
    const isSelectionModeAll = !hasExplicitTargets;

    // Persist selected identities only for SELECTED mode (request-bounded). Role-wide ALL stores [].
    let selectedTargetIds = [];
    let selectedTargets = [];
    if (!isSelectionModeAll) {
        if (explicitTargets.length > 0) {
            selectedTargets = explicitTargets.map((target) => ({
                ownerType: target.ownerType,
                ownerId: toObjectId(target.ownerId, 'ownerId')
            }));
            selectedTargetIds = selectedTargets.map((t) => t.ownerId);
        } else {
            const ids = [
                ...new Set(
                    (Array.isArray(body?.targetIds) ? body.targetIds : [])
                        .map((value) => String(value || '').trim())
                        .filter((id) => mongoose.Types.ObjectId.isValid(id))
                )
            ];
            // Persist only active users (same as previous resolveCustomTargets filter).
            const activeUsers = await FoodUser.find({
                _id: { $in: ids },
                isActive: true
            })
                .select('_id')
                .lean();
            selectedTargets = activeUsers.map((row) => ({
                ownerType: 'USER',
                ownerId: row._id
            }));
            selectedTargetIds = selectedTargets.map((t) => t.ownerId);
            targetCount = selectedTargets.length;
        }
    }

    if (!targetCount) {
        throw new ValidationError(`No recipients found for ${targetType.toLowerCase()} broadcast`);
    }

    const broadcast = await BroadcastNotification.create({
        title,
        message,
        targetType,
        selectionMode: isSelectionModeAll ? 'ALL' : 'SELECTED',
        targetIds: isSelectionModeAll ? [] : selectedTargetIds,
        targets: isSelectionModeAll ? [] : selectedTargets,
        ...(link ? { link } : {}),
        createdBy: toObjectId(adminId, 'createdBy'),
        targetCount,
        createdAt,
        expiresAt: computeNotificationExpiresAt(createdAt)
    });

    // Drop large selected arrays from heap before streaming delivery (already persisted).
    selectedTargetIds = null;
    selectedTargets = null;

    const flagsByOwnerType = await loadChannelFlagsByOwnerType('admin_broadcast');
    const totalBatches = Math.max(1, Math.ceil(targetCount / BROADCAST_BATCH_SIZE));
    const startedAt = Date.now();

    logger.info(
        `Broadcast started id=${String(broadcast._id)} targetType=${targetType} recipients=${targetCount} batches=${totalBatches}`
    );

    let inAppRecipients = 0;
    let pushSummary = emptyPushSummary();
    const debugRecipients = includeRecipientDetails ? [] : null;
    let batchNumber = 0;
    let processedRecipients = 0;

    const pushPayload = {
        title,
        body: message,
        data: {
            type: 'admin_broadcast',
            broadcastId: String(broadcast._id),
            link
        }
    };

    for await (const batch of iterateAudienceBatches({
        targetType,
        hasExplicitTargets,
        explicitTargets,
        targetIds: body?.targetIds
    })) {
        if (!batch.length) continue;

        batchNumber += 1;
        processedRecipients += batch.length;

        logger.info(
            `Broadcast ${String(broadcast._id)} Batch ${batchNumber}/${totalBatches} size=${batch.length}`
        );

        const { inAppTargets, pushTargets } = partitionBatchByChannels(batch, flagsByOwnerType);
        inAppRecipients += inAppTargets.length;

        const foodInboxTargets = inAppTargets.filter((target) => target.ownerType !== 'SELLER');
        if (foodInboxTargets.length > 0) {
            await createInboxNotifications({
                notifications: foodInboxTargets.map((target) =>
                    buildNotificationPayload({
                        title,
                        message,
                        link,
                        broadcastId: broadcast._id,
                        target
                    })
                ),
                returnDocuments: false
            });
        }

        await upsertSellerInboxNotifications({
            targets: inAppTargets,
            broadcast,
            title,
            message,
            link
        });

        if (pushTargets.length > 0) {
            const batchPushReport = await notifyOwnersWithReport(
                pushTargets.map((target) => ({
                    ownerType: target.ownerType,
                    ownerId: target.ownerId
                })),
                pushPayload,
                { collectRecipients: includeRecipientDetails }
            );
            pushSummary = mergePushSummary(pushSummary, batchPushReport?.summary);
            if (includeRecipientDetails && Array.isArray(batchPushReport?.recipients)) {
                debugRecipients.push(...batchPushReport.recipients);
            }
        }

        await emitRealtimeNotificationsBatch(inAppTargets, broadcast);

        // Batch arrays fall out of scope each iteration — do not accumulate recipients.
    }

    const durationMs = Date.now() - startedAt;

    if (
        pushSummary.attemptedRecipients > 0 &&
        pushSummary.recipientsWithSuccess === 0
    ) {
        logger.error(
            `Broadcast ${String(broadcast._id)} push delivery failed for all recipients (attempted=${pushSummary.attemptedRecipients}, noTokens=${pushSummary.recipientsWithoutTokens}, tokenFailures=${pushSummary.totalTokenFailures})`
        );
    }

    logger.info(
        `Broadcast completed id=${String(broadcast._id)} recipients=${processedRecipients} inApp=${inAppRecipients} durationMs=${durationMs} pushSuccess=${pushSummary.recipientsWithSuccess} pushFailures=${pushSummary.recipientsWithFailures} pushNoTokens=${pushSummary.recipientsWithoutTokens}`
    );

    const deliveryReport = {
        inAppRecipients,
        push: {
            summary: {
                attemptedRecipients: Number(pushSummary.attemptedRecipients || 0),
                successRecipients: Number(pushSummary.recipientsWithSuccess || 0),
                failedRecipients: Number(pushSummary.recipientsWithFailures || 0),
                recipientsWithoutTokens: Number(pushSummary.recipientsWithoutTokens || 0),
                totalTokenAttempts: Number(pushSummary.totalTokenAttempts || 0),
                totalTokenSuccess: Number(pushSummary.totalTokenSuccess || 0),
                totalTokenFailures: Number(pushSummary.totalTokenFailures || 0)
            }
        },
        hasPushDeliveryFailure:
            Number(pushSummary.attemptedRecipients || 0) > 0 &&
            Number(pushSummary.recipientsWithSuccess || 0) === 0
    };

    if (includeRecipientDetails) {
        deliveryReport.push.recipients = debugRecipients || [];
    }

    return {
        broadcast: {
            _id: broadcast._id,
            title: broadcast.title,
            message: broadcast.message,
            targetType: broadcast.targetType,
            targetCount: broadcast.targetCount,
            createdBy: broadcast.createdBy,
            createdAt: broadcast.createdAt,
            ...(broadcast.link ? { link: broadcast.link } : {}),
            targetLabel:
                broadcast.targetType === 'CUSTOM'
                    ? `${Number(broadcast.targetCount || 0)} selected recipients`
                    : OWNER_LABEL_MAP[broadcast.targetType] || broadcast.targetType
        },
        deliveryReport
    };
};

export const getBroadcastNotifications = async ({ page = 1, limit = 10 } = {}) => {
    const { skip, ...meta } = paginationMeta({ page, limit });

    const [items, total] = await Promise.all([
        BroadcastNotification.find({})
            .select('_id title message targetType createdBy targetCount createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .populate('createdBy', 'name')
            .lean(),
        BroadcastNotification.countDocuments({})
    ]);

    return {
        items: items.map((item) => ({
            _id: item._id,
            title: item.title,
            message: item.message,
            targetType: item.targetType,
            targetCount: item.targetCount,
            createdAt: item.createdAt,
            createdBy: item.createdBy
                ? {
                    _id: item.createdBy._id,
                    name: item.createdBy.name || ''
                }
                : null,
            targetLabel:
                item.targetType === 'CUSTOM'
                    ? `${Number(item.targetCount || 0)} selected recipients`
                    : OWNER_LABEL_MAP[item.targetType] || item.targetType
        })),
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            totalItems: total,
            ...buildPaginationMeta({ totalItems: total, page: meta.page, limit: meta.limit })
        }
    };
};

export const deleteBroadcastNotification = async (broadcastId) => {
    const normalizedId = toObjectId(broadcastId, 'broadcastId');
    const broadcast = await BroadcastNotification.findByIdAndDelete(normalizedId).lean();

    if (!broadcast) {
        throw new NotFoundError('Broadcast notification not found');
    }

    const [foodDeleteResult, sellerDeleteResult] = await Promise.all([
        FoodNotification.deleteMany({ broadcastId: normalizedId }),
        SellerNotification.deleteMany({ key: `broadcast:${String(normalizedId)}` })
    ]);

    return {
        broadcast,
        deletedInboxCount:
            Number(foodDeleteResult?.deletedCount || 0) +
            Number(sellerDeleteResult?.deletedCount || 0)
    };
};

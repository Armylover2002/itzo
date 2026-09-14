import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../auth/errors.js';
import { FoodNotification } from './models/notification.model.js';
import { computeNotificationExpiresAt } from './utils/notificationTtl.js';
import { bulkWriteInChunks } from './utils/bulkWriteChunks.js';
import { buildPaginationMeta, buildPaginationOptions } from '../../utils/helpers.js';

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
    const { page: nextPage, limit: nextLimit, skip } = buildPaginationOptions(
        { page, limit },
        { defaultLimit: 20, maxLimit: 100 }
    );

    return { page: nextPage, limit: nextLimit, skip };
};

const normalizeOwnerType = (role) => {
    const normalized = String(role || '').trim().toUpperCase();
    if (normalized === 'USER' || normalized === 'CUSTOMER') return 'USER';
    if (normalized === 'RESTAURANT') return 'RESTAURANT';
    if (normalized === 'DELIVERY_PARTNER' || normalized === 'DELIVERY') return 'DELIVERY_PARTNER';
    if (normalized === 'SELLER') return 'SELLER';
    return null;
};

export const resolveInboxOwnerType = (ownerType, contextModule) =>
    normalizeOwnerType(ownerType) || normalizeOwnerType(contextModule);

const ensureObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

/** Strip duplicated / PII profile fields from inbox metadata. */
const sanitizeNotificationMetadata = (metadata = {}) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }
    const next = { ...metadata };
    delete next.ownerLabel;
    delete next.ownerSubLabel;
    delete next.label;
    delete next.subLabel;
    delete next.phone;
    delete next.email;
    // broadcastId lives on the document root — do not keep a duplicate copy in metadata.
    delete next.broadcastId;
    return next;
};

export const resolveNotificationOwnerFromRequest = (user = {}) => {
    const ownerType = normalizeOwnerType(user?.role);
    const ownerId = user?.userId || user?._id || null;

    if (!ownerType || !ownerId) {
        throw new ValidationError('Authenticated notification owner not found');
    }

    return {
        ownerType,
        ownerId: ensureObjectId(ownerId, 'ownerId')
    };
};

const ALLOWED_SOURCES = new Set([
    'ADMIN_BROADCAST',
    'FSSAI_EXPIRY',
    'CATEGORY_STATUS',
    'LICENSE_EXPIRY',
    'SYSTEM',
    'ORDER',
    'PAYMENT',
    'APPROVAL',
    'WITHDRAWAL',
]);

const normalizeSource = (value, category = '') => {
    const raw = String(value || '').trim().toUpperCase();
    if (ALLOWED_SOURCES.has(raw)) return raw;
    const cat = String(category || '').trim().toLowerCase();
    if (cat.includes('order')) return 'ORDER';
    if (cat.includes('payment') || cat.includes('wallet')) return 'PAYMENT';
    if (cat.includes('withdraw')) return 'WITHDRAWAL';
    if (cat.includes('approv') || cat.includes('reject') || cat.includes('category') || cat.includes('food') || cat.includes('addon')) {
        return 'APPROVAL';
    }
    if (cat.includes('fssai')) return 'FSSAI_EXPIRY';
    if (cat.includes('license')) return 'LICENSE_EXPIRY';
    if (cat === 'broadcast' || cat === 'admin') return 'ADMIN_BROADCAST';
    return 'SYSTEM';
};

export const createInboxNotifications = async ({
    notifications = [],
    returnDocuments = true
} = {}) => {
    const rows = Array.isArray(notifications)
        ? notifications.filter((item) => item?.ownerType && item?.ownerId && item?.title && item?.message)
        : [];

    if (!rows.length) return [];

    const expiresAt = computeNotificationExpiresAt(new Date());
    const resolvedBroadcastIds = [];

    const operations = rows.map((item) => {
        const hasExplicitBroadcastId =
            item.broadcastId && mongoose.Types.ObjectId.isValid(String(item.broadcastId));
        const trimmedLink = String(item.link || '').trim();
        const trimmedCategory = String(item.category || '').trim();
        const dedupeKey = String(item.dedupeKey || item.metadata?.dedupeKey || '').trim();
        const metadata = sanitizeNotificationMetadata({
            ...(item.metadata && typeof item.metadata === 'object' ? item.metadata : {}),
            ...(dedupeKey ? { dedupeKey } : {}),
        });
        const source = normalizeSource(item.source, trimmedCategory || item.data?.type);
        const broadcastId = hasExplicitBroadcastId
            ? new mongoose.Types.ObjectId(String(item.broadcastId))
            : new mongoose.Types.ObjectId();

        if (hasExplicitBroadcastId) {
            resolvedBroadcastIds.push(broadcastId);
        }

        const sharedFields = {
            ownerType: item.ownerType,
            ownerId: ensureObjectId(item.ownerId, 'ownerId'),
            title: String(item.title).trim(),
            message: String(item.message).trim(),
            source,
            ...(trimmedLink ? { link: trimmedLink } : {}),
            ...(trimmedCategory ? { category: trimmedCategory } : {}),
            ...(Object.keys(metadata).length ? { metadata } : {}),
            dismissedAt: null,
            isRead: false,
            readAt: null,
            // Keep transactional rows alive when the same event is refreshed.
            expiresAt,
        };

        // Prefer explicit broadcast / dedupe keys. Never collapse unrelated events by title+message
        // (that hid payment/order notifications behind a single read row).
        if (hasExplicitBroadcastId) {
            return {
                updateOne: {
                    filter: {
                        broadcastId,
                        ownerType: sharedFields.ownerType,
                        ownerId: sharedFields.ownerId,
                    },
                    update: {
                        $set: {
                            ...sharedFields,
                            broadcastId,
                        },
                    },
                    upsert: true,
                },
            };
        }

        if (dedupeKey) {
            // Preserve existing broadcastId on refresh; only set it when inserting.
            return {
                updateOne: {
                    filter: {
                        ownerType: sharedFields.ownerType,
                        ownerId: sharedFields.ownerId,
                        'metadata.dedupeKey': dedupeKey,
                    },
                    update: {
                        $set: sharedFields,
                        $setOnInsert: {
                            broadcastId,
                        },
                    },
                    upsert: true,
                },
            };
        }

        return {
            updateOne: {
                filter: {
                    broadcastId,
                    ownerType: sharedFields.ownerType,
                    ownerId: sharedFields.ownerId,
                },
                update: {
                    $set: {
                        ...sharedFields,
                        broadcastId,
                    },
                },
                upsert: true,
            },
        };
    });

    await bulkWriteInChunks(FoodNotification.collection, operations, { ordered: false });

    if (!returnDocuments) {
        return [];
    }

    if (resolvedBroadcastIds.length > 0) {
        return FoodNotification.find({ broadcastId: { $in: resolvedBroadcastIds } })
            .select('-__v')
            .sort({ createdAt: -1 })
            .lean();
    }

    return [];
};

export const getInboxNotifications = async ({
    ownerType,
    ownerId,
    page = 1,
    limit = 20,
    contextModule
} = {}) => {
    const normalizedOwnerType = resolveInboxOwnerType(ownerType, contextModule);
    if (!normalizedOwnerType) {
        throw new ValidationError('Invalid notification owner context');
    }
    const normalizedOwnerId = ensureObjectId(ownerId, 'ownerId');
    const { skip, ...meta } = normalizePagination({ page, limit });

    const filter = {
        ownerType: normalizedOwnerType,
        ownerId: normalizedOwnerId,
        dismissedAt: null
    };

    const [items, total, unreadCount] = await Promise.all([
        FoodNotification.find(filter)
            .select(
                'ownerType ownerId title message link category source broadcastId metadata isRead readAt createdAt updatedAt'
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .lean(),
        FoodNotification.countDocuments(filter),
        FoodNotification.countDocuments({
            ...filter,
            isRead: false
        })
    ]);

    return {
        items,
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            ...buildPaginationMeta({ totalItems: total, page: meta.page, limit: meta.limit })
        },
        unreadCount
    };
};

export const markNotificationAsRead = async ({
    notificationId,
    ownerType,
    ownerId,
    contextModule
} = {}) => {
    const normalizedOwnerType = resolveInboxOwnerType(ownerType, contextModule);
    if (!normalizedOwnerType) {
        throw new ValidationError('Invalid notification owner context');
    }
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizedOwnerType,
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    )
        .select(
            'ownerType ownerId title message link category source broadcastId metadata isRead readAt createdAt updatedAt'
        )
        .lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissNotification = async ({
    notificationId,
    ownerType,
    ownerId,
    contextModule
} = {}) => {
    const normalizedOwnerType = resolveInboxOwnerType(ownerType, contextModule);
    if (!normalizedOwnerType) {
        throw new ValidationError('Invalid notification owner context');
    }
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizedOwnerType,
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    )
        .select('_id dismissedAt isRead readAt')
        .lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissAllNotifications = async ({ ownerType, ownerId, contextModule } = {}) => {
    const normalizedOwnerType = resolveInboxOwnerType(ownerType, contextModule);
    if (!normalizedOwnerType) {
        throw new ValidationError('Invalid notification owner context');
    }
    const result = await FoodNotification.updateMany(
        {
            ownerType: normalizedOwnerType,
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        }
    );

    return {
        modifiedCount: Number(result?.modifiedCount || 0)
    };
};

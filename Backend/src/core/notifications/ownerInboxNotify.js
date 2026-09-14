import mongoose from 'mongoose';
import { FoodAdmin } from '../admin/admin.model.js';
import { getIO, rooms } from '../../config/socket.js';
import { createInboxNotifications } from './notification.service.js';
import { notifyOwnerSafely, notifyOwnersSafely } from './firebase.service.js';

const INBOX_OWNER_TYPES = new Set(['USER', 'RESTAURANT', 'DELIVERY_PARTNER']);

/** Offer / hunt pushes are ephemeral — keep FCM+socket, skip bell spam. */
const SKIP_INBOX_TYPES = new Set([
    'new_order_available',
    'dispatch_offer',
    'play_notification_sound',
]);

const resolveMessage = (payload = {}) =>
    String(payload.body || payload.message || '').trim();

/** Ensure stored inbox links work with /food/restaurant and /food/delivery routes. */
const normalizeFoodAppLink = (link) => {
    const trimmed = String(link || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/food/')) return trimmed;
    if (trimmed.startsWith('/restaurant/')) return `/food${trimmed}`;
    if (trimmed.startsWith('/delivery/')) return `/food${trimmed}`;
    if (trimmed.startsWith('/user/')) return `/food${trimmed}`;
    if (trimmed.startsWith('/quick/')) return trimmed;
    return trimmed;
};

const resolveLink = (payload = {}) =>
    normalizeFoodAppLink(payload.link || payload.data?.link || payload.data?.targetUrl || '');

const resolveCategory = (payload = {}) =>
    String(payload.category || payload.data?.type || 'system').trim();

const resolveSource = (payload = {}) => {
    const explicit = String(payload.source || '').trim().toUpperCase();
    if (explicit) return explicit;
    return resolveCategory(payload);
};

const resolveDedupeKey = (payload = {}, ownerType, ownerId) => {
    const explicit = String(payload.dedupeKey || payload.metadata?.dedupeKey || '').trim();
    if (explicit) return explicit;
    const type = String(payload.data?.type || payload.category || '').trim();
    const orderId = String(
        payload.data?.orderId ||
            payload.data?.orderMongoId ||
            payload.data?.withdrawalId ||
            payload.data?.categoryId ||
            payload.data?.id ||
            '',
    ).trim();
    if (type && orderId) return `${type}:${orderId}:${ownerType}:${ownerId}`;
    return '';
};

const shouldSkipInbox = (payload = {}) => {
    if (payload?.skipInbox === true) return true;
    const type = String(payload?.data?.type || '').trim().toLowerCase();
    return SKIP_INBOX_TYPES.has(type);
};

const emitInboxRefresh = (ownerType, ownerId, partial = {}) => {
    const io = getIO();
    if (!io || !ownerId) return;

    const id = String(ownerId);
    if (!mongoose.Types.ObjectId.isValid(id)) return;

    const socketPayload = {
        title: partial.title || '',
        message: partial.message || '',
        link: partial.link || '',
        createdAt: new Date().toISOString(),
    };

    const normalized = String(ownerType || '').toUpperCase();
    if (normalized === 'RESTAURANT') {
        io.to(rooms.restaurant(id)).emit('admin_notification', socketPayload);
        io.to(rooms.restaurant(id)).emit('restaurant_notification', socketPayload);
    } else if (normalized === 'DELIVERY_PARTNER') {
        io.to(rooms.delivery(id)).emit('admin_notification', socketPayload);
    } else if (normalized === 'USER') {
        io.to(rooms.user(id)).emit('admin_notification', socketPayload);
    }
};

export const emitAdminBellRefresh = async (extra = {}) => {
    try {
        const io = getIO();
        if (!io) return;

        const admins = await FoodAdmin.find({ isActive: true }).select('_id').lean();
        for (const admin of admins) {
            io.to(rooms.admin(admin._id)).emit('admin_notification', {
                type: 'refresh',
                ...extra,
            });
        }
    } catch {
        // Non-blocking
    }
};

export const notifyOwnerWithInbox = async (target = {}, payload = {}) => {
    const ownerType = String(target?.ownerType || '').toUpperCase();
    const ownerId = target?.ownerId;
    const title = String(payload?.title || 'Notification').trim();
    const message = resolveMessage(payload);
    const skipInbox = shouldSkipInbox(payload);
    const link = resolveLink(payload);

    if (
        !skipInbox &&
        ownerType &&
        ownerId &&
        INBOX_OWNER_TYPES.has(ownerType) &&
        title &&
        message &&
        mongoose.Types.ObjectId.isValid(String(ownerId))
    ) {
        const category = resolveCategory(payload);
        const source = resolveSource(payload);
        const dedupeKey = resolveDedupeKey(payload, ownerType, ownerId);
        const metadata =
            payload?.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
                ? payload.metadata
                : {};

        try {
            await createInboxNotifications({
                notifications: [
                    {
                        ownerType,
                        ownerId,
                        title,
                        message,
                        source,
                        ...(link ? { link } : {}),
                        ...(category ? { category } : {}),
                        ...(dedupeKey ? { dedupeKey } : {}),
                        metadata: {
                            ...metadata,
                            ...(payload?.data && typeof payload.data === 'object' ? { data: payload.data } : {}),
                        },
                    },
                ],
                returnDocuments: false,
            });
        } catch (err) {
            console.error('notifyOwnerWithInbox: inbox persist failed:', err?.message || err);
        }
    }

    if (ownerType && ownerId && INBOX_OWNER_TYPES.has(ownerType)) {
        emitInboxRefresh(ownerType, ownerId, { title, message, link });
    }

    const pushPayload = {
        ...payload,
        ...(message ? { body: message } : {}),
    };
    delete pushPayload.skipInbox;
    delete pushPayload.dedupeKey;

    return notifyOwnerSafely(target, pushPayload);
};

export const notifyOwnersWithInbox = async (targets = [], payload = {}) => {
    const uniqueTargets = Array.isArray(targets)
        ? [...new Map(
              targets
                  .filter((t) => t?.ownerType && t?.ownerId)
                  .map((t) => [`${t.ownerType}:${t.ownerId}`, t])
          ).values()]
        : [];

    if (!uniqueTargets.length) return [];

    const message = resolveMessage(payload);
    const link = resolveLink(payload);
    const category = resolveCategory(payload);
    const source = resolveSource(payload);
    const title = String(payload?.title || 'Notification').trim();
    const skipInbox = shouldSkipInbox(payload);

    const inboxTargets = uniqueTargets.filter(
        (t) =>
            INBOX_OWNER_TYPES.has(String(t.ownerType || '').toUpperCase()) &&
            mongoose.Types.ObjectId.isValid(String(t.ownerId))
    );

    if (!skipInbox && inboxTargets.length && title && message) {
        try {
            await createInboxNotifications({
                notifications: inboxTargets.map((t) => {
                    const ownerType = String(t.ownerType).toUpperCase();
                    const dedupeKey = resolveDedupeKey(payload, ownerType, t.ownerId);
                    return {
                        ownerType,
                        ownerId: t.ownerId,
                        title,
                        message,
                        source,
                        ...(link ? { link } : {}),
                        ...(category ? { category } : {}),
                        ...(dedupeKey ? { dedupeKey } : {}),
                        metadata: {
                            ...(payload?.data && typeof payload.data === 'object' ? { data: payload.data } : {}),
                        },
                    };
                }),
                returnDocuments: false,
            });
        } catch (err) {
            console.error('notifyOwnersWithInbox: inbox persist failed:', err?.message || err);
        }
    }

    for (const t of inboxTargets) {
        emitInboxRefresh(String(t.ownerType).toUpperCase(), t.ownerId, { title, message, link });
    }

    const pushPayload = {
        ...payload,
        ...(message ? { body: message } : {}),
    };
    delete pushPayload.skipInbox;
    delete pushPayload.dedupeKey;

    return notifyOwnersSafely(uniqueTargets, pushPayload);
};

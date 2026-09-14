import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { NotificationChannelSettings } from '../../../../core/notifications/models/notificationChannel.model.js';

const VALID_ROLES = new Set(['admin', 'restaurant', 'customers', 'deliveryman']);
const CHANNEL_KEYS = ['push', 'mail', 'sms', 'inApp'];

const DEFAULT_TOPICS = {
    admin: [
        {
            key: 'forget_password',
            topic: 'Forget Password',
            description: 'Choose how admin will get notified about forget password events.',
            channels: { push: false, mail: true, sms: true, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'deliveryman_self_registration',
            topic: 'Deliveryman Self Registration',
            description: 'Choose how admin will get notified about deliveryman self registration.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'restaurant_self_registration',
            topic: 'Restaurant Self Registration',
            description: 'Choose how admin will get notified about restaurant self registration.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'campaign_join_request',
            topic: 'Campaign Join Request',
            description: 'Choose how admin will get notified about campaign join requests.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'withdraw_request',
            topic: 'Withdraw Request',
            description: 'Choose how admin will get notified about withdraw requests.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_refund_request',
            topic: 'Order Refund Request',
            description: 'Choose how admin will get notified about order refund requests.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'advertisement_add',
            topic: 'Advertisement Add',
            description: 'Choose how admin will get notified about advertisement adds.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'advertisement_update',
            topic: 'Advertisement Update',
            description: 'Choose how admin will get notified about advertisement updates.',
            channels: { push: false, mail: true, sms: false, inApp: true },
            pushAvailable: false,
            mailAvailable: true,
            smsAvailable: true
        }
    ],
    restaurant: [
        {
            key: 'admin_broadcast',
            topic: 'Admin Broadcast',
            description: 'Choose how restaurant will get notified about admin broadcast notifications.',
            channels: { push: true, mail: false, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'new_order_received',
            topic: 'New Order Received',
            description: 'Choose how restaurant will get notified about new orders.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_status_update',
            topic: 'Order Status Update',
            description: 'Choose how restaurant will get notified about order status updates.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'payment_received',
            topic: 'Payment Received',
            description: 'Choose how restaurant will get notified about payments received.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'review_received',
            topic: 'Review Received',
            description: 'Choose how restaurant will get notified about customer reviews.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'withdrawal_request_status',
            topic: 'Withdrawal Request Status',
            description: 'Choose how restaurant will get notified about withdrawal request status.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'campaign_invitation',
            topic: 'Campaign Invitation',
            description: 'Choose how restaurant will get notified about campaign invitations.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_cancelled',
            topic: 'Order Cancelled',
            description: 'Choose how restaurant will get notified about order cancellations.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'food_out_of_stock',
            topic: 'Food Out of Stock',
            description: 'Choose how restaurant will get notified about food items out of stock.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        }
    ],
    customers: [
        {
            key: 'admin_broadcast',
            topic: 'Admin Broadcast',
            description: 'Choose how customer will get notified about admin broadcast notifications.',
            channels: { push: true, mail: false, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_confirmation',
            topic: 'Order Confirmation',
            description: 'Choose how customer will get notified about order confirmation.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_status_update',
            topic: 'Order Status Update',
            description: 'Choose how customer will get notified about order status updates.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_delivered',
            topic: 'Order Delivered',
            description: 'Choose how customer will get notified about order delivery.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_cancelled',
            topic: 'Order Cancelled',
            description: 'Choose how customer will get notified about order cancellation.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'payment_confirmation',
            topic: 'Payment Confirmation',
            description: 'Choose how customer will get notified about payment confirmation.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'promotional_offers',
            topic: 'Promotional Offers',
            description: 'Choose how customer will get notified about promotional offers.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'refund_processed',
            topic: 'Refund Processed',
            description: 'Choose how customer will get notified about refund processing.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'wallet_transaction',
            topic: 'Wallet Transaction',
            description: 'Choose how customer will get notified about wallet transactions.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        }
    ],
    deliveryman: [
        {
            key: 'admin_broadcast',
            topic: 'Admin Broadcast',
            description: 'Choose how deliveryman will get notified about admin broadcast notifications.',
            channels: { push: true, mail: false, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'new_order_assignment',
            topic: 'New Order Assignment',
            description: 'Choose how deliveryman will get notified about new order assignment.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_pickup_request',
            topic: 'Order Pickup Request',
            description: 'Choose how deliveryman will get notified about order pickup requests.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'order_delivery_status',
            topic: 'Order Delivery Status',
            description: 'Choose how deliveryman will get notified about order delivery status.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'payment_received',
            topic: 'Payment Received',
            description: 'Choose how deliveryman will get notified about payment received.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'bonus_notification',
            topic: 'Bonus Notification',
            description: 'Choose how deliveryman will get notified about bonus notifications.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'incentive_update',
            topic: 'Incentive Update',
            description: 'Choose how deliveryman will get notified about incentive updates.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'shift_reminder',
            topic: 'Shift Reminder',
            description: 'Choose how deliveryman will get notified about shift reminders.',
            channels: { push: true, mail: true, sms: true, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        },
        {
            key: 'withdrawal_status',
            topic: 'Withdrawal Status',
            description: 'Choose how deliveryman will get notified about withdrawal status.',
            channels: { push: true, mail: true, sms: false, inApp: true },
            pushAvailable: true,
            mailAvailable: true,
            smsAvailable: true
        }
    ]
};

const OWNER_TYPE_TO_ROLE = {
    USER: 'customers',
    RESTAURANT: 'restaurant',
    DELIVERY_PARTNER: 'deliveryman',
    SELLER: 'customers'
};

const normalizeRole = (role) => {
    const next = String(role || '').trim().toLowerCase();
    if (!VALID_ROLES.has(next)) {
        throw new ValidationError('role is invalid');
    }
    return next;
};

const cloneDefaultTopics = (role) =>
    (DEFAULT_TOPICS[role] || []).map((item) => ({
        ...item,
        channels: { ...item.channels }
    }));

const ensureRoleSettings = async (role) => {
    const normalizedRole = normalizeRole(role);
    let doc = await NotificationChannelSettings.findOne({ role: normalizedRole });
    if (!doc) {
        doc = await NotificationChannelSettings.create({
            role: normalizedRole,
            topics: cloneDefaultTopics(normalizedRole)
        });
        return doc;
    }

    // Backfill newly introduced default topics (e.g. admin_broadcast) without wiping saved flags.
    // Only used by Notification Channel Settings APIs — never by broadcast send.
    const existingKeys = new Set((doc.topics || []).map((item) => item.key));
    const missing = cloneDefaultTopics(normalizedRole).filter((item) => !existingKeys.has(item.key));
    if (missing.length > 0) {
        doc.topics = [...(doc.topics || []), ...missing];
        await doc.save();
    }
    return doc;
};

/**
 * Startup-only: create missing role docs. Never updates existing docs (no topic backfill, no updatedAt).
 * Idempotent under concurrent boots (duplicate key → skip).
 */
export const seedMissingNotificationChannelRoles = async () => {
    let created = 0;
    for (const role of VALID_ROLES) {
        const exists = await NotificationChannelSettings.exists({ role });
        if (exists) continue;
        try {
            await NotificationChannelSettings.create({
                role,
                topics: cloneDefaultTopics(role)
            });
            created += 1;
        } catch (err) {
            if (err?.code === 11000) continue;
            throw err;
        }
    }
    return created;
};

const serializeRoleDoc = (doc) => ({
    role: doc.role,
    topics: (doc.topics || []).map((item, index) => ({
        id: item.key || index + 1,
        key: item.key,
        topic: item.topic,
        description: item.description || '',
        push: item.pushAvailable === false ? 'N/A' : Boolean(item.channels?.push),
        mail: item.mailAvailable === false ? 'N/A' : Boolean(item.channels?.mail),
        sms: item.smsAvailable === false ? 'N/A' : Boolean(item.channels?.sms),
        inApp: Boolean(item.channels?.inApp !== false),
        pushAvailable: item.pushAvailable !== false,
        mailAvailable: item.mailAvailable !== false,
        smsAvailable: item.smsAvailable !== false,
        channels: {
            push: Boolean(item.channels?.push),
            mail: Boolean(item.channels?.mail),
            sms: Boolean(item.channels?.sms),
            inApp: item.channels?.inApp !== false
        }
    })),
    updatedAt: doc.updatedAt
});

export const getNotificationChannels = async ({ role } = {}) => {
    if (role) {
        const doc = await ensureRoleSettings(role);
        return serializeRoleDoc(doc);
    }

    const roles = [...VALID_ROLES];
    const docs = await Promise.all(roles.map((item) => ensureRoleSettings(item)));
    return {
        roles: docs.map(serializeRoleDoc)
    };
};

export const updateNotificationChannelTopic = async ({
    role,
    topicKey,
    channels = {}
} = {}) => {
    const normalizedRole = normalizeRole(role);
    const key = String(topicKey || '').trim();
    if (!key) {
        throw new ValidationError('topicKey is required');
    }

    const doc = await ensureRoleSettings(normalizedRole);
    const topic = (doc.topics || []).find((item) => item.key === key);
    if (!topic) {
        throw new NotFoundError('Notification topic not found');
    }

    for (const channel of CHANNEL_KEYS) {
        if (channels[channel] === undefined) continue;
        if (channel === 'push' && topic.pushAvailable === false) continue;
        if (channel === 'mail' && topic.mailAvailable === false) continue;
        if (channel === 'sms' && topic.smsAvailable === false) continue;
        topic.channels[channel] = Boolean(channels[channel]);
    }

    doc.markModified('topics');
    await doc.save();
    return serializeRoleDoc(doc);
};

export const updateNotificationChannelsBulk = async ({ role, topics = [] } = {}) => {
    const normalizedRole = normalizeRole(role);
    if (!Array.isArray(topics) || topics.length === 0) {
        throw new ValidationError('topics are required');
    }

    const doc = await ensureRoleSettings(normalizedRole);
    const byKey = new Map((doc.topics || []).map((item) => [item.key, item]));

    for (const incoming of topics) {
        const key = String(incoming?.key || incoming?.id || '').trim();
        const topic = byKey.get(key);
        if (!topic) continue;
        const nextChannels = incoming?.channels || {
            push: incoming?.push,
            mail: incoming?.mail,
            sms: incoming?.sms,
            inApp: incoming?.inApp
        };
        for (const channel of CHANNEL_KEYS) {
            if (nextChannels[channel] === undefined || nextChannels[channel] === 'N/A') continue;
            if (channel === 'push' && topic.pushAvailable === false) continue;
            if (channel === 'mail' && topic.mailAvailable === false) continue;
            if (channel === 'sms' && topic.smsAvailable === false) continue;
            topic.channels[channel] = Boolean(nextChannels[channel]);
        }
    }

    doc.markModified('topics');
    await doc.save();
    return serializeRoleDoc(doc);
};

/**
 * Read-only check whether a delivery channel is enabled for a role/topic.
 * Defaults to enabled when config is missing so existing flows keep working.
 * NEVER writes to the database!
 */
export const isNotificationChannelEnabledReadOnly = async ({
    role,
    ownerType,
    topicKey = 'admin_broadcast',
    channel = 'push'
} = {}) => {
    const normalizedChannel = String(channel || '').trim();
    if (!CHANNEL_KEYS.includes(normalizedChannel)) return true;

    const resolvedRole =
        role ||
        OWNER_TYPE_TO_ROLE[String(ownerType || '').trim().toUpperCase()] ||
        null;
    if (!resolvedRole || !VALID_ROLES.has(resolvedRole)) return true;

    // Read-only: just findOne without creating or updating!
    const doc = await NotificationChannelSettings.findOne({ role: resolvedRole }).lean();
    if (!doc) {
        // If no doc exists, use default topics in-memory, no DB write!
        const defaultTopics = DEFAULT_TOPICS[resolvedRole] || [];
        const topic = defaultTopics.find((item) => item.key === String(topicKey || '').trim());
        if (!topic) return true;
        
        if (normalizedChannel === 'push' && topic.pushAvailable === false) return false;
        if (normalizedChannel === 'mail' && topic.mailAvailable === false) return false;
        if (normalizedChannel === 'sms' && topic.smsAvailable === false) return false;

        return Boolean(topic.channels?.[normalizedChannel]);
    }

    const topic = (doc.topics || []).find((item) => item.key === String(topicKey || '').trim());
    if (!topic) return true;

    if (normalizedChannel === 'push' && topic.pushAvailable === false) return false;
    if (normalizedChannel === 'mail' && topic.mailAvailable === false) return false;
    if (normalizedChannel === 'sms' && topic.smsAvailable === false) return false;

    return Boolean(topic.channels?.[normalizedChannel]);
};

export const filterTargetsByChannel = async ({
    targets = [],
    topicKey = 'admin_broadcast',
    channel = 'push'
} = {}) => {
    const rows = Array.isArray(targets) ? targets : [];
    if (!rows.length) return [];

    const enabledByOwnerType = new Map();
    const filtered = [];

    for (const target of rows) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        if (!enabledByOwnerType.has(ownerType)) {
            enabledByOwnerType.set(
                ownerType,
                await isNotificationChannelEnabledReadOnly({
                    ownerType,
                    topicKey,
                    channel
                })
            );
        }
        if (enabledByOwnerType.get(ownerType)) {
            filtered.push(target);
        }
    }

    return filtered;
};

/**
 * Preload inApp/push flags for owner types (one DB read per role).
 * Used by streaming broadcast so each batch can partition without re-querying.
 */
export const getTopicChannelFlagsByOwnerTypes = async ({
    ownerTypes = ['USER', 'RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'],
    topicKey = 'admin_broadcast'
} = {}) => {
    const flagsByOwnerType = new Map();
    const topic = String(topicKey || '').trim();
    const types = Array.isArray(ownerTypes) ? ownerTypes : [];

    for (const raw of types) {
        const ownerType = String(raw || '').trim().toUpperCase();
        if (!ownerType || flagsByOwnerType.has(ownerType)) continue;

        const resolvedRole = OWNER_TYPE_TO_ROLE[ownerType] || null;
        let inApp = true;
        let push = true;

        if (resolvedRole && VALID_ROLES.has(resolvedRole)) {
            const doc = await NotificationChannelSettings.findOne({ role: resolvedRole }).lean();
            const topicRow = doc
                ? (doc.topics || []).find((item) => item.key === topic)
                : (DEFAULT_TOPICS[resolvedRole] || []).find((item) => item.key === topic);

            if (topicRow) {
                inApp = topicRow.channels?.inApp !== false;
                push =
                    topicRow.pushAvailable === false
                        ? false
                        : Boolean(topicRow.channels?.push);
            }
        }

        flagsByOwnerType.set(ownerType, { inApp, push });
    }

    return flagsByOwnerType;
};

/**
 * One pass over targets: resolve each ownerType's channel doc once, then split inApp vs push.
 * Read-only — never writes food_notification_channels.
 */
export const partitionTargetsByChannels = async ({
    targets = [],
    topicKey = 'admin_broadcast'
} = {}) => {
    const rows = Array.isArray(targets) ? targets : [];
    if (!rows.length) {
        return { inAppTargets: [], pushTargets: [] };
    }

    const flagsByOwnerType = await getTopicChannelFlagsByOwnerTypes({
        ownerTypes: [
            ...new Set(
                rows
                    .map((t) => String(t?.ownerType || '').trim().toUpperCase())
                    .filter(Boolean)
            )
        ],
        topicKey
    });

    const inAppTargets = [];
    const pushTargets = [];

    for (const target of rows) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        const flags = flagsByOwnerType.get(ownerType) || { inApp: true, push: true };
        if (flags.inApp) inAppTargets.push(target);
        if (flags.push) pushTargets.push(target);
    }

    return { inAppTargets, pushTargets };
};

import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { FoodUser } from '../users/user.model.js';
import { FoodRestaurant } from '../../modules/food/restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Seller } from '../../modules/quick-commerce/seller/models/seller.model.js';
import { FoodAdmin } from '../admin/admin.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const FIREBASE_MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SEND_URL = (projectId) =>
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
const OWNER_MODELS = {
    USER: FoodUser,
    RESTAURANT: FoodRestaurant,
    SELLER: Seller,
    DELIVERY_PARTNER: FoodDeliveryPartner,
    ADMIN: FoodAdmin
};
const OWNER_TOKEN_FIELDS = {
    web: 'fcmTokens',
    mobile: 'fcmTokenMobile'
};
const OWNER_APP_PREFIXES = {
    USER: '👤 [User]',
    RESTAURANT: '🏪 [Shop]',
    SELLER: '🏬 [Seller]',
    DELIVERY_PARTNER: '🛵 [Rider]',
    ADMIN: '🛡️ [Admin]'
};

let cachedAccessToken = null;
let cachedAccessTokenExpiryMs = 0;
let cachedServiceAccount = null;

const sanitizeString = (value) => String(value ?? '').trim();

const toBase64Url = (input) =>
    Buffer.from(JSON.stringify(input))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const normalizePrivateKey = (key) => String(key || '').replace(/\\n/g, '\n').trim();

const getServiceAccountFromEnv = () => {
    if (cachedServiceAccount) return cachedServiceAccount;

    const rawJson = sanitizeString(config.firebaseServiceAccount || process.env.FIREBASE_SERVICE_ACCOUNT);
    if (rawJson) {
        cachedServiceAccount = JSON.parse(rawJson);
        return cachedServiceAccount;
    }

    const pathValue = sanitizeString(config.firebaseServiceAccountPath || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (pathValue) {
        const filePath = resolve(process.cwd(), pathValue);
        if (existsSync(filePath)) {
            cachedServiceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
            return cachedServiceAccount;
        }
    }

    throw new Error('Firebase service account is not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH.');
};

const getFirebaseProjectId = () => {
    const account = getServiceAccountFromEnv();
    const projectId =
        sanitizeString(config.firebaseProjectId) ||
        sanitizeString(account.project_id) ||
        sanitizeString(process.env.FIREBASE_PROJECT_ID);
    if (!projectId) {
        throw new Error('Firebase project ID is not configured.');
    }
    return projectId;
};

const getFirebaseAccessToken = async () => {
    const now = Date.now();
    if (cachedAccessToken && cachedAccessTokenExpiryMs - now > 60_000) {
        return cachedAccessToken;
    }

    const account = getServiceAccountFromEnv();
    const privateKey = normalizePrivateKey(account.private_key);
    if (!account.client_email || !privateKey) {
        throw new Error('Firebase service account is missing client_email or private_key.');
    }

    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: account.client_email,
        scope: FIREBASE_MESSAGING_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat,
        exp
    };

    const jwtUnsigned = `${toBase64Url(header)}.${toBase64Url(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(jwtUnsigned);
    signer.end();
    const signature = signer.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const assertion = `${jwtUnsigned}.${signature}`;

    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Firebase OAuth token exchange failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    cachedAccessToken = json.access_token;
    cachedAccessTokenExpiryMs = now + ((Number(json.expires_in) || 3600) * 1000);
    return cachedAccessToken;
};

const normalizeDataMap = (data = {}) => {
    const result = {};
    for (const [key, value] of Object.entries(data || {})) {
        if (value === undefined || value === null) continue;
        result[String(key)] = String(value);
    }
    return result;
};

const buildMessagePayload = (payload = {}, token) => {
    const notification = {
        title: sanitizeString(payload.title || payload.notification?.title || 'New notification'),
        body: sanitizeString(payload.body || payload.notification?.body || '')
    };
    const rawData = { ...(payload.data || {}) };
    const audience = sanitizeString(rawData.audience).toLowerCase();
    // Restaurant/delivery/seller alerts must NOT use FCM auto-display on web.
    // Chrome shows webpush/top-level notification globally (visible while User tab is focused).
    // SW + page code filter by audience and show only on the matching role tab.
    const isActorScopedWebAlert = ['restaurant', 'delivery', 'seller'].includes(audience);
    const omitWebAutoDisplay = Boolean(payload.dataOnly) || isActorScopedWebAlert;

    // Ensure SW/page can render title/body from data when notification block is omitted for web.
    if (omitWebAutoDisplay) {
        if (!rawData.title) rawData.title = notification.title;
        if (!rawData.body) rawData.body = notification.body;
    }

    const data = normalizeDataMap(rawData);
    const image =
        sanitizeString(payload.icon || payload.notification?.image || payload.notification?.icon || data.image || data.imageUrl);

    const message = { token };

    // Top-level notification triggers Chrome OS auto-display. Skip for actor-scoped web alerts.
    if (!omitWebAutoDisplay) {
        message.notification = notification;
        if (image) {
            message.notification.image = image;
        }
    }

    if (Object.keys(data).length > 0) {
        message.data = data;
    }

    message.android = {
        priority: 'high',
        notification: {
            title: notification.title,
            body: notification.body,
            channel_id: 'default',
            sound: 'default',
            default_vibrate_timings: true,
            default_light_settings: true,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            actions: []
        }
    };
    if (image) {
        message.android.notification.image = image;
    }

    message.webpush = {
        headers: {
            Urgency: 'high'
        },
        fcmOptions: {
            link: sanitizeString(data.link || data.targetUrl || '/')
        }
    };
    // Never attach webpush.notification for actor-scoped alerts — SW owns display + audience filter.
    if (!omitWebAutoDisplay) {
        message.webpush.notification = {
            title: notification.title,
            body: notification.body,
            icon: image || payload.icon || '/favicon.ico'
        };
    }

    return message;
};

const parseFirebaseError = async (response) => {
    try {
        return await response.json();
    } catch {
        try {
            const text = await response.text();
            return { error: { message: text } };
        } catch {
            return { error: { message: 'Unknown Firebase error' } };
        }
    }
};

const shouldRemoveTokenFromError = (errorJson, response) => {
    const status = response?.status;
    const message = String(errorJson?.error?.message || '').toUpperCase();
    return status === 404 || message.includes('UNREGISTERED') || message.includes('INVALID_ARGUMENT');
};

const getOwnerModel = (ownerType) => OWNER_MODELS[String(ownerType || '').toUpperCase()] || null;

const getTokenFieldForPlatform = (platform) => OWNER_TOKEN_FIELDS[platform === 'mobile' ? 'mobile' : 'web'];

const normalizeTokenList = (tokens = []) => {
    const normalized = [...new Set((Array.isArray(tokens) ? tokens : [tokens]).map(sanitizeString).filter(Boolean))];
    return normalized.slice(-10);
};

/**
 * FCM tokens are typically "<installationId>:<credential>".
 * Same installation can rotate the credential; treat that as one device.
 */
export const getFcmTokenInstanceId = (token) => {
    const normalized = sanitizeString(token);
    if (!normalized) return '';
    const colonIndex = normalized.indexOf(':');
    if (colonIndex > 0) return normalized.slice(0, colonIndex);
    return normalized;
};

/**
 * Merge a device token into an existing list:
 * - exact match → no change (unless collapsing same-device siblings)
 * - same installation id → replace old token (token refresh)
 * - otherwise → append (multi-device)
 * Caps at 10 unique tokens. Also collapses any existing same-installation dupes.
 */
export const mergeDeviceToken = (existingTokens = [], newToken) => {
    const normalizedToken = sanitizeString(newToken);
    const previous = (Array.isArray(existingTokens) ? existingTokens : [])
        .map(sanitizeString)
        .filter(Boolean);
    const prevNormalized = normalizeTokenList(previous);

    const byInstance = new Map();
    for (const token of previous) {
        byInstance.set(getFcmTokenInstanceId(token), token);
    }

    if (normalizedToken) {
        byInstance.set(getFcmTokenInstanceId(normalizedToken), normalizedToken);
    }

    const tokens = normalizeTokenList([...byInstance.values()]);
    const changed =
        tokens.length !== prevNormalized.length ||
        tokens.some((token) => !prevNormalized.includes(token)) ||
        prevNormalized.some((token) => !tokens.includes(token));

    return { tokens, changed };
};

const readTokensFromDoc = (doc, platform) => {
    if (!doc) return [];
    if (platform) {
        return normalizeTokenList(doc[getTokenFieldForPlatform(platform)] || []);
    }
    return normalizeTokenList([
        ...(Array.isArray(doc.fcmTokens) ? doc.fcmTokens : []),
        ...(Array.isArray(doc.fcmTokenMobile) ? doc.fcmTokenMobile : [])
    ]);
};

export const listOwnerTokens = async ({ ownerType, ownerId, platform }) => {
    if (!ownerType || !ownerId) return [];
    const model = getOwnerModel(ownerType);
    if (!model) return [];
    const doc = await model.findById(ownerId).select('fcmTokens fcmTokenMobile').lean();
    return readTokensFromDoc(doc, platform);
};

export const upsertFirebaseDeviceToken = async ({ ownerType, ownerId, token, platform = 'web' }) => {
    const normalizedToken = sanitizeString(token);

    if (!ownerType || !ownerId || !normalizedToken) {
        throw new Error('ownerType, ownerId, and token are required.');
    }

    const normalizedPlatform = platform === 'mobile' ? 'mobile' : 'web';
    const model = getOwnerModel(ownerType);
    if (!model) {
        throw new Error(`Unsupported owner type: ${ownerType}`);
    }

    const doc = await model.findById(ownerId);
    if (!doc) {
        throw new Error('Owner profile not found.');
    }

    const field = getTokenFieldForPlatform(normalizedPlatform);
    const existingTokens = Array.isArray(doc[field]) ? doc[field] : [];

    const { tokens, changed } = mergeDeviceToken(existingTokens, normalizedToken);
    if (!changed) {
        return { success: true, unchanged: true };
    }

    doc[field] = tokens;
    await doc.save();
    return { success: true, unchanged: false };
};

export const removeFirebaseDeviceToken = async ({ ownerType, ownerId, token, platform }) => {
    const normalizedToken = sanitizeString(token);
    if (!ownerType || !ownerId || !normalizedToken) {
        throw new Error('ownerType, ownerId, and token are required.');
    }
    const model = getOwnerModel(ownerType);
    if (!model) {
        throw new Error(`Unsupported owner type: ${ownerType}`);
    }
    const doc = await model.findById(ownerId);
    if (!doc) {
        return { success: false };
    }

    if (platform) {
        const field = getTokenFieldForPlatform(platform);
        doc[field] = normalizeTokenList((Array.isArray(doc[field]) ? doc[field] : []).filter((t) => t !== normalizedToken));
    } else {
        doc.fcmTokens = normalizeTokenList((Array.isArray(doc.fcmTokens) ? doc.fcmTokens : []).filter((t) => t !== normalizedToken));
        doc.fcmTokenMobile = normalizeTokenList(
            (Array.isArray(doc.fcmTokenMobile) ? doc.fcmTokenMobile : []).filter((t) => t !== normalizedToken)
        );
    }

    await doc.save();
    return { success: true };
};

export const sendPushNotification = async (tokens, payload = {}) => {
    const projectId = getFirebaseProjectId();
    const accessToken = await getFirebaseAccessToken();
    const uniqueTokens = normalizeTokenList(tokens);

    if (uniqueTokens.length === 0) {
        return { successCount: 0, failureCount: 0, results: [] };
    }

    const results = await Promise.all(
        uniqueTokens.map(async (token) => {
            const message = buildMessagePayload(payload, token);

            try {
                const response = await fetch(FCM_SEND_URL(projectId), {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message })
                });

                if (!response.ok) {
                    const errorJson = await parseFirebaseError(response);

                    return {
                        token,
                        ok: false,
                        remove: shouldRemoveTokenFromError(errorJson, response),
                        error: errorJson?.error?.message || `FCM send failed (${response.status})`
                    };
                }

                const firebaseResponse = await response.json();

                return {
                    token,
                    ok: true,
                    response: firebaseResponse
                };
            } catch (error) {

                return {
                    token,
                    ok: false,
                    remove: false,
                    error: error?.message || String(error)
                };
            }
        })
    );

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;
    return { successCount, failureCount, results };
};

export const sendNotificationToOwner = async ({ ownerType, ownerId, payload, platform } = {}) => {
    // 💡 Clone the payload to avoid side-effects (e.g. adding multiple prefixes to the same object during broadcasting)
    const enrichedPayload = { ...payload };

    // 🏷️ Add Highlighter Prefix to the Title
    if (enrichedPayload && !enrichedPayload.skipHighlighter) {
        const typeKey = String(ownerType || '').toUpperCase();
        const prefix = OWNER_APP_PREFIXES[typeKey] || '';
        
        if (prefix) {
            // Get original title from any potential field
            let originalTitle = enrichedPayload.title || enrichedPayload.notification?.title || 'New notification';
            
            // Safety: Ensure we don't ADD the prefix if it's already there (defensive check)
            if (!originalTitle.includes(prefix)) {
                enrichedPayload.title = `${prefix} ${originalTitle}`.trim();
            } else {
                enrichedPayload.title = originalTitle;
            }
        }
    }

    const tokens = await listOwnerTokens({ ownerType, ownerId, platform });

    if (!tokens.length) {
        return {
            successCount: 0,
            failureCount: 0,
            results: [],
            tokenCount: 0,
            skipped: true,
            reason: 'NO_TOKENS'
        };
    }
    try {
        console.log(`[FCM] Sending to ${ownerType}:${ownerId}. Title: "${enrichedPayload.title || 'Data Only'}"`);
        const response = await sendPushNotification(tokens, enrichedPayload);
        const invalidTokens = (response.results || [])

            .filter((item) => !item.ok && item.remove)
            .map((item) => item.token)
            .filter(Boolean);
        if (invalidTokens.length > 0) {
            const model = getOwnerModel(ownerType);
            const doc = model ? await model.findById(ownerId) : null;
            if (doc) {
                const fieldNames = platform
                    ? [getTokenFieldForPlatform(platform)]
                    : [OWNER_TOKEN_FIELDS.web, OWNER_TOKEN_FIELDS.mobile];
                for (const field of fieldNames) {
                    doc[field] = normalizeTokenList((Array.isArray(doc[field]) ? doc[field] : []).filter((t) => !invalidTokens.includes(t)));
                }
                await doc.save();
            }
        }
        logger.info(
            `FCM push sent to ${ownerType}:${ownerId} (${platform || 'all'}). Success=${response.successCount}, Failure=${response.failureCount}`
        );
        return {
            ...response,
            tokenCount: tokens.length,
            skipped: false
        };
    } catch (error) {
        logger.warn(`FCM push failed for ${ownerType}:${ownerId}: ${error.message}`);
        return {
            successCount: 0,
            failureCount: tokens.length,
            tokenCount: tokens.length,
            skipped: false,
            error: error.message
        };
    }
};

export const sendNotificationToOwners = async (targets = [], payload = {}) => {
    // 🔍 Tip #6: Deduplicate targets by ownerType:ownerId before sending
    // This prevents duplicate notifications if the same person is listed twice (e.g. as USER and partner)
    const uniqueTargets = Array.isArray(targets) 
        ? [...new Map(targets.filter(t => t?.ownerType && t?.ownerId).map(t => [`${t.ownerType}:${t.ownerId}`, t])).values()]
        : [];

    const results = [];
    for (const target of uniqueTargets) {
        results.push(
            await sendNotificationToOwner({
                ownerType: target.ownerType,
                ownerId: target.ownerId,
                platform: target.platform,
                payload
            })
        );
    }
    return results;
};

export const notifyOwnersWithReport = async (targets = [], payload = {}, options = {}) => {
    const collectRecipients = options.collectRecipients === true;
    const uniqueTargets = Array.isArray(targets)
        ? [...new Map(targets.filter((t) => t?.ownerType && t?.ownerId).map((t) => [`${t.ownerType}:${t.ownerId}`, t])).values()]
        : [];

    // Parallelize owners in bounded chunks — same per-recipient semantics as sequential loop.
    const PUSH_OWNER_CONCURRENCY = 20;
    const perRecipient = [];
    const summary = {
        attemptedRecipients: 0,
        recipientsWithSuccess: 0,
        recipientsWithoutTokens: 0,
        recipientsWithFailures: 0,
        totalTokenAttempts: 0,
        totalTokenSuccess: 0,
        totalTokenFailures: 0
    };

    for (let i = 0; i < uniqueTargets.length; i += PUSH_OWNER_CONCURRENCY) {
        const chunk = uniqueTargets.slice(i, i + PUSH_OWNER_CONCURRENCY);
        const chunkResults = await Promise.all(
            chunk.map(async (target) => {
                const result = await sendNotificationToOwner({
                    ownerType: target.ownerType,
                    ownerId: target.ownerId,
                    platform: target.platform,
                    payload
                });
                return {
                    ownerType: target.ownerType,
                    ownerId: String(target.ownerId),
                    tokenCount: Number(result?.tokenCount || 0),
                    successCount: Number(result?.successCount || 0),
                    failureCount: Number(result?.failureCount || 0),
                    skipped: Boolean(result?.skipped),
                    reason: result?.reason || null,
                    error: result?.error || null
                };
            })
        );

        for (const row of chunkResults) {
            summary.attemptedRecipients += 1;
            if (row.successCount > 0) summary.recipientsWithSuccess += 1;
            if (row.skipped && row.reason === 'NO_TOKENS') summary.recipientsWithoutTokens += 1;
            if (row.failureCount > 0) summary.recipientsWithFailures += 1;
            summary.totalTokenAttempts += row.tokenCount;
            summary.totalTokenSuccess += row.successCount;
            summary.totalTokenFailures += row.failureCount;
        }

        // Only retain per-recipient rows when explicitly requested (debug/dev).
        if (collectRecipients) {
            perRecipient.push(...chunkResults);
        }
    }

    return {
        summary,
        recipients: collectRecipients ? perRecipient : []
    };
};

export const notifyAdminsSafely = async (payload = {}) => {
    try {
        const normalizedPayload = {
            ...payload,
            body: String(payload.body || payload.message || '').trim(),
        };

        const admins = await FoodAdmin.find({ isActive: true }).select('_id').lean();
        if (!admins.length) return [];

        const targets = admins.map(a => ({
            ownerType: 'ADMIN',
            ownerId: String(a._id)
        }));

        const results = await sendNotificationToOwners(targets, normalizedPayload);

        try {
            const { emitAdminBellRefresh } = await import('./ownerInboxNotify.js');
            await emitAdminBellRefresh();
        } catch {
            // Non-blocking
        }

        return results;
    } catch (e) {
        logger.error(`Error notifying admins: ${e.message}`);
        return [];
    }
};

export const sendTestNotification = async ({ ownerType, ownerId, platform }) => {
    return sendNotificationToOwner({
        ownerType,
        ownerId,
        platform,
        payload: {
            title: 'Test Notification',
            body: 'This is a test notification from Firebase push',
            data: {
                type: 'test',
                link: '/'
            }
        }
    });
};
export const notifyOwnerSafely = async (target = {}, payload = {}) => {
    try {
        return await sendNotificationToOwner({ ...target, payload });
    } catch (error) {
        logger.warn(`FCM individual push failed: ${error.message}`);
        return null;
    }
};

export const notifyOwnersSafely = async (targets = [], payload = {}) => {
    try {
        return await sendNotificationToOwners(targets, payload);
    } catch (error) {
        logger.warn(`FCM broadcast push failed: ${error.message}`);
        return [];
    }
};

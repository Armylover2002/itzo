import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { FoodUser } from '../users/user.model.js';
import { FoodRestaurant } from '../../modules/food/restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodAdmin } from '../admin/admin.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const FIREBASE_MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SEND_URL = (projectId) =>
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
import { Seller } from '../../modules/quick-commerce/seller/models/seller.model.js';

const OWNER_MODELS = {
    USER: FoodUser,
    RESTAURANT: FoodRestaurant,
    DELIVERY_PARTNER: FoodDeliveryPartner,
    ADMIN: FoodAdmin,
    HRMS_EMPLOYEE: FoodAdmin,  // HRMS employees are FoodAdmin records (HrmsEmployee.adminId → FoodAdmin._id)
    EMPLOYEE: FoodAdmin,       // ECS sub-admin employees are also FoodAdmin records
    SUPER_ADMIN: FoodAdmin,    // Super admins use the same FoodAdmin model
    SELLER: Seller
};
const OWNER_TOKEN_FIELDS = {
    web: 'fcmTokens',
    mobile: 'fcmTokenMobile'
};
const OWNER_APP_PREFIXES = {
    USER: '👤 [User]',
    RESTAURANT: '🏪 [Shop]',
    DELIVERY_PARTNER: '🛵 [Rider]',
    ADMIN: '🛡️ [Admin]',
    HRMS_EMPLOYEE: '👷 [HRMS]',
    EMPLOYEE: '🛡️ [Staff]',
    SUPER_ADMIN: '🛡️ [Admin]'
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
    const data = normalizeDataMap(payload.data || {});
    const image =
        sanitizeString(payload.icon || payload.notification?.image || payload.notification?.icon || data.image || data.imageUrl);

    // If payload.dataOnly is true, we omit the 'notification' block.
    // This prevents FCM from auto-displaying while allowing app code to show a 'Local Notification'.
    const message = { token };

    if (!payload.dataOnly) {
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
            channel_id: 'default',
            sound: 'default',
            default_vibrate_timings: true,
            default_light_settings: true,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            actions: [] 
        }
    };

    message.webpush = {
        headers: {
            Urgency: 'high'
        },
        notification: {
            title: notification.title,
            body: notification.body,
            icon: image || payload.icon || '/favicon.ico'
        }
    };

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
    console.log(`[FCM-DEBUG] upsertFirebaseDeviceToken: ownerType=${ownerType}, ownerId=${ownerId}, platform=${platform}, tokenPreview=${normalizedToken?.slice(0, 10)}...`);
    
    if (!ownerType || !ownerId || !normalizedToken) {
        console.error('[FCM-DEBUG] upsert - Missing required fields');
        throw new Error('ownerType, ownerId, and token are required.');
    }

    const normalizedPlatform = platform === 'mobile' ? 'mobile' : 'web';
    const model = getOwnerModel(ownerType);
    if (!model) {
        console.error(`[FCM-DEBUG] upsert - Unsupported owner type: ${ownerType}`);
        throw new Error(`Unsupported owner type: ${ownerType}`);
    }

    const doc = await model.findById(ownerId);
    if (!doc) {
        console.error(`[FCM-DEBUG] upsert - Owner profile not found for id ${ownerId}`);
        throw new Error('Owner profile not found.');
    }

    const field = getTokenFieldForPlatform(normalizedPlatform);
    const existingTokens = Array.isArray(doc[field]) ? doc[field] : [];
    console.log(`[FCM-DEBUG] upsert - Current tokens in DB count: ${existingTokens.length}`);
    
    const tokens = normalizeTokenList([...existingTokens, normalizedToken]);
    doc[field] = tokens;
    
    await doc.save();
    console.log(`[FCM-DEBUG] upsert - Token list updated. New count: ${tokens.length}`);
    return { success: true };
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

                return {
                    token,
                    ok: true,
                    response: await response.json()
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
        return { successCount: 0, failureCount: 0, results: [] };
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
        return response;
    } catch (error) {
        logger.warn(`FCM push failed for ${ownerType}:${ownerId}: ${error.message}`);
        return { successCount: 0, failureCount: tokens.length, error: error.message };
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

export const notifyAdminsSafely = async (payload = {}) => {
    try {
        const admins = await FoodAdmin.find({ isActive: true }).select('_id').lean();
        if (!admins.length) return [];
        
        const targets = admins.map(a => ({
            ownerType: 'ADMIN',
            ownerId: String(a._id)
        }));
        
        return await sendNotificationToOwners(targets, payload);
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

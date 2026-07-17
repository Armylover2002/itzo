/**
 * Firebase Realtime Database REST writer.
 *
 * Uses the same service-account OAuth2 approach as firebase.service.js (no firebase-admin SDK).
 * Scope: https://www.googleapis.com/auth/firebase.database + userinfo.email
 *
 * IMPORTANT: This module is intentionally narrow.
 * It ONLY writes vendor location data to RTDB.
 * It does NOT affect FCM, auth, or any other Firebase feature.
 */
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const FIREBASE_RTDB_SCOPE =
    'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let rtdbCachedToken = null;
let rtdbCachedTokenExpiryMs = 0;
let rtdbCachedServiceAccount = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

const toBase64Url = (input) =>
    Buffer.from(JSON.stringify(input))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const normalizePrivateKey = (key) => String(key || '').replace(/\\n/g, '\n').trim();

const getRtdbServiceAccount = () => {
    if (rtdbCachedServiceAccount) return rtdbCachedServiceAccount;

    const rawJson = String(config.firebaseServiceAccount || process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (rawJson) {
        rtdbCachedServiceAccount = JSON.parse(rawJson);
        return rtdbCachedServiceAccount;
    }

    const pathValue = String(config.firebaseServiceAccountPath || process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
    if (pathValue) {
        const filePath = resolve(process.cwd(), pathValue);
        if (existsSync(filePath)) {
            rtdbCachedServiceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
            return rtdbCachedServiceAccount;
        }
    }

    throw new Error('[firebaseRtdb] Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT env var.');
};

const getRtdbAccessToken = async () => {
    const now = Date.now();
    if (rtdbCachedToken && rtdbCachedTokenExpiryMs - now > 60_000) {
        return rtdbCachedToken;
    }

    const account = getRtdbServiceAccount();
    const privateKey = normalizePrivateKey(account.private_key);
    if (!account.client_email || !privateKey) {
        throw new Error('[firebaseRtdb] Service account missing client_email or private_key.');
    }

    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: account.client_email,
        scope: FIREBASE_RTDB_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat,
        exp,
    };

    const jwtUnsigned = `${toBase64Url(header)}.${toBase64Url(payload)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(jwtUnsigned);
    signer.end();
    const signature = signer
        .sign(privateKey, 'base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    const assertion = `${jwtUnsigned}.${signature}`;

    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`[firebaseRtdb] OAuth token exchange failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    rtdbCachedToken = json.access_token;
    rtdbCachedTokenExpiryMs = now + (Number(json.expires_in) || 3600) * 1000;
    return rtdbCachedToken;
};

const getDatabaseURL = () => {
    const url = String(
        config.firebaseDatabaseUrl ||
        process.env.FIREBASE_DATABASE_URL ||
        ''
    ).trim().replace(/\/$/, '');
    if (!url) throw new Error('[firebaseRtdb] FIREBASE_DATABASE_URL is not configured.');
    return url;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Write Street Food Vendor live location to Firebase RTDB.
 *
 * Path: restaurant/{restaurantId}/location
 * Payload: { lat, lng, timestamp, isLive, locationSource }
 *
 * This is a fire-and-forget safe write: it never throws to the caller.
 * A failure here should never prevent the MongoDB write from responding.
 *
 * @param {string} restaurantId
 * @param {{ lat: number, lng: number, locationSource?: string }} locationData
 * @returns {Promise<void>}
 */
export const writeVendorLocationToRtdb = async (restaurantId, locationData) => {
    try {
        if (!restaurantId) return;
        const { lat, lng, locationSource = 'gps' } = locationData;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const databaseUrl = getDatabaseURL();
        const token = await getRtdbAccessToken();

        // Sanitize key — Firebase RTDB keys cannot contain . # $ / [ ]
        const safeId = String(restaurantId).replace(/[.#$/[\]]/g, '_');
        const path = `restaurant/${safeId}/location`;
        const url = `${databaseUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;

        const payload = {
            lat,
            lng,
            timestamp: Date.now(),
            isLive: true,
            locationSource,
            last_updated: Date.now(),
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            logger.warn(`[firebaseRtdb] RTDB write failed for ${restaurantId}: ${response.status} ${text}`);
        }
    } catch (err) {
        // Never throw — RTDB failure must never break the HTTP response
        logger.warn(`[firebaseRtdb] Non-critical RTDB write error for ${restaurantId}: ${err.message}`);
    }
};

/**
 * Clear the vendor live location flag from RTDB when tracking stops.
 * Sets isLive=false and preserves last known lat/lng.
 *
 * @param {string} restaurantId
 * @param {{ lat?: number, lng?: number }} lastLocation
 */
export const clearVendorLiveStatusInRtdb = async (restaurantId, lastLocation = {}) => {
    try {
        if (!restaurantId) return;
        const databaseUrl = getDatabaseURL();
        const token = await getRtdbAccessToken();

        const safeId = String(restaurantId).replace(/[.#$/[\]]/g, '_');
        const path = `restaurant/${safeId}/location`;
        const url = `${databaseUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;

        const payload = {
            lat: Number.isFinite(lastLocation.lat) ? lastLocation.lat : null,
            lng: Number.isFinite(lastLocation.lng) ? lastLocation.lng : null,
            timestamp: Date.now(),
            isLive: false,
            locationSource: 'manual',
            last_updated: Date.now(),
        };

        await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        logger.warn(`[firebaseRtdb] Non-critical RTDB clear error for ${restaurantId}: ${err.message}`);
    }
};

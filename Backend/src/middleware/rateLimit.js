import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// NODE_ENV controls how generous each limiter's dev floor is (see `isProduction ?
// x : Math.max(x, devFloor)` below on every limiter). This is deliberate, documented
// dev/prod divergence, not a hidden side effect: in production every limiter uses
// its configured value as-is; in development each one is floored at a much higher
// number so local/manual testing (hot reload firing effects repeatedly, no Redis,
// etc.) doesn't trip 429s that have nothing to do with the limiter logic being
// tested. NODE_ENV is resolved by config/env.js (`process.env.NODE_ENV || 'development'`)
// — whichever value the process actually runs with (e.g. PM2's ecosystem.config.cjs
// forces 'production') decides which side of this applies; nothing here overrides it.
const isProduction = config.nodeEnv === 'production';

/**
 * Collapse the client address to a stable bucket key.
 * IPv6 clients are routinely handed a whole /64, so keying on the full address would
 * let a single client rotate through addresses for a fresh budget each time.
 */
const normalizeIp = (raw) => {
    const ip = String(raw || '').trim();
    if (!ip) return 'unknown';

    const ipv4Mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (ipv4Mapped) return ipv4Mapped[1];

    if (!ip.includes(':')) return ip;
    return `${ip.split(':').slice(0, 4).join(':')}::/64`;
};

const ipKey = (req) => normalizeIp(req.ip || req.socket?.remoteAddress);

/** Key OTP/login limits by the identity being targeted, so one IP cannot spam many
 *  numbers and one number cannot be spammed from many IPs. */
const identityKey = (req) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    if (phone) return `phone:${phone}`;

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email) return `email:${email}`;

    return `ip:${ipKey(req)}`;
};

/**
 * Machine-to-machine and liveness traffic must never be throttled:
 * - payment webhooks retry in bursts from a small set of gateway IPs, and a 429 there
 *   drops a confirmed payment. Signature verification is the control on that path.
 * - CORS preflights would otherwise double the cost of every write request.
 * - uptime probes should not consume a user-facing budget.
 */
const UNMETERED_PATH_PATTERN = /^\/v\d+\/(payments\/webhook|health)(\/|$)/i;

const skipUnmetered = (req) =>
    req.method === 'OPTIONS' || UNMETERED_PATH_PATTERN.test(req.path);

/** Surface throttling in logs so a 429 spike can be told apart from a misconfiguration. */
const buildHandler = (scope, message) => (req, res, _next, options) => {
    logger.warn(
        `[rate-limit] ${scope} exceeded key=${options.keyGenerator ? 'custom' : 'ip'} ` +
        `ip=${ipKey(req)} method=${req.method} path=${req.originalUrl} limit=${options.limit}`
    );
    res.status(options.statusCode).json({ success: false, message });
};

/**
 * Shared counters across instances. Without this each process keeps its own tally, so
 * N instances effectively grant N times the limit and every deploy resets everyone.
 * Optional on purpose: REDIS_ENABLED=false keeps the in-process store with no new
 * hard dependency, which is the current deployment shape.
 */
let createStore = () => undefined;

if (config.redisEnabled && config.redisUrl) {
    try {
        const { default: RedisStore } = await import('rate-limit-redis');
        const { createClient } = await import('redis');

        const client = createClient({ url: config.redisUrl });
        client.on('error', (err) => logger.error(`[rate-limit] Redis store error: ${err.message}`));
        await client.connect();

        createStore = (prefix) => new RedisStore({
            sendCommand: (...args) => client.sendCommand(args),
            prefix: `rl:${prefix}:`,
        });
        logger.info('[rate-limit] Using shared Redis store');
    } catch (err) {
        logger.warn(
            `[rate-limit] Redis store unavailable (${err.message}); ` +
            'falling back to per-instance memory store'
        );
    }
}

const baseOptions = {
    // draft-6 style (separate RateLimit-Limit/Remaining/Reset) — matches what
    // production already emits, so nothing downstream has to change.
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
};

/**
 * TIER 1 — GENERAL / PUBLIC API LIMITER (see authRateLimiter / otpRequestRateLimiter
 * / otpVerifyRateLimiter / mapsRateLimiter below for the sensitive-route tiers).
 * Mounted globally on /api/* (app.js) as the per-IP baseline every request shares —
 * including all public bootstrap reads (settings, categories, banners, restaurants,
 * zones/detect, notifications/inbox, etc). It is intentionally the least restrictive
 * tier: sensitive routes stack one of the limiters below IN ADDITION to this one
 * (see auth.routes.js / seller.routes.js / maps.routes.js) — this limiter never
 * replaces those, it only bounds overall per-IP request volume.
 *
 * Limit comes from RATE_LIMIT_MAX (see config/env.js for the sizing rationale — sized
 * off measured frontend request volume, not an arbitrary round number). It is keyed
 * by IP, and carrier-grade NAT means a single IP can legitimately represent thousands
 * of users, so this stays deliberately generous; per-identity protection belongs on
 * the specific endpoints below, not here.
 */
export const apiRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: config.rateLimitWindowMinutes * 60 * 1000,
    limit: isProduction ? config.rateLimitMaxRequests : Math.max(config.rateLimitMaxRequests, 5000),
    store: createStore('api'),
    keyGenerator: ipKey,
    skip: skipUnmetered,
    handler: buildHandler('api', 'Too many requests, please try again later.'),
    validate: { ip: false },
});

const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000;

/**
 * Per-IP guard on auth endpoints. Kept above single-office usage because per-account
 * lockout (see auth.lockout.js) is what actually stops credential brute force.
 */
export const authRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: authWindowMs,
    limit: isProduction ? config.authRateLimitMax : Math.max(config.authRateLimitMax, 200),
    store: createStore('auth-ip'),
    keyGenerator: ipKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: buildHandler('auth', 'Too many authentication attempts. Please try again later.'),
    validate: { ip: false },
});

/**
 * Caps OTP sends per phone number regardless of source IP. This is the limit that
 * protects SMS spend, since an attacker rotating IPs defeats an IP-keyed limit.
 */
export const otpRequestRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: config.otpRateWindow * 1000,
    limit: isProduction ? config.otpRateLimit : Math.max(config.otpRateLimit, 50),
    store: createStore('otp-request'),
    keyGenerator: identityKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: buildHandler('otp-request', 'Too many OTP requests for this number. Please try again later.'),
    validate: { ip: false },
});

/**
 * Caps failed OTP/password verifications per identity. Successful attempts are not
 * counted, so a user who logs in normally after a typo is never penalised.
 */
export const otpVerifyRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: authWindowMs,
    limit: isProduction ? config.authVerifyRateLimitMax : Math.max(config.authVerifyRateLimitMax, 100),
    store: createStore('otp-verify'),
    keyGenerator: identityKey,
    skipSuccessfulRequests: true,
    skip: (req) => req.method === 'OPTIONS',
    handler: buildHandler('otp-verify', 'Too many failed attempts. Please request a new code.'),
    validate: { ip: false },
});

/** Stricter rate limit for Google Maps proxy endpoints (Distance Matrix). */
export const mapsRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: config.mapsRateLimitWindowMinutes * 60 * 1000,
    limit: isProduction ? config.mapsRateLimitMax : Math.max(config.mapsRateLimitMax, 300),
    store: createStore('maps'),
    keyGenerator: ipKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: buildHandler('maps', 'Too many map distance requests. Please try again later.'),
    validate: { ip: false },
});

/** Street Food Vendor live-location push — keyed per rider/vendor, not IP. */
export const vendorLocationRateLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: config.nodeEnv === 'development' ? 200 : 30,
    store: createStore('vendor-location'),
    keyGenerator: (req) => String(req.user?.id || req.user?.userId || ipKey(req)),
    skip: (req) => req.method === 'OPTIONS',
    handler: buildHandler('vendor-location', 'Too many location updates. Please slow down.'),
    validate: { ip: false },
});

const ALLOWED_MAPS_CLIENT_ORIGINS = [
    'https://dukaanwallah.vercel.app',
    /^https:\/\/dukaanwallah.*\.vercel\.app$/,
    'https://blaze-new-1.onrender.com',
    /^https:\/\/.*\.onrender\.com$/,
    'http://localhost:5173',
    'http://localhost:3000',
];

const isAllowedMapsClientOrigin = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    return ALLOWED_MAPS_CLIENT_ORIGINS.some((pattern) => {
        if (typeof pattern === 'string') {
            return normalized === pattern || normalized.startsWith(`${pattern}/`);
        }
        return pattern.test(normalized);
    });
};

/**
 * Restrict maps proxy to app clients (browser origin), authenticated users, or QC sessions.
 * Blocks unauthenticated direct API abuse while keeping guest checkout flows working.
 */
export const requireMapsApiAccess = (req, res, next) => {
    const hasAuth = /^Bearer\s+\S+/i.test(String(req.headers.authorization || ''));
    const hasQuickSession = Boolean(String(req.headers['x-quick-session'] || '').trim());
    const fromApp = isAllowedMapsClientOrigin(req.headers.origin)
        || isAllowedMapsClientOrigin(req.headers.referer);

    if (hasAuth || hasQuickSession || fromApp) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Maps distance API is only available to authenticated app clients.',
    });
};

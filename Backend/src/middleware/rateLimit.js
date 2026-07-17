import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Centralized Window settings
const windowMs = config.rateLimitWindowMinutes * 60 * 1000; // default 15 minutes
const authWindowMs = config.authRateLimitWindowMinutes * 60 * 1000; // default 15 minutes

// Key generator for robust IP identification behind reverse proxies/CDNs
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0].trim() 
        : req.ip;
};

/**
 * 1. Webhook Rate Limiter
 * Extremely relaxed to prevent dropping payment or critical external sync callbacks.
 */
export const webhookRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window
    max: 5000, // Very high limit
    keyGenerator: getClientIp,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many webhook requests.'
    }
});

/**
 * 2. Rider Rate Limiter
 * Accommodates high-frequency location pings, order polling, and background GPS syncs.
 */
export const riderRateLimiter = rateLimit({
    windowMs,
    max: config.nodeEnv === 'development' ? 5000 : 3000, // High ceiling for riders
    keyGenerator: getClientIp,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many rider requests, please try again later.'
    }
});

/**
 * 3. Admin Rate Limiter
 * Relaxed limit for administrative portals executing bulk actions, reports, and large data fetches.
 */
export const adminRateLimiter = rateLimit({
    windowMs,
    max: config.nodeEnv === 'development' ? 3000 : 1500,
    keyGenerator: getClientIp,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many admin requests, please try again later.'
    }
});

/**
 * 4. Stricter Auth Rate Limiter
 * Used on sensitive auth endpoints (OTP requests, verify, login). Applied selectively.
 */
export const authRateLimiter = rateLimit({
    windowMs: authWindowMs,
    max: config.nodeEnv === 'development' ? Math.max(config.authRateLimitMax, 100) : config.authRateLimitMax, // Default auth limit
    keyGenerator: getClientIp,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(`Auth Rate Limit Triggered: IP=${getClientIp(req)} Path=${req.originalUrl}`);
        res.status(options.statusCode).json(options.message);
    },
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

/**
 * 5. Vendor Live Location Rate Limiter
 * Applied only to PUT /food/restaurant/live-location.
 * Keyed by authenticated user ID so each vendor has an independent budget.
 * Normal GPS usage (10m threshold + 10s throttle) → ~6 req/min.
 * Hard cap of 30 req/min gives 5× headroom and blocks buggy clients.
 */
export const vendorLocationRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: config.nodeEnv === 'development' ? 200 : 30,
    keyGenerator: (req) => {
        // Prefer authenticated user id so multi-device vendors share one budget per account
        return (req.user?.id || req.user?.userId || getClientIp(req));
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(
            `[VendorLocation] Rate limit hit: userId=${req.user?.id || 'unknown'} IP=${getClientIp(req)}`
        );
        res.status(options.statusCode).json({
            success: false,
            message: 'Too many location updates. Please slow down.',
        });
    },
});

/**
 * 6. General API Rate Limiter
 * Standard limiter for customers and general routes. Skips paths that have dedicated limiters.
 */
export const generalApiRateLimiter = rateLimit({
    windowMs,
    max: config.nodeEnv === 'development' ? Math.max(config.rateLimitMaxRequests, 2000) : Math.max(config.rateLimitMaxRequests, 500),
    keyGenerator: getClientIp,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const url = req.originalUrl || '';
        // Skip webhook, rider, admin, and sensitive auth routes from hitting the general API budget
        return url.includes('/v1/payments/webhook') || 
               url.includes('/v1/food/delivery') || 
               url.includes('/v1/food/admin') ||
               url.includes('/auth') ||
               url.includes('/login') ||
               url.includes('/signup') ||
               url.includes('/otp') ||
               url.includes('/forgot-password') ||
               url.includes('/reset-password') ||
               url.includes('/resend-otp');
    },
    handler: (req, res, next, options) => {
        logger.warn(`General Rate Limit Triggered: IP=${getClientIp(req)} Path=${req.originalUrl}`);
        res.status(options.statusCode).json(options.message);
    },
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

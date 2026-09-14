import { invalidateCache } from '../../../middleware/cache.js';

/** Invalidate public landing caches after admin mutations. */
export async function invalidateLandingHeroCache() {
    await invalidateCache('landing_hero*');
}

export async function invalidateLandingUnder250Cache() {
    await invalidateCache('landing_under250*');
}

export async function invalidateLandingExploreCache() {
    await invalidateCache('landing_explore*');
}

export async function invalidateLandingGourmetCache() {
    await invalidateCache('landing_gourmet*');
}

export async function invalidateLandingSettingsCache() {
    await invalidateCache('landing_settings*');
}

/**
 * Express middleware: after a successful JSON response, invalidate the given cache prefixes.
 * @param {...string} prefixes - e.g. 'landing_hero', 'landing_settings'
 */
export const invalidateLandingCacheOnSuccess = (...prefixes) => {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode < 400 && prefixes.length > 0) {
                Promise.all(prefixes.map((prefix) => invalidateCache(`${prefix}*`))).catch(() => {
                    // Cache invalidation must not break the mutation response.
                });
            }
            return originalJson(body);
        };
        next();
    };
};

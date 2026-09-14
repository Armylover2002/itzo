import { deleteCacheByPrefix } from '../../../../utils/cacheManager.js';

export const DASHBOARD_STATS_CACHE_PREFIX = 'dashboard_stats:';
export const DASHBOARD_STATS_CACHE_TTL_MS = 30000;

export function buildDashboardStatsCacheKey(query = {}) {
    const period = String(query.period || 'overall').trim().toLowerCase() || 'overall';
    const zoneId =
        query.zoneId && String(query.zoneId).trim()
            ? String(query.zoneId).trim()
            : 'all';
    return `${DASHBOARD_STATS_CACHE_PREFIX}${period}:${zoneId}`;
}

export function invalidateDashboardStatsCache() {
    deleteCacheByPrefix(DASHBOARD_STATS_CACHE_PREFIX);
}

import { deleteCache } from '../../../../utils/cacheManager.js';

export const SUBSCRIPTION_OVERVIEW_CACHE_KEY = 'subscription_overview_stats';
export const SUBSCRIPTION_ANALYTICS_CACHE_KEY = 'subscription_analytics_charts';

export function invalidateSubscriptionStatsCache() {
    deleteCache(SUBSCRIPTION_OVERVIEW_CACHE_KEY);
    deleteCache(SUBSCRIPTION_ANALYTICS_CACHE_KEY);
}

import axiosInstance from './axios';

const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const apiCache = new Map();
const inFlightRequests = new Map();

const buildCacheKey = (url, params = {}, requestConfig = {}) => {
    const entries = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b));
    const headers = requestConfig?.headers || {};
    const authHeader = headers.Authorization || headers.authorization || "";
    const quickSessionHeader = headers["x-quick-session"] || headers["X-Quick-Session"] || "";
    const contextModule = requestConfig?.contextModule || "";
    return `${url}?${JSON.stringify(entries)}|${String(contextModule)}|${String(authHeader)}|${String(quickSessionHeader)}`;
};

/**
 * Generic helper to deduplicate and cache GET requests across the whole app
 */
export const getWithDedupe = async (url, params = {}, options = {}) => {
    const ttl = options.ttl || DEFAULT_CACHE_TTL_MS;
    const forceRefresh = options.forceRefresh || false;
    const requestConfig = { ...options };
    delete requestConfig.ttl;
    delete requestConfig.forceRefresh;
    const key = buildCacheKey(url, params, requestConfig);
    const now = Date.now();

    if (!forceRefresh) {
        const cached = apiCache.get(key);
        if (cached && now - cached.ts < ttl) {
            return cached.response;
        }
    }

    // Always coalesce identical in-flight GETs (even with forceRefresh).
    // forceRefresh only skips the TTL cache, not concurrent request sharing.
    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
        return inFlight;
    }

    const request = axiosInstance.get(url, { ...requestConfig, params })
        .then((response) => {
            apiCache.set(key, { ts: Date.now(), response });
            return response;
        })
        .finally(() => {
            inFlightRequests.delete(key);
        });

    inFlightRequests.set(key, request);
    return request;
};

/**
 * Helper to invalidate cache entries by key or prefix
 */
export const invalidateCache = (pattern) => {
    if (typeof pattern === 'string') {
        apiCache.forEach((_, key) => {
            if (key.startsWith(pattern)) apiCache.delete(key);
        });
    } else if (pattern instanceof RegExp) {
        apiCache.forEach((_, key) => {
            if (pattern.test(key)) apiCache.delete(key);
        });
    }
};

export const clearAllCache = () => {
    apiCache.clear();
};

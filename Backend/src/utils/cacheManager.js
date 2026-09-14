const cache = new Map();

/**
 * Get item from cache
 * @param {string} key 
 * @returns {any|null}
 */
export function getCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.value;
    }
    if (cached) {
        cache.delete(key); // Cleanup expired
    }
    return null;
}

/**
 * Set item in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlMs - TTL in milliseconds
 */
export function setCache(key, value, ttlMs = 30000) {
    cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttlMs
    });
}

/**
 * Clear cached key
 * @param {string} key 
 */
export function deleteCache(key) {
    cache.delete(key);
}

/**
 * Clear all cache entries whose keys start with the given prefix.
 * @param {string} prefix
 */
export function deleteCacheByPrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

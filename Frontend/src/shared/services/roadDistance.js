import apiClient from '@/services/api/axios.js';
import { calculateDistance as haversineFallbackKm } from '@/modules/Food/utils/common.js';
import { getQuickSessionId } from '@/modules/quickCommerce/user/services/quickApi.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

/** @type {Map<string, { value: { distanceKm: number, estimated: boolean }, expiresAt: number }>} */
const cache = new Map();

const roundCoord = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'x';
  return n.toFixed(4);
};

const cacheKey = (lat1, lng1, lat2, lng2) =>
  `v3_${roundCoord(lat1)}_${roundCoord(lng1)}_${roundCoord(lat2)}_${roundCoord(lng2)}`;

const readCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const writeCache = (key, value) => {
  if (!value || value.estimated) return;
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const fallbackDistanceKm = (lat1, lng1, lat2, lng2) => {
  const straight = haversineFallbackKm(lat1, lng1, lat2, lng2);
  if (!Number.isFinite(straight)) return null;
  return Math.round(straight * 1.3 * 100) / 100;
};

const mapsRequestConfig = () => {
  const headers = {};
  try {
    const sessionId = getQuickSessionId();
    if (sessionId) headers['x-quick-session'] = sessionId;
  } catch {
    // ignore session lookup errors
  }
  return { headers };
};

/** @type {Map<string, Promise<{ distanceKm: number, estimated: boolean }|null>>} */
const inFlight = new Map();

/**
 * Road/travel distance details via backend Google Distance Matrix proxy.
 * @returns {Promise<{ distanceKm: number|null, estimated: boolean }|null>}
 */
export async function getRoadDistanceDetails(lat1, lng1, lat2, lng2) {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);

  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;

  const key = cacheKey(aLat, aLng, bLat, bLng);
  const cached = readCache(key);
  if (cached != null) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await apiClient.get('/common/maps/distance', {
        ...mapsRequestConfig(),
        params: {
          originLat: aLat,
          originLng: aLng,
          destLat: bLat,
          destLng: bLng,
        },
      });
      const distanceKm = Number(response?.data?.data?.distanceKm);
      const estimated = Boolean(response?.data?.data?.estimated);
      if (Number.isFinite(distanceKm)) {
        const value = { distanceKm, estimated };
        writeCache(key, value);
        return value;
      }
    } catch {
      // Fall through to local estimate when routing service is unavailable.
    }

    const fallback = fallbackDistanceKm(aLat, aLng, bLat, bLng);
    if (fallback == null) return null;
    return { distanceKm: fallback, estimated: true };
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

/**
 * Road/travel distance in km via backend Google Distance Matrix proxy.
 */
export async function getRoadDistanceKm(lat1, lng1, lat2, lng2) {
  const details = await getRoadDistanceDetails(lat1, lng1, lat2, lng2);
  return details?.distanceKm ?? null;
}

/**
 * Batch road distances from one origin to many destinations (max 25).
 */
export async function getRoadDistancesFromOrigin(originLat, originLng, destinations = []) {
  const lat = Number(originLat);
  const lng = Number(originLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !destinations.length) {
    return destinations.map(() => null);
  }

  const normalized = destinations.map((dest) => ({
    lat: Number(dest?.lat),
    lng: Number(dest?.lng),
  }));

  const results = normalized.map((dest, index) => {
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return null;
    const key = cacheKey(lat, lng, dest.lat, dest.lng);
    const cached = readCache(key);
    if (cached != null) return cached.distanceKm;

    return { dest, uncachedIndex: index, key, pending: true };
  });

  const uncached = results
    .map((item, index) => (item?.pending ? { index, ...item } : null))
    .filter(Boolean);

  if (uncached.length) {
    try {
      const response = await apiClient.post('/common/maps/distance/batch', {
        originLat: lat,
        originLng: lng,
        destinations: uncached.map((item) => ({ lat: item.dest.lat, lng: item.dest.lng })),
      }, mapsRequestConfig());
      const distances = response?.data?.data?.distances || [];
      uncached.forEach((item, i) => {
        const distanceKm = Number(distances[i]?.distanceKm);
        const estimated = Boolean(distances[i]?.estimated);
        const value = Number.isFinite(distanceKm)
          ? { distanceKm, estimated }
          : (() => {
              const fallback = fallbackDistanceKm(lat, lng, item.dest.lat, item.dest.lng);
              return fallback != null ? { distanceKm: fallback, estimated: true } : null;
            })();
        if (value != null) {
          writeCache(item.key, value);
          results[item.index] = value.distanceKm;
        }
      });
    } catch {
      uncached.forEach((item) => {
        const fallback = fallbackDistanceKm(lat, lng, item.dest.lat, item.dest.lng);
        if (fallback != null) {
          results[item.index] = fallback;
        }
      });
    }
  }

  return results.map((item, index) => {
    if (typeof item === 'number') return item;
    const dest = normalized[index];
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return null;
    return fallbackDistanceKm(lat, lng, dest.lat, dest.lng);
  });
}

/**
 * Batch road distances from many origins to one destination (restaurant → user).
 * Matches checkout fee direction used by resolveRestaurantToUserRoadDistanceKm.
 */
export async function getRoadDistancesToDestination(origins = [], destLat, destLng) {
  const destinationLat = Number(destLat);
  const destinationLng = Number(destLng);
  if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng) || !origins.length) {
    return origins.map(() => null);
  }

  const normalized = origins.map((origin) => ({
    lat: Number(origin?.lat),
    lng: Number(origin?.lng),
  }));

  const results = normalized.map((origin) => {
    if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
    const key = cacheKey(origin.lat, origin.lng, destinationLat, destinationLng);
    const cached = readCache(key);
    if (cached != null) return cached.distanceKm;
    return { origin, key, pending: true };
  });

  const uncached = results
    .map((item, index) => (item?.pending ? { index, ...item } : null))
    .filter(Boolean);

  if (uncached.length) {
    try {
      const response = await apiClient.post('/common/maps/distance/batch', {
        origins: uncached.map((item) => ({ lat: item.origin.lat, lng: item.origin.lng })),
        destination: { lat: destinationLat, lng: destinationLng },
      }, mapsRequestConfig());
      const distances = response?.data?.data?.distances || [];
      uncached.forEach((item, i) => {
        const distanceKm = Number(distances[i]?.distanceKm);
        const estimated = Boolean(distances[i]?.estimated);
        const value = Number.isFinite(distanceKm)
          ? { distanceKm, estimated }
          : (() => {
              const fallback = fallbackDistanceKm(
                item.origin.lat,
                item.origin.lng,
                destinationLat,
                destinationLng,
              );
              return fallback != null ? { distanceKm: fallback, estimated: true } : null;
            })();
        if (value != null) {
          writeCache(item.key, value);
          results[item.index] = value.distanceKm;
        }
      });
    } catch {
      uncached.forEach((item) => {
        const fallback = fallbackDistanceKm(
          item.origin.lat,
          item.origin.lng,
          destinationLat,
          destinationLng,
        );
        if (fallback != null) {
          results[item.index] = fallback;
        }
      });
    }
  }

  return results.map((item, index) => {
    if (typeof item === 'number') return item;
    const origin = normalized[index];
    if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
    return fallbackDistanceKm(origin.lat, origin.lng, destinationLat, destinationLng);
  });
}

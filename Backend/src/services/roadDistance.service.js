import axios from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const MAPS_TIMEOUT_MS = 8000;
const ROAD_DISTANCE_FACTOR = 1.3;
const FALLBACK_AVG_SPEED_KMPH = 22;
const EARTH_RADIUS_KM = 6371;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_SIZE = 5000;
const COORD_PRECISION = 4;
const MATRIX_DEST_LIMIT = 25;

/** @type {Map<string, { value: RoadDistanceResult, expiresAt: number }>} */
const cache = new Map();

/**
 * @typedef {Object} RoadDistanceResult
 * @property {number} distanceKm
 * @property {number} distanceMeters
 * @property {number} [durationMin]
 * @property {number} [durationSeconds]
 * @property {boolean} [estimated]
 */

function roundCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'x';
  return n.toFixed(COORD_PRECISION);
}

function toPoint(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude ?? point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function cacheKey(origin, destination) {
  return `${roundCoord(origin.lat)}_${roundCoord(origin.lng)}_${roundCoord(destination.lat)}_${roundCoord(destination.lng)}`;
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  if (value?.estimated) return;
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLng = Number(lon1);
  const bLat = Number(lat2);
  const bLng = Number(lon2);
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return NaN;

  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_KM * c;
}

/**
 * Deterministic offline estimate when Google Maps is unavailable.
 * @returns {RoadDistanceResult}
 */
export function buildFallbackRoadDistance(origin, destination) {
  const from = toPoint(origin);
  const to = toPoint(destination);
  if (!from || !to) {
    return { distanceKm: 0, distanceMeters: 0, durationMin: 1, durationSeconds: 60, estimated: true };
  }

  const straightKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const distanceKm = Math.round(straightKm * ROAD_DISTANCE_FACTOR * 100) / 100;
  const distanceMeters = Math.round(distanceKm * 1000);
  const durationMin = Math.max(1, Math.round((distanceKm / FALLBACK_AVG_SPEED_KMPH) * 60));

  return {
    distanceKm,
    distanceMeters,
    durationMin,
    durationSeconds: durationMin * 60,
    estimated: true,
  };
}

function getApiKey() {
  return (
    config.googleMapsApiKey ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    ''
  );
}

async function googleGet(url) {
  const { data } = await axios.get(url, { timeout: MAPS_TIMEOUT_MS });
  return data;
}

function parseDistanceElement(element) {
  if (!element || element.status !== 'OK') return null;
  const distanceMeters = Number(element.distance?.value);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  const durationSeconds = Number(element.duration?.value);
  const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
  const durationMin = Number.isFinite(durationSeconds)
    ? Math.max(1, Math.round(durationSeconds / 60))
    : Math.max(1, Math.round((distanceKm / FALLBACK_AVG_SPEED_KMPH) * 60));

  return {
    distanceKm,
    distanceMeters,
    durationMin,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : durationMin * 60,
    estimated: false,
  };
}

/**
 * Road/travel distance between two coordinates (driving).
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<RoadDistanceResult>}
 */
export async function getRoadDistanceKm(origin, destination) {
  const from = toPoint(origin);
  const to = toPoint(destination);
  if (!from || !to) return buildFallbackRoadDistance(origin, destination);

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached) return cached;

  const apiKey = getApiKey();
  if (!apiKey) {
    const fallback = buildFallbackRoadDistance(from, to);
    writeCache(key, fallback);
    return fallback;
  }

  const originStr = `${from.lat},${from.lng}`;
  const destStr = `${to.lat},${to.lng}`;

  try {
    const data = await googleGet(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=driving&key=${apiKey}`,
    );

    const element = data?.rows?.[0]?.elements?.[0];
    const parsed = parseDistanceElement(element);
    if (!parsed) {
      logger.warn(`[RoadDistance] Distance Matrix returned no route (${data?.status}); using fallback`);
      const fallback = buildFallbackRoadDistance(from, to);
      writeCache(key, fallback);
      return fallback;
    }

    writeCache(key, parsed);
    return parsed;
  } catch (err) {
    logger.warn(`[RoadDistance] Distance Matrix request failed (${err?.code || err?.message}); using fallback`);
    const fallback = buildFallbackRoadDistance(from, to);
    writeCache(key, fallback);
    return fallback;
  }
}

/**
 * Returns only the distance in km (convenience wrapper).
 */
export async function getRoadDistanceKmValue(origin, destination) {
  const result = await getRoadDistanceKm(origin, destination);
  return Number.isFinite(result?.distanceKm) ? result.distanceKm : 0;
}

/**
 * Batch road distances from one origin to many destinations (Distance Matrix, chunks of 25).
 * @param {{ lat: number, lng: number }} origin
 * @param {Array<{ lat: number, lng: number }>} destinations
 * @returns {Promise<RoadDistanceResult[]>}
 */
export async function getRoadDistancesFromOrigin(origin, destinations = []) {
  const from = toPoint(origin);
  if (!from) {
    return destinations.map((dest) => buildFallbackRoadDistance(origin, dest));
  }

  const normalized = destinations.map((dest) => {
    const to = toPoint(dest);
    if (!to) return { to: null, cached: buildFallbackRoadDistance(from, dest) };
    const key = cacheKey(from, to);
    const cached = readCache(key);
    return { to, cached: cached || null };
  });

  const results = normalized.map((entry) => entry.cached);
  const uncachedIndexes = [];
  const uncachedDestinations = [];

  normalized.forEach((entry, index) => {
    if (entry.cached) return;
    if (!entry.to) {
      results[index] = buildFallbackRoadDistance(from, destinations[index]);
      return;
    }
    uncachedIndexes.push(index);
    uncachedDestinations.push(entry.to);
  });

  if (uncachedDestinations.length === 0) return results;

  const apiKey = getApiKey();
  if (!apiKey) {
    uncachedIndexes.forEach((idx, i) => {
      const fallback = buildFallbackRoadDistance(from, uncachedDestinations[i]);
      results[idx] = fallback;
      const to = uncachedDestinations[i];
      writeCache(cacheKey(from, to), fallback);
    });
    return results;
  }

  for (let offset = 0; offset < uncachedDestinations.length; offset += MATRIX_DEST_LIMIT) {
    const chunk = uncachedDestinations.slice(offset, offset + MATRIX_DEST_LIMIT);
    const chunkIndexes = uncachedIndexes.slice(offset, offset + MATRIX_DEST_LIMIT);
    const originStr = `${from.lat},${from.lng}`;
    const destStr = chunk.map((d) => `${d.lat},${d.lng}`).join('|');

    try {
      const data = await googleGet(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=driving&key=${apiKey}`,
      );
      const elements = data?.rows?.[0]?.elements || [];

      chunk.forEach((dest, i) => {
        const idx = chunkIndexes[i];
        const parsed = parseDistanceElement(elements[i]);
        const value = parsed || buildFallbackRoadDistance(from, dest);
        results[idx] = value;
        writeCache(cacheKey(from, dest), value);
      });
    } catch (err) {
      logger.warn(`[RoadDistance] Batch Distance Matrix failed (${err?.code || err?.message}); using fallback`);
      chunk.forEach((dest, i) => {
        const idx = chunkIndexes[i];
        const fallback = buildFallbackRoadDistance(from, dest);
        results[idx] = fallback;
        writeCache(cacheKey(from, dest), fallback);
      });
    }
  }

  return results;
}

/**
 * Batch road distances from many origins to one destination (restaurant → user).
 * Matches checkout fee direction used by resolveRestaurantToUserRoadDistanceKm.
 * @param {Array<{ lat: number, lng: number }>} origins
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<RoadDistanceResult[]>}
 */
export async function getRoadDistancesToDestination(origins = [], destination) {
  const to = toPoint(destination);
  if (!to) {
    return origins.map((origin) => buildFallbackRoadDistance(origin, destination));
  }

  const normalized = origins.map((origin) => {
    const from = toPoint(origin);
    if (!from) return { from: null, cached: buildFallbackRoadDistance(origin, destination) };
    const key = cacheKey(from, to);
    const cached = readCache(key);
    return { from, cached: cached || null };
  });

  const results = normalized.map((entry) => entry.cached);
  const uncachedIndexes = [];
  const uncachedOrigins = [];

  normalized.forEach((entry, index) => {
    if (entry.cached) return;
    if (!entry.from) {
      results[index] = buildFallbackRoadDistance(origins[index], destination);
      return;
    }
    uncachedIndexes.push(index);
    uncachedOrigins.push(entry.from);
  });

  if (uncachedOrigins.length === 0) return results;

  const apiKey = getApiKey();
  if (!apiKey) {
    uncachedIndexes.forEach((idx, i) => {
      results[idx] = buildFallbackRoadDistance(uncachedOrigins[i], to);
    });
    return results;
  }

  // Distance Matrix allows multiple origins with a single destination.
  for (let offset = 0; offset < uncachedOrigins.length; offset += MATRIX_DEST_LIMIT) {
    const chunk = uncachedOrigins.slice(offset, offset + MATRIX_DEST_LIMIT);
    const chunkIndexes = uncachedIndexes.slice(offset, offset + MATRIX_DEST_LIMIT);
    const originStr = chunk.map((o) => `${o.lat},${o.lng}`).join('|');
    const destStr = `${to.lat},${to.lng}`;

    try {
      const data = await googleGet(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&mode=driving&key=${apiKey}`,
      );
      const rows = data?.rows || [];

      chunk.forEach((origin, i) => {
        const idx = chunkIndexes[i];
        const parsed = parseDistanceElement(rows[i]?.elements?.[0]);
        const value = parsed || buildFallbackRoadDistance(origin, to);
        results[idx] = value;
        if (!value.estimated) writeCache(cacheKey(origin, to), value);
      });
    } catch (err) {
      logger.warn(`[RoadDistance] Multi-origin Distance Matrix failed (${err?.code || err?.message}); using fallback`);
      chunk.forEach((origin, i) => {
        const idx = chunkIndexes[i];
        results[idx] = buildFallbackRoadDistance(origin, to);
      });
    }
  }

  return results;
}

/**
 * Score destinations by road distance from an origin; filters by maxKm and sorts ascending.
 * @param {{ lat: number, lng: number }} origin
 * @param {Array<{ lat: number, lng: number, [key: string]: unknown }>} points
 * @param {{ maxKm?: number }} [options]
 */
export async function scorePointsByRoadDistance(origin, points = [], { maxKm } = {}) {
  const from = toPoint(origin);
  if (!from || !points.length) return [];

  const validPoints = points
    .map((point, index) => {
      const to = toPoint(point);
      if (!to) return null;
      return { index, lat: to.lat, lng: to.lng, point };
    })
    .filter(Boolean);

  const distances = await getRoadDistancesFromOrigin(
    from,
    validPoints.map((entry) => ({ lat: entry.lat, lng: entry.lng })),
  );

  const scored = validPoints
    .map((entry, i) => {
      const distanceKm = distances[i]?.distanceKm;
      return {
        ...entry.point,
        distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
      };
    })
    .filter((item) => {
      if (!Number.isFinite(item.distanceKm)) return false;
      if (Number.isFinite(maxKm)) return item.distanceKm <= maxKm;
      return true;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return scored;
}

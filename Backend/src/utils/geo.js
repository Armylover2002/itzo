import { ApiError } from './ApiError.js';

export const normalizePoint = (coordinates, fieldName = 'coordinates') => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new ApiError(400, `${fieldName} must be [longitude, latitude]`);
  }

  const [longitude, latitude] = coordinates.map(Number);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new ApiError(400, `${fieldName} must contain valid longitude and latitude values`);
  }

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new ApiError(400, `${fieldName} must be valid [longitude, latitude]`);
  }

  return [longitude, latitude];
};

export const toPoint = (coordinates, fieldName) => ({
  type: 'Point',
  coordinates: normalizePoint(coordinates, fieldName),
});

/**
 * Ray-casting point-in-polygon for lat/lng polygons.
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {Array} polygon Array of {latitude, longitude} objects
 * @returns {boolean}
 */
export const isPointInPolygon = (lat, lng, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const EARTH_RADIUS_METERS = 6371000;

export const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Point-in-zone check that fast-paths circle zones (O(1) distance compare)
 * instead of ray-casting through a 32-64 point polygon approximation.
 * Falls back to isPointInPolygon for hand-drawn / legacy polygon zones.
 * @param {number} lat
 * @param {number} lng
 * @param {{shapeType?: string, center?: {latitude:number, longitude:number}, radiusMeters?: number, coordinates?: Array}} zone
 * @returns {boolean}
 */
/**
 * Evenly downsamples a polygon's points to a max count (default 20) so no
 * newly-saved zone can bloat storage or slow down isPointInPolygon checks.
 * Only applied at write time — never touches already-saved zones.
 * @param {Array<{latitude:number, longitude:number}>} coords
 * @param {number} maxPoints
 */
export const capPolygonPoints = (coords, maxPoints = 20) => {
  if (!Array.isArray(coords) || coords.length <= maxPoints) return coords;
  const step = coords.length / maxPoints;
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.floor(i * step)]);
  }
  return result;
};

export const isPointInZone = (lat, lng, zone) => {
  if (!zone) return false;
  if (zone.shapeType === 'circle' && zone.center && Number.isFinite(zone.radiusMeters)) {
    return haversineDistanceMeters(lat, lng, zone.center.latitude, zone.center.longitude) <= zone.radiusMeters;
  }
  return isPointInPolygon(lat, lng, zone.coordinates);
};

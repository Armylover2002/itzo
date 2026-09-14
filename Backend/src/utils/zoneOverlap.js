import { isPointInPolygon } from './geo.js';
import { haversineKm } from '../modules/food/orders/services/order.helpers.js';

export const ZONE_OVERLAP_MESSAGE =
  'A zone already exists for this area. Please modify the radius or choose another location.';

export function normalizeZoneCoordinate(coord) {
  if (!coord || typeof coord !== 'object') return null;
  const latitude = Number(coord.latitude ?? coord.lat);
  const longitude = Number(coord.longitude ?? coord.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function normalizeZoneCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.map(normalizeZoneCoordinate).filter(Boolean);
}

/**
 * Approximate polygon area in km² using equirectangular projection
 * around the centroid (accurate enough for city-scale delivery zones).
 */
export function computePolygonAreaKm2(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (coords.length < 3) return 0;

  const lat0 =
    (coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length) *
    (Math.PI / 180);
  const earthRadiusKm = 6371;

  const projected = coords.map((c) => ({
    x: earthRadiusKm * (c.longitude * Math.PI / 180) * Math.cos(lat0),
    y: earthRadiusKm * (c.latitude * Math.PI / 180),
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y - projected[j].x * projected[i].y;
  }

  return Math.abs(area) / 2;
}

export function getZoneCoordinatesForCheck(zone) {
  if (!zone || typeof zone !== 'object') return [];

  if (Array.isArray(zone.coordinates) && zone.coordinates.length >= 3) {
    return normalizeZoneCoordinates(zone.coordinates);
  }

  const ring = zone.geometry?.coordinates?.[0];
  if (Array.isArray(ring) && ring.length >= 3) {
    return ring.map(([lng, lat]) => normalizeZoneCoordinate({ latitude: lat, longitude: lng })).filter(Boolean);
  }

  return [];
}

export function coordinatesToGeoJSONPolygon(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (coords.length < 3) return null;

  const ring = coords.map((c) => [c.longitude, c.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }

  return { type: 'Polygon', coordinates: [ring] };
}

export function getPolygonCentroid(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (!coords.length) return null;

  const latitude = coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length;
  const longitude = coords.reduce((sum, c) => sum + c.longitude, 0) / coords.length;
  return { latitude, longitude };
}

export function getPolygonBoundingRadius(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  const centroid = getPolygonCentroid(coords);
  if (!centroid || coords.length < 3) return 0;

  let maxDistance = 0;
  for (const coord of coords) {
    const distance = haversineKm(
      centroid.latitude,
      centroid.longitude,
      coord.latitude,
      coord.longitude,
    );
    if (distance > maxDistance) maxDistance = distance;
  }
  return maxDistance;
}

export function getBoundingBox(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (!coords.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const coord of coords) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  }

  return { minLat, maxLat, minLng, maxLng };
}

export function boundingBoxesOverlap(boxA, boxB) {
  if (!boxA || !boxB) return false;
  return !(
    boxA.maxLat < boxB.minLat ||
    boxA.minLat > boxB.maxLat ||
    boxA.maxLng < boxB.minLng ||
    boxA.minLng > boxB.maxLng
  );
}

function orient(a, b, c) {
  return (
    (b.longitude - a.longitude) * (c.latitude - a.latitude) -
    (b.latitude - a.latitude) * (c.longitude - a.longitude)
  );
}

function onSegment(a, b, point) {
  const epsilon = 1e-12;
  return (
    Math.min(a.longitude, b.longitude) - epsilon <= point.longitude &&
    point.longitude <= Math.max(a.longitude, b.longitude) + epsilon &&
    Math.min(a.latitude, b.latitude) - epsilon <= point.latitude &&
    point.latitude <= Math.max(a.latitude, b.latitude) + epsilon
  );
}

function segmentsIntersect(p1, p2, p3, p4) {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);

  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function getPolygonEdges(coords) {
  const edges = [];
  for (let i = 0; i < coords.length; i += 1) {
    edges.push([coords[i], coords[(i + 1) % coords.length]]);
  }
  return edges;
}

export function doPolygonsOverlap(coordsA, coordsB) {
  const polygonA = normalizeZoneCoordinates(coordsA);
  const polygonB = normalizeZoneCoordinates(coordsB);
  if (polygonA.length < 3 || polygonB.length < 3) return false;

  const centroidA = getPolygonCentroid(polygonA);
  const centroidB = getPolygonCentroid(polygonB);
  const radiusA = getPolygonBoundingRadius(polygonA);
  const radiusB = getPolygonBoundingRadius(polygonB);
  const centerDistance = haversineKm(
    centroidA.latitude,
    centroidA.longitude,
    centroidB.latitude,
    centroidB.longitude,
  );

  if (centerDistance >= radiusA + radiusB) return false;

  if (isPointInPolygon(centroidA.latitude, centroidA.longitude, polygonB)) return true;
  if (isPointInPolygon(centroidB.latitude, centroidB.longitude, polygonA)) return true;

  for (const vertex of polygonA) {
    if (isPointInPolygon(vertex.latitude, vertex.longitude, polygonB)) return true;
  }
  for (const vertex of polygonB) {
    if (isPointInPolygon(vertex.latitude, vertex.longitude, polygonA)) return true;
  }

  const edgesA = getPolygonEdges(polygonA);
  const edgesB = getPolygonEdges(polygonB);
  for (const [edgeAStart, edgeAEnd] of edgesA) {
    for (const [edgeBStart, edgeBEnd] of edgesB) {
      if (segmentsIntersect(edgeAStart, edgeAEnd, edgeBStart, edgeBEnd)) return true;
    }
  }

  return false;
}

export async function findOverlappingZone(Model, coordinates, options = {}) {
  const { excludeId, extraFilter = {} } = options;
  const normalized = normalizeZoneCoordinates(coordinates);
  if (normalized.length < 3) return null;

  const geometry = coordinatesToGeoJSONPolygon(normalized);
  const filter = { ...extraFilter };
  if (excludeId) filter._id = { $ne: excludeId };

  const bbox = getBoundingBox(normalized);
  const candidates = new Map();

  if (geometry) {
    try {
      const geoMatches = await Model.find({
        ...filter,
        geometry: { $geoIntersects: { $geometry: geometry } },
      })
        .select('name coordinates geometry')
        .lean();

      for (const zone of geoMatches) {
        candidates.set(String(zone._id), zone);
      }
    } catch {
      // Model may not have a geometry field or 2dsphere index yet.
    }
  }

  const legacyMatches = await Model.find({
    ...filter,
    $or: [{ geometry: { $exists: false } }, { geometry: null }],
  })
    .select('name coordinates geometry')
    .lean();

  for (const zone of legacyMatches) {
    const existingCoords = getZoneCoordinatesForCheck(zone);
    if (!boundingBoxesOverlap(bbox, getBoundingBox(existingCoords))) continue;
    candidates.set(String(zone._id), zone);
  }

  for (const existing of candidates.values()) {
    if (doPolygonsOverlap(normalized, getZoneCoordinatesForCheck(existing))) {
      return existing;
    }
  }

  return null;
}

export async function assertNoZoneOverlap(Model, coordinates, options = {}) {
  const overlapping = await findOverlappingZone(Model, coordinates, options);
  if (overlapping) {
    return { error: ZONE_OVERLAP_MESSAGE };
  }
  return null;
}

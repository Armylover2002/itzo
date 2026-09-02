const ZONE_OVERLAP_MESSAGE =
  'A zone already exists for this area. Please modify the radius or choose another location.';

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeZoneCoordinate(coord) {
  if (!coord || typeof coord !== 'object') return null;
  const latitude = Number(coord.latitude ?? coord.lat);
  const longitude = Number(coord.longitude ?? coord.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function normalizeZoneCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.map(normalizeZoneCoordinate).filter(Boolean);
}

function isPointInPolygon(lat, lng, polygon) {
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
}

function getPolygonCentroid(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (!coords.length) return null;
  const latitude = coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length;
  const longitude = coords.reduce((sum, c) => sum + c.longitude, 0) / coords.length;
  return { latitude, longitude };
}

function getPolygonBoundingRadius(coordinates) {
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

export function findZoneOverlapMessage(newCoordinates, existingZones, excludeId = null) {
  if (!Array.isArray(existingZones) || existingZones.length === 0) return null;

  for (const zone of existingZones) {
    if (excludeId && String(zone._id) === String(excludeId)) continue;
    if (!zone?.coordinates || zone.coordinates.length < 3) continue;
    if (doPolygonsOverlap(newCoordinates, zone.coordinates)) {
      return ZONE_OVERLAP_MESSAGE;
    }
  }

  return null;
}

export { ZONE_OVERLAP_MESSAGE };

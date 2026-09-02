/** Shared zone coverage helpers (Food + Quick Commerce admin). */

const KM2_TO_MI2 = 1 / 2.589988110336;

function normalizeCoordinate(coord) {
  if (!coord || typeof coord !== 'object') return null;
  const latitude = Number(coord.latitude ?? coord.lat);
  const longitude = Number(coord.longitude ?? coord.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function normalizeZoneCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.map(normalizeCoordinate).filter(Boolean);
}

/**
 * Approximate polygon area in km² (equirectangular projection around centroid).
 * City-scale delivery zones are accurate enough for admin display.
 */
export function computePolygonAreaKm2(coordinates) {
  const coords = normalizeZoneCoordinates(coordinates);
  if (coords.length < 3) return 0;

  const lat0 =
    (coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length) *
    (Math.PI / 180);
  const earthRadiusKm = 6371;

  const projected = coords.map((c) => ({
    x: earthRadiusKm * (c.longitude * (Math.PI / 180)) * Math.cos(lat0),
    y: earthRadiusKm * (c.latitude * (Math.PI / 180)),
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y - projected[j].x * projected[i].y;
  }

  return Math.abs(area) / 2;
}

export function resolveZoneAreaKm2(zoneOrCoordinates) {
  if (Array.isArray(zoneOrCoordinates)) {
    return computePolygonAreaKm2(zoneOrCoordinates);
  }
  const stored = Number(zoneOrCoordinates?.coverageAreaKm2);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return computePolygonAreaKm2(zoneOrCoordinates?.coordinates);
}

export function formatAreaValue(areaKm2, unit = 'kilometer') {
  const km2 = Number(areaKm2);
  if (!Number.isFinite(km2) || km2 <= 0) return null;
  const isMiles = String(unit || '').toLowerCase() === 'miles';
  const value = isMiles ? km2 * KM2_TO_MI2 : km2;
  const rounded = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${rounded} ${isMiles ? 'mi²' : 'km²'}`;
}

export function getUnitLabel(unit = 'kilometer') {
  return String(unit || '').toLowerCase() === 'miles' ? 'Miles (mi)' : 'Kilometers (km)';
}

/** e.g. "Kilometers (km) · 12.4 km²" */
export function formatUnitWithCoverage(unit = 'kilometer', areaKm2) {
  const label = getUnitLabel(unit);
  const area = formatAreaValue(areaKm2, unit);
  return area ? `${label} · ${area}` : label;
}

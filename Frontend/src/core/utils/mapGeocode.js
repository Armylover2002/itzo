/** Haversine distance in meters between two lat/lng points. */
export const distanceMeters = (a, b) => {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const DEFAULT_MAP_GEOCODE_DEBOUNCE_MS = 400;
export const DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M = 50;

export const hasMovedSignificantly = (
  prev,
  next,
  thresholdM = DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
) => distanceMeters(prev, next) >= thresholdM;

export const toMapCoords = (lat, lng) => ({
  lat: parseFloat(Number(lat).toFixed(6)),
  lng: parseFloat(Number(lng).toFixed(6)),
});

export const coordsKey = (coords) => `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;

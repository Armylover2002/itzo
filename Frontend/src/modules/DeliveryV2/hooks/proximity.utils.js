/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere.
 * Returns distance in METERS.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const a = Number(lat1);
  const b = Number(lon1);
  const c = Number(lat2);
  const d = Number(lon2);
  // Must use Number.isFinite — truthy checks break on valid 0 coords and coerce badly.
  if (![a, b, c, d].every(Number.isFinite)) return Infinity;

  const R = 6371e3; // Earth radius in meters
  const φ1 = (a * Math.PI) / 180;
  const φ2 = (c * Math.PI) / 180;
  const Δφ = ((c - a) * Math.PI) / 180;
  const Δλ = ((d - b) * Math.PI) / 180;

  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * y; // Distance in meters
};

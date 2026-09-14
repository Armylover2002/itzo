/**
 * Ray-casting point-in-polygon for zone coordinates.
 * Supports { latitude, longitude } or { lat, lng } vertex shapes.
 */
export const isPointInZone = (lat, lng, polygon = []) => {
  const pointLat = Number(lat);
  const pointLng = Number(lng);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return false;
  if (!Array.isArray(polygon) || polygon.length < 3) return true;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i]?.longitude ?? polygon[i]?.lng);
    const yi = Number(polygon[i]?.latitude ?? polygon[i]?.lat);
    const xj = Number(polygon[j]?.longitude ?? polygon[j]?.lng);
    const yj = Number(polygon[j]?.latitude ?? polygon[j]?.lat);
    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) {
      continue;
    }
    const intersects =
      yi > pointLat !== yj > pointLat &&
      pointLng < ((xj - xi) * (pointLat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

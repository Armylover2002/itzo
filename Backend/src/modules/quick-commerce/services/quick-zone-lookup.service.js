import { QuickZone } from '../models/quick_zone.model.js';
import { ValidationError } from '../../../core/auth/errors.js';
import { isPointInPolygon } from '../../../utils/geo.js';

const OUT_OF_SERVICE_MESSAGE = 'Delivery address is outside our service area';

export async function findQuickZoneForPoint(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  const point = { type: 'Point', coordinates: [lngNum, latNum] };

  const byGeometry = await QuickZone.findOne({
    isActive: true,
    geometry: { $geoIntersects: { $geometry: point } },
  })
    .select({ _id: 1, name: 1, zoneName: 1 })
    .lean();

  if (byGeometry) return byGeometry;

  const zones = await QuickZone.find({ isActive: true })
    .select({ _id: 1, name: 1, zoneName: 1, coordinates: 1 })
    .lean();

  for (const zone of zones) {
    const coords = (Array.isArray(zone.coordinates) ? zone.coordinates : []).filter(
      (p) => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude),
    );
    if (coords.length >= 3 && isPointInPolygon(latNum, lngNum, coords)) {
      return zone;
    }
  }

  return null;
}

export async function detectQuickZoneForPoint(lat, lng) {
  const zone = await findQuickZoneForPoint(lat, lng);
  if (!zone) {
    return { status: 'OUT_OF_SERVICE', zoneId: null, zone: null };
  }

  return {
    status: 'IN_SERVICE',
    zoneId: String(zone._id),
    zone: {
      id: String(zone._id),
      name: zone.name,
      zoneName: zone.zoneName || zone.name,
    },
  };
}

/**
 * Hard serviceability gate for Quick Commerce orders.
 */
export async function assertQuickDeliveryInServiceArea(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    throw new ValidationError('Delivery location coordinates are required');
  }

  const result = await detectQuickZoneForPoint(latNum, lngNum);
  if (result.status !== 'IN_SERVICE') {
    throw new ValidationError(OUT_OF_SERVICE_MESSAGE);
  }

  return result;
}

export { OUT_OF_SERVICE_MESSAGE as QUICK_ZONE_OUT_OF_SERVICE_MESSAGE };

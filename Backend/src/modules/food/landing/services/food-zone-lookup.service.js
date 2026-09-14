import { FoodZone } from '../../admin/models/zone.model.js';
import { isPointInPolygon } from '../../../../utils/geo.js';

const DETECT_ZONE_SELECT = { _id: 1, name: 1, zoneName: 1, serviceLocation: 1 };

const toDetectZonePayload = (zone) => {
    const id = String(zone._id);
    return {
        status: 'IN_SERVICE',
        zoneId: id,
        zone: {
            _id: id,
            id,
            name: zone.name,
            zoneName: zone.zoneName || zone.name,
            serviceLocation: zone.serviceLocation || zone.zoneName || zone.name,
        },
    };
};

export async function findFoodZoneForPoint(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

    const point = { type: 'Point', coordinates: [lngNum, latNum] };

    const byGeometry = await FoodZone.findOne({
        isActive: true,
        geometry: { $geoIntersects: { $geometry: point } },
    })
        .select(DETECT_ZONE_SELECT)
        .lean();

    if (byGeometry) return byGeometry;

    const zones = await FoodZone.find({ isActive: true })
        .select({ ...DETECT_ZONE_SELECT, coordinates: 1 })
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

export async function detectFoodZoneForPoint(lat, lng) {
    const zone = await findFoodZoneForPoint(lat, lng);
    if (!zone) {
        return { status: 'OUT_OF_SERVICE', zoneId: null, zone: null };
    }
    return toDetectZonePayload(zone);
}

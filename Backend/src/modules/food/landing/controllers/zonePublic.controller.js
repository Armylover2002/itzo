import { FoodZone } from '../../admin/models/zone.model.js';
import { detectFoodZoneForPoint } from '../services/food-zone-lookup.service.js';

const toFinite = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
};

/** GET /zones/detect?lat=..&lng=.. */
export const detectZonePublicController = async (req, res, next) => {
    try {
        const lat = toFinite(req.query.lat);
        const lng = toFinite(req.query.lng);
        if (lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'lat and lng are required' });
        }

        const data = await detectFoodZoneForPoint(lat, lng);

        return res.status(200).json({
            success: true,
            message: data.status === 'IN_SERVICE' ? 'Zone detected' : 'Out of service',
            data,
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/public - list active zones for onboarding/selects */
export const listZonesPublicController = async (_req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Zones fetched successfully',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/nearby - list zones for hotspot/nearby visualization */
export const listZonesNearbyPublicController = async (req, res, next) => {
    try {
        const zones = await FoodZone.find({ isActive: true })
            .select('name zoneName serviceLocation country unit isActive coordinates createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Nearby zones fetched',
            data: { zones }
        });
    } catch (error) {
        next(error);
    }
};


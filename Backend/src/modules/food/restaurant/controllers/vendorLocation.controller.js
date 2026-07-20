import { sendError, sendResponse } from '../../../../utils/response.js';
import mongoose from 'mongoose';
import { FoodZone } from '../../admin/models/zone.model.js';
import { isPointInPolygon } from '../../../../utils/geo.js';
import { logger } from '../../../../utils/logger.js';
import { writeVendorLocationToRtdb, clearVendorLiveStatusInRtdb } from '../../../../core/notifications/firebaseRtdb.service.js';

// Haversine distance in metres between two lat/lng points.
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6_371_000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Minimum movement (metres) required before we write to DB / RTDB / cache.
const MIN_MOVEMENT_METRES = 10;

export const updateLiveLocationController = async (req, res) => {
    try {
        const { latitude, longitude, locationSource, address } = req.body;

        // ── 1. Input validation ──────────────────────────────────────────────
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return sendError(res, 400, 'Latitude and longitude must be valid numbers');
        }
        if (lat < -90 || lat > 90) {
            return sendError(res, 400, 'Latitude must be between -90 and 90');
        }
        if (lng < -180 || lng > 180) {
            return sendError(res, 400, 'Longitude must be between -180 and 180');
        }

        // ── 2. Load restaurant ───────────────────────────────────────────────
        const Restaurant = mongoose.model('FoodRestaurant');
        const restaurant = await Restaurant.findById(req.user.userId);

        if (!restaurant) {
            return sendError(res, 404, 'Restaurant not found');
        }

        const isStreetFoodVendor = restaurant.businessType === 'Street Food Vendor' || 
                                   (restaurant.restaurantName || '').toLowerCase().includes('street food') ||
                                   (restaurant.name || '').toLowerCase().includes('street food');

        // if (!isStreetFoodVendor) {
        //     return sendError(res, 403, 'Only Street Food Vendors can update live location');
        // }

        // ── 3. Zone validation (server is the single source of truth) ────────
        if (restaurant.zoneId) {
            const zone = await FoodZone.findById(restaurant.zoneId);
            if (zone && zone.coordinates && zone.coordinates.length >= 3) {
                const isInside = isPointInPolygon(lat, lng, zone.coordinates);
                if (!isInside) {
                    return sendError(res, 403, 'You can only operate inside your assigned delivery zone.');
                }
            }
        }

        // ── 4. Movement threshold — skip if vendor hasn't moved enough ────────
        const prevLat = restaurant.currentLocation?.latitude;
        const prevLng = restaurant.currentLocation?.longitude;

        const hasMissingAddress = address && !restaurant.currentLocation?.formattedAddress;

        if (
            !hasMissingAddress &&
            Number.isFinite(prevLat) &&
            Number.isFinite(prevLng) &&
            haversineDistance(prevLat, prevLng, lat, lng) < MIN_MOVEMENT_METRES
        ) {
            // Return the existing location without touching DB / RTDB / cache.
            return sendResponse(res, 200, 'Location unchanged (within threshold)', {
                currentLocation: restaurant.currentLocation,
                lastLocationUpdate: restaurant.lastLocationUpdate,
                skipped: true,
            });
        }

        // ── 5. Persist to MongoDB ────────────────────────────────────────────
        const src = locationSource === 'manual' ? 'manual' : 'gps';
        const resolvedAddress = address || restaurant.currentLocation?.formattedAddress;

        restaurant.currentLocation = {
            type: 'Point',
            coordinates: [lng, lat],
            latitude: lat,
            longitude: lng,
            formattedAddress: resolvedAddress,
            address: resolvedAddress,
        };
        restaurant.lastLocationUpdate = new Date();
        restaurant.locationSource = src;

        // ── 5b. Sync canonical `location` for street vendors with live tracking ──
        // This ensures admin panel, delivery payloads, user listings, nearby search,
        // and all other consumers see the same live coordinates without needing to
        // check `currentLocation` separately. Fixed restaurants are unaffected.
        if (restaurant.liveTrackingEnabled) {
            restaurant.location = {
                type: 'Point',
                coordinates: [lng, lat],
                latitude: lat,
                longitude: lng,
                formattedAddress: resolvedAddress,
                address: resolvedAddress,
                // Preserve existing structured address fields if no new address provided
                ...(restaurant.location?.city ? { city: restaurant.location.city } : {}),
                ...(restaurant.location?.state ? { state: restaurant.location.state } : {}),
                ...(restaurant.location?.pincode ? { pincode: restaurant.location.pincode } : {}),
                ...(restaurant.location?.area ? { area: restaurant.location.area } : {}),
            };
        }

        await restaurant.save();

        logger.info(
            `[VendorLocation] restaurantId=${req.user.userId} lat=${lat} lng=${lng} source=${src}`
        );

        // ── 6. Push to Firebase RTDB (fire-and-forget) ───────────────────────
        // This keeps Firebase in sync with MongoDB so customer-side real-time
        // subscriptions see the latest position immediately.
        void writeVendorLocationToRtdb(String(req.user.userId), { lat, lng, locationSource: src, address });

        return sendResponse(res, 200, 'Location updated successfully', {
            currentLocation: restaurant.currentLocation,
            lastLocationUpdate: restaurant.lastLocationUpdate,
        });

    } catch (error) {
        logger.error(`[VendorLocation] updateLiveLocationController error: ${error.message}`);
        return sendError(res, 500, 'Failed to update live location');
    }
};

export const toggleLiveTrackingController = async (req, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return sendError(res, 400, 'enabled flag is required and must be a boolean');
        }

        const Restaurant = mongoose.model('FoodRestaurant');
        const restaurant = await Restaurant.findById(req.user.userId);

        if (!restaurant) {
            return sendError(res, 404, 'Restaurant not found');
        }

        const isStreetFoodVendor = restaurant.businessType === 'Street Food Vendor' || 
                                   (restaurant.restaurantName || '').toLowerCase().includes('street food') ||
                                   (restaurant.name || '').toLowerCase().includes('street food');

        // if (!isStreetFoodVendor) {
        //     return sendError(res, 403, 'Only Street Food Vendors can toggle live tracking');
        // }

        restaurant.liveTrackingEnabled = enabled;

        // Sync canonical `location` immediately when live tracking is turned ON
        if (enabled && restaurant.currentLocation?.latitude && restaurant.currentLocation?.longitude) {
            restaurant.location = {
                type: 'Point',
                coordinates: [restaurant.currentLocation.longitude, restaurant.currentLocation.latitude],
                latitude: restaurant.currentLocation.latitude,
                longitude: restaurant.currentLocation.longitude,
                formattedAddress: restaurant.currentLocation.formattedAddress || restaurant.currentLocation.address || '',
                address: restaurant.currentLocation.address || restaurant.currentLocation.formattedAddress || '',
                ...(restaurant.location?.city ? { city: restaurant.location.city } : {}),
                ...(restaurant.location?.state ? { state: restaurant.location.state } : {}),
                ...(restaurant.location?.pincode ? { pincode: restaurant.location.pincode } : {}),
                ...(restaurant.location?.area ? { area: restaurant.location.area } : {}),
            };
        }

        await restaurant.save();

        // When tracking is disabled, update RTDB isLive flag without wiping coordinates.
        if (!enabled) {
            const lastLat = restaurant.currentLocation?.latitude;
            const lastLng = restaurant.currentLocation?.longitude;
            void clearVendorLiveStatusInRtdb(String(req.user.userId), { lat: lastLat, lng: lastLng });
        }

        logger.info(
            `[VendorLocation] toggleLiveTracking restaurantId=${req.user.userId} enabled=${enabled}`
        );

        return sendResponse(res, 200, `Live tracking ${enabled ? 'enabled' : 'disabled'} successfully`, {
            liveTrackingEnabled: restaurant.liveTrackingEnabled,
        });

    } catch (error) {
        logger.error(`[VendorLocation] toggleLiveTrackingController error: ${error.message}`);
        return sendError(res, 500, 'Failed to toggle live tracking');
    }
};

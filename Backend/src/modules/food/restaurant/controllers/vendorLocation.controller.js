import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { isPointInPolygon } from '../../../../utils/geo.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { logger } from '../../../../utils/logger.js';
import { getFirebaseDB } from '../../../../config/firebase.js';

/** Skip persisting a "new" position that hasn't actually moved meaningfully. */
const MIN_MOVEMENT_METRES = 10;

const haversineDistanceMetres = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Fire-and-forget mirror into Firebase RTDB; never throws, no-op if Firebase isn't configured. */
const writeVendorLocationToRtdb = (restaurantId, { lat, lng, locationSource, isLive }) => {
  try {
    const db = getFirebaseDB();
    if (!db) return;
    db.ref(`restaurant/${restaurantId}/location`)
      .update({
        lat,
        lng,
        isLive: isLive !== false,
        locationSource: locationSource || 'gps',
        last_updated: Date.now(),
      })
      .catch((err) => logger.error(`Firebase vendor location update error: ${err.message}`));
  } catch (err) {
    logger.debug(`Firebase RTDB sync skipped: ${err.message}`);
  }
};

/**
 * PUT /food/restaurant/live-location
 * Street Food Vendor pushes their current GPS/manual position.
 * Mirrors into the geo-indexed `location` field (only while broadcasting) so the
 * existing $geoNear customer-listing queries automatically reflect the live position —
 * `currentLocation` itself is not geo-indexed.
 */
export const updateLiveLocationController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const { latitude, longitude, address, locationSource } = req.body || {};

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return sendError(res, 400, 'A valid latitude is required');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return sendError(res, 400, 'A valid longitude is required');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId);
    if (!restaurant) {
      return sendError(res, 404, 'Restaurant not found');
    }

    // Zone containment is authoritative here — the server, not the client map UI, decides.
    if (restaurant.zoneId) {
      const zone = await FoodZone.findById(restaurant.zoneId).select('coordinates').lean();
      if (zone?.coordinates?.length >= 3 && !isPointInPolygon(lat, lng, zone.coordinates)) {
        return sendError(res, 403, 'You can only operate inside your assigned delivery zone.');
      }
    }

    const src = locationSource === 'manual' ? 'manual' : 'gps';

    // Movement threshold — skip near-identical GPS noise to avoid write-amplification.
    const prev = restaurant.currentLocation;
    if (prev?.latitude != null && prev?.longitude != null) {
      const movedMetres = haversineDistanceMetres(prev.latitude, prev.longitude, lat, lng);
      if (movedMetres < MIN_MOVEMENT_METRES && src === 'gps') {
        return sendResponse(res, 200, 'Location unchanged', { skipped: true });
      }
    }

    restaurant.currentLocation = {
      type: 'Point',
      coordinates: [lng, lat],
      latitude: lat,
      longitude: lng,
      formattedAddress: address || '',
      address: address || '',
    };
    restaurant.lastLocationUpdate = new Date();
    restaurant.locationSource = src;

    // Mirror into the geo-indexed `location` field only while actively broadcasting —
    // this is what makes the vendor show up at its live position in customer listings.
    if (restaurant.liveTrackingEnabled) {
      restaurant.location = {
        type: 'Point',
        coordinates: [lng, lat],
        latitude: lat,
        longitude: lng,
        formattedAddress: address || restaurant.location?.formattedAddress || '',
        address: address || restaurant.location?.address || '',
        addressLine1: restaurant.location?.addressLine1 || '',
        area: restaurant.location?.area || '',
        city: restaurant.location?.city || '',
        state: restaurant.location?.state || '',
        pincode: restaurant.location?.pincode || '',
      };
    }

    await restaurant.save();

    writeVendorLocationToRtdb(String(restaurantId), {
      lat,
      lng,
      locationSource: src,
      isLive: restaurant.liveTrackingEnabled,
    });

    return sendResponse(res, 200, 'Location updated successfully', {
      currentLocation: restaurant.currentLocation,
      liveTrackingEnabled: restaurant.liveTrackingEnabled,
      lastLocationUpdate: restaurant.lastLocationUpdate,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /food/restaurant/live-tracking-status
 * Turns live-location broadcasting on/off for a Street Food Vendor.
 */
export const toggleLiveTrackingController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const { enabled } = req.body || {};
    const nextEnabled = Boolean(enabled);

    const restaurant = await FoodRestaurant.findById(restaurantId);
    if (!restaurant) {
      return sendError(res, 404, 'Restaurant not found');
    }

    if (restaurant.businessType !== 'Street Food Vendor') {
      return sendError(res, 403, 'Only Street Food Vendors can use live location tracking');
    }

    restaurant.liveTrackingEnabled = nextEnabled;

    if (nextEnabled && restaurant.currentLocation?.latitude != null) {
      // Turning ON: immediately sync the permanent `location` field to the last known position.
      restaurant.location = {
        ...(restaurant.location?.toObject ? restaurant.location.toObject() : restaurant.location || {}),
        type: 'Point',
        coordinates: restaurant.currentLocation.coordinates,
        latitude: restaurant.currentLocation.latitude,
        longitude: restaurant.currentLocation.longitude,
        formattedAddress: restaurant.currentLocation.formattedAddress || restaurant.location?.formattedAddress || '',
        address: restaurant.currentLocation.address || restaurant.location?.address || '',
      };
    }

    await restaurant.save();

    if (!nextEnabled) {
      try {
        const db = getFirebaseDB();
        if (db) {
          db.ref(`restaurant/${restaurantId}/location`)
            .update({ isLive: false, last_updated: Date.now() })
            .catch((err) => logger.error(`Firebase vendor location clear error: ${err.message}`));
        }
      } catch (err) {
        logger.debug(`Firebase RTDB clear skipped: ${err.message}`);
      }
    }

    return sendResponse(res, 200, `Live tracking ${nextEnabled ? 'enabled' : 'disabled'}`, {
      liveTrackingEnabled: restaurant.liveTrackingEnabled,
    });
  } catch (err) {
    next(err);
  }
};

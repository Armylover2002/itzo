import axios from 'axios';
import { config } from '../../../config/env.js';
import { getRoadDistanceKm, getRoadDistancesFromOrigin } from '../../../services/roadDistance.service.js';

const MAPS_TIMEOUT_MS = 8000;

const getMapsApiKey = () =>
  config.googleMapsApiKey ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAP_API_KEY ||
  '';

const mapAddressComponents = (components = []) => {
  const get = (type) => {
    const c = components.find((x) => x.types?.includes(type));
    return c ? c.long_name : '';
  };
  const country = get('country');
  const state = get('administrative_area_level_1');
  const city = get('locality') || get('administrative_area_level_2') || get('sublocality');
  const area = get('sublocality') || get('neighborhood') || '';
  const pincode = get('postal_code');
  return { country, state, city, area, pincode };
};

const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const getDistance = async (req, res) => {
  try {
    const originLat = toFinite(req.query.originLat ?? req.query.lat1);
    const originLng = toFinite(req.query.originLng ?? req.query.lng1);
    const destLat = toFinite(req.query.destLat ?? req.query.lat2);
    const destLng = toFinite(req.query.destLng ?? req.query.lng2);

    if ([originLat, originLng, destLat, destLng].some((v) => v === null)) {
      return res.status(400).json({
        success: false,
        message: 'originLat, originLng, destLat, and destLng are required',
      });
    }

    const result = await getRoadDistanceKm(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
    );

    return res.json({
      success: true,
      data: {
        distanceKm: result.distanceKm,
        distanceMeters: result.distanceMeters,
        durationMin: result.durationMin,
        estimated: Boolean(result.estimated),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to calculate distance',
    });
  }
};

export const reverseGeocode = async (req, res) => {
  try {
    const lat = toFinite(req.query.lat ?? req.query.latitude);
    const lng = toFinite(req.query.lng ?? req.query.longitude);

    if (lat === null || lng === null) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng are required',
      });
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: 'Maps API key not configured on server',
      });
    }

    const { data } = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`,
      { timeout: MAPS_TIMEOUT_MS },
    );

    if (data.status === 'ZERO_RESULTS') {
      return res.status(404).json({
        success: false,
        message: 'Address not found for coordinates',
      });
    }

    if (data.status !== 'OK' || !data.results?.[0]) {
      return res.status(502).json({
        success: false,
        message: data.error_message || `Maps API error: ${data.status || 'UNKNOWN'}`,
      });
    }

    const first = data.results[0];
    const components = mapAddressComponents(first.address_components || []);

    return res.json({
      success: true,
      data: {
        formattedAddress: first.formatted_address,
        placeId: first.place_id,
        addressComponents: first.address_components || [],
        latitude: lat,
        longitude: lng,
        ...components,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to reverse geocode coordinates',
    });
  }
};

export const getDistancesBatch = async (req, res) => {
  try {
    // Checkout-aligned mode: many restaurant origins → one user destination
    const toDestLat = toFinite(req.body?.destination?.lat ?? req.body?.destLat);
    const toDestLng = toFinite(req.body?.destination?.lng ?? req.body?.destLng);
    const origins = Array.isArray(req.body?.origins) ? req.body.origins : null;

    if (origins && toDestLat !== null && toDestLng !== null) {
      const normalizedOrigins = origins.slice(0, 25).map((origin) => ({
        lat: toFinite(origin?.lat),
        lng: toFinite(origin?.lng),
      }));
      if (normalizedOrigins.some((o) => o.lat === null || o.lng === null)) {
        return res.status(400).json({
          success: false,
          message: 'Each origin must include valid lat and lng',
        });
      }

      const { getRoadDistancesToDestination } = await import('../../../services/roadDistance.service.js');
      const results = await getRoadDistancesToDestination(
        normalizedOrigins,
        { lat: toDestLat, lng: toDestLng },
      );
      return res.json({
        success: true,
        data: {
          distances: results.map((item) => ({
            distanceKm: item.distanceKm,
            distanceMeters: item.distanceMeters,
            durationMin: item.durationMin,
            estimated: Boolean(item.estimated),
          })),
        },
      });
    }

    const originLat = toFinite(req.body?.originLat ?? req.body?.origin?.lat);
    const originLng = toFinite(req.body?.originLng ?? req.body?.origin?.lng);
    const destinations = Array.isArray(req.body?.destinations) ? req.body.destinations : [];

    if (originLat === null || originLng === null) {
      return res.status(400).json({
        success: false,
        message: 'originLat and originLng are required',
      });
    }

    if (!destinations.length) {
      return res.json({ success: true, data: { distances: [] } });
    }

    const normalized = destinations.slice(0, 25).map((dest) => ({
      lat: toFinite(dest?.lat),
      lng: toFinite(dest?.lng),
    }));

    if (normalized.some((dest) => dest.lat === null || dest.lng === null)) {
      return res.status(400).json({
        success: false,
        message: 'Each destination must include valid lat and lng',
      });
    }

    const results = await getRoadDistancesFromOrigin(
      { lat: originLat, lng: originLng },
      normalized,
    );

    return res.json({
      success: true,
      data: {
        distances: results.map((item) => ({
          distanceKm: item.distanceKm,
          distanceMeters: item.distanceMeters,
          durationMin: item.durationMin,
          estimated: Boolean(item.estimated),
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to calculate distances',
    });
  }
};

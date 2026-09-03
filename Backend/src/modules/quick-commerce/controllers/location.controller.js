import axios from 'axios';
import { ApiError } from '../../../utils/ApiError.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

// In-memory cache for reverse geocoding results (1 hour TTL)
const reverseGeocodeCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Map Google Maps address components to a clean, flat, organized structure
 */
const mapAddressComponents = (components = [], rawFormattedAddress = '') => {
  const get = (type) => {
    const c = components.find((x) => x.types?.includes(type));
    return c ? c.long_name : '';
  };

  const premise = get('premise') || get('subpremise') || get('point_of_interest') || '';
  const streetNumber = get('street_number') || '';
  const route = get('route') || '';
  const neighborhood = get('neighborhood') || '';
  const sublocality = get('sublocality_level_1') || get('sublocality') || '';
  const area = sublocality || neighborhood || '';
  const city = get('locality') || get('administrative_area_level_2') || get('administrative_area_level_3') || '';
  const state = get('administrative_area_level_1') || '';
  const country = get('country') || '';
  const pincode = get('postal_code') || '';

  // Build a concise short address for headers (e.g. "Corporate House, Chhoti Gwaltoli")
  let shortAddress = '';
  if (premise && area && premise !== area) {
    shortAddress = `${premise}, ${area}`;
  } else if (premise && city) {
    shortAddress = `${premise}, ${city}`;
  } else if (area && city) {
    shortAddress = `${area}, ${city}`;
  } else if (rawFormattedAddress) {
    shortAddress = rawFormattedAddress.split(',').slice(0, 2).join(',').trim();
  }

  return {
    formattedAddress: rawFormattedAddress,
    shortAddress: shortAddress || area || city || rawFormattedAddress,
    premise,
    streetNumber,
    route,
    area,
    neighborhood,
    city,
    state,
    pincode,
    postalCode: pincode,
    country,
  };
};

/**
 * Fallback reverse geocoding via OpenStreetMap (Nominatim)
 */
const fallbackNominatimReverse = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'ItzoDeliveryApp/1.0' },
      timeout: 5000,
    });

    if (!data || !data.address) return null;

    const addr = data.address;
    const premise = addr.building || addr.amenity || addr.shop || '';
    const area = addr.suburb || addr.neighbourhood || addr.residential || '';
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    const pincode = addr.postcode || '';
    const country = addr.country || '';
    const formatted = data.display_name || '';

    const shortAddress = [premise || area, city].filter(Boolean).join(', ') || formatted.split(',').slice(0, 2).join(', ').trim();

    return {
      formattedAddress: formatted,
      shortAddress: shortAddress || formatted,
      premise,
      area,
      city,
      state,
      pincode,
      postalCode: pincode,
      country,
      latitude: Number(lat),
      longitude: Number(lng),
      placeId: data.place_id ? String(data.place_id) : '',
    };
  } catch (err) {
    console.warn('[ReverseGeocode] Nominatim fallback failed:', err.message);
    return null;
  }
};

/**
 * @desc    Geocode an address string to coordinates
 * @route   GET /api/v1/quick-commerce/location/geocode
 * @access  Public
 */
export const geocodeAddress = asyncHandler(async (req, res) => {
  const { address } = req.query;

  if (!address || !String(address).trim()) {
    throw new ApiError(400, 'Address query parameter is required');
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY;
  if (!key) {
    throw new ApiError(500, 'Maps API key not configured on server');
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${key}`;
    
    const { data } = await axios.get(url, { timeout: 6000 });

    if (data.status === 'ZERO_RESULTS') {
      return res.status(404).json({
        success: false,
        message: 'No location found for the provided address',
      });
    }

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data.status, data.error_message);
      throw new ApiError(500, `Maps API error: ${data.status}`);
    }

    const first = data.results[0];
    const { lat, lng } = first.geometry.location;
    const components = mapAddressComponents(first.address_components || [], first.formatted_address);

    res.status(200).json({
      success: true,
      data: {
        ...components,
        latitude: lat,
        longitude: lng,
        placeId: first.place_id,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Geocoding error:', error.message);
    throw new ApiError(500, 'Failed to geocode address');
  }
});

/**
 * @desc    Reverse geocode coordinates to a clean, optimized address
 * @route   GET /api/v1/quick-commerce/location/reverse-geocode
 * @access  Public
 */
export const reverseGeocode = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    throw new ApiError(400, 'Valid lat and lng query parameters are required');
  }

  // Check 1-hour in-memory cache for nearby coordinates (~10 meters precision)
  const cacheKey = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({
      success: true,
      data: cached.data,
    });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY;

  if (key) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${key}&language=en`;
      const { data } = await axios.get(url, { timeout: 6000 });

      if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        const first = data.results[0];
        const components = mapAddressComponents(first.address_components || [], first.formatted_address);

        const resultData = {
          ...components,
          latitude: latNum,
          longitude: lngNum,
          placeId: first.place_id || '',
        };

        // Save in cache
        reverseGeocodeCache.set(cacheKey, { data: resultData, timestamp: Date.now() });

        return res.status(200).json({
          success: true,
          data: resultData,
        });
      }
    } catch (err) {
      console.warn('[ReverseGeocode] Google Maps API request failed, trying fallback:', err.message);
    }
  }

  // Fallback to OpenStreetMap Nominatim
  const fallbackData = await fallbackNominatimReverse(latNum, lngNum);
  if (fallbackData) {
    reverseGeocodeCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
    return res.status(200).json({
      success: true,
      data: fallbackData,
    });
  }

  // Ultimate safe fallback with coordinates
  const safeData = {
    formattedAddress: `Location (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`,
    shortAddress: `Location (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`,
    area: '',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '',
    postalCode: '',
    country: 'India',
    latitude: latNum,
    longitude: lngNum,
    placeId: '',
  };

  res.status(200).json({
    success: true,
    data: safeData,
  });
});


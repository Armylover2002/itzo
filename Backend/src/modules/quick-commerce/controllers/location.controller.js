import axios from 'axios';
import { ApiError } from '../../../utils/ApiError.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

/**
 * Map Google Maps address components to a flatter structure
 */
const mapAddressComponents = (components) => {
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
    console.error('GOOGLE_MAPS_API_KEY is missing in environment variables');
    throw new ApiError(500, 'Maps API key not configured on server');
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${key}`;
    
    const { data } = await axios.get(url);

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
    const components = mapAddressComponents(first.address_components || []);

    res.status(200).json({
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        formattedAddress: first.formatted_address,
        ...components,
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
 * @desc    Reverse geocode coordinates to an address
 * @route   GET /api/v1/quick-commerce/location/reverse-geocode
 * @access  Public
 */
export const reverseGeocode = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new ApiError(400, 'lat and lng query parameters are required');
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY;
  if (!key) {
    throw new ApiError(500, 'Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const { data } = await axios.get(url);

  if (data.status === 'ZERO_RESULTS') {
    throw new ApiError(404, 'Address not found');
  }

  if (data.status !== 'OK') {
    throw new ApiError(500, `Maps API error: ${data.status}`);
  }

  const first = data.results[0];
  const components = mapAddressComponents(first.address_components || []);

  res.status(200).json({
    success: true,
    data: {
      formattedAddress: first.formatted_address,
      ...components,
      latitude: Number(lat),
      longitude: Number(lng),
      placeId: first.place_id,
    },
  });
});

/**
 * @desc    Resolve a Google place_id to coordinates
 * @route   GET /api/v1/quick-commerce/location/geocode-place
 * @access  Public
 */
export const geocodePlaceId = asyncHandler(async (req, res) => {
  const placeId = String(req.query.placeId || '').trim();

  if (!placeId) {
    throw new ApiError(400, 'placeId query parameter is required');
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAP_API_KEY;
  if (!key) {
    throw new ApiError(500, 'Maps API key not configured on server');
  }

  try {
    const { data } = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${key}`,
      { timeout: 8000 },
    );

    if (data.status === 'ZERO_RESULTS') {
      return res.status(404).json({
        success: false,
        message: 'Place not found',
      });
    }

    if (data.status !== 'OK') {
      console.error('Google Maps place geocode error:', data.status, data.error_message);
      throw new ApiError(500, `Maps API error: ${data.status}`);
    }

    const first = data.results[0];
    const { lat, lng } = first.geometry.location;
    const components = mapAddressComponents(first.address_components || []);

    res.status(200).json({
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        formattedAddress: first.formatted_address,
        ...components,
        placeId: first.place_id || placeId,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('Place geocoding error:', error.message);
    throw new ApiError(500, 'Failed to geocode place');
  }
});

/**
 * HRMS Geolocation Utilities
 * - Haversine distance calculation
 * - Coordinate validation
 * - Mock location detection
 * - Reverse geocoding (optional, requires Google Maps API key)
 */

import { config } from '../../../config/env.js';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * @returns {number} Distance in meters
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
};

/**
 * Validate latitude and longitude ranges.
 */
export const isValidCoordinate = (latitude, longitude) => {
    return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180 &&
        !isNaN(latitude) && !isNaN(longitude)
    );
};

/**
 * Basic mock location detection heuristic.
 * Suspiciously perfect accuracy (0m) or unreasonably high accuracy on mobile
 * can indicate mock/spoofed GPS.
 */
export const isSuspiciousMockLocation = (accuracy, allowMock = false) => {
    if (allowMock) return false;
    if (typeof accuracy !== 'number') return false;
    // Accuracy of exactly 0 or less than 1m is suspicious
    if (accuracy <= 1) return true;
    return false;
};

/**
 * Reverse geocode coordinates to address using Google Maps Geocoding API.
 * Returns address string or null on failure (graceful fallback).
 */
export const reverseGeocode = async (latitude, longitude) => {
    const apiKey = config.googleMapsApiKey;
    if (!apiKey) return null;

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results?.length > 0) {
            return data.results[0].formatted_address;
        }
        return null;
    } catch (error) {
        console.error('Reverse geocode failed (non-blocking):', error.message);
        return null;
    }
};

/**
 * Calculate total distance from an array of GPS points.
 * @param {Array} points - Array of { latitude, longitude }
 * @returns {number} Total distance in meters
 */
export const calculateRouteDistance = (points) => {
    if (!points || points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistance(
            points[i - 1].latitude, points[i - 1].longitude,
            points[i].latitude, points[i].longitude
        );
    }
    return Math.round(total);
};

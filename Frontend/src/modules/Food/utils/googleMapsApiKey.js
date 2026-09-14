/**
 * Google Maps API Key Utility
 * Uses build-time env only (no backend calls).
 */

let cachedApiKey = null;

function sanitizeApiKey(value) {
  if (!value) return "";
  return String(value).trim().replace(/^['"]|['"]$/g, "");
}

/**
 * Get Google Maps API Key from frontend env.
 * Uses caching to avoid repeated sanitization.
 * @returns {Promise<string>} Google Maps API Key
 */
export async function getGoogleMapsApiKey() {
  // Return cached key if available
  if (cachedApiKey) {
    return cachedApiKey;
  }

  cachedApiKey = sanitizeApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  return cachedApiKey;
}

/**
 * Clear cached API key (call after updating in admin panel)
 */
export function clearGoogleMapsApiKeyCache() {
  cachedApiKey = null;
}


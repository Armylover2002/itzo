/**
 * Common utility functions for the Food module
 */

/**
 * Normalizes an image URL to handle relative paths and backend origins
 */
export const normalizeImageUrl = (imageUrl, backendOrigin = "") => {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl.trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;

  const appProtocol = typeof window !== "undefined" ? window.location?.protocol : "";
  const appHost = typeof window !== "undefined" ? window.location?.hostname : "";

  let normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^(https?):\/(?!\/)/i, "$1://")
    .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  if (/^\/\//.test(normalized)) normalized = `${appProtocol || "https:"}${normalized}`;

  if (/^(https?:)?\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized, window.location.origin);
      if (appHost && !/^(localhost|127\.0\.0\.1)$/i.test(appHost) && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) {
        const backendUrl = new URL(backendOrigin || window.location.origin);
        parsed.protocol = backendUrl.protocol;
        parsed.hostname = backendUrl.hostname;
        parsed.port = backendUrl.port;
      }
      if (appProtocol === "https:" && parsed.protocol === "http:") parsed.protocol = "https:";
      const finalUrl = parsed.toString();
      const hasSigned = /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(finalUrl);
      return hasSigned ? finalUrl : encodeURI(finalUrl);
    } catch {
      return normalized;
    }
  }

  const absolutePath = normalized.startsWith("/")
    ? `${backendOrigin}${normalized}`
    : `${backendOrigin}/${normalized.replace(/^\.?\/*/, "")}`;
  return absolutePath;
};

/**
 * Extracts a list of image URLs from a source (string, array of strings, or object with image properties)
 */
export const extractImages = (source, backendOrigin = "") => {
  if (!source) return [];
  const normalize = (val) => {
    if (!val) return "";
    if (typeof val === "string") return normalizeImageUrl(val, backendOrigin);
    if (typeof val === "object") {
      const src = val.url || val.secure_url || val.imageUrl || val.image || val.src || "";
      return typeof src === "string" ? normalizeImageUrl(src, backendOrigin) : "";
    }
    return "";
  };

  const candidates = Array.isArray(source) ? source.map(normalize) : [normalize(source)];
  return candidates.filter(Boolean);
};

/**
 * Calculates straight-line distance between two coordinates in kilometers (Haversine).
 * Prefer getRoadDistanceKm from @/shared/services/roadDistance for delivery/restaurant distances.
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Formats distance for display
 */
export const formatDistance = (distanceInKm) => {
  if (distanceInKm === null || distanceInKm === undefined) return "1.2 km";
  if (distanceInKm >= 1) {
    return `${distanceInKm.toFixed(1)} km`;
  } else {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
};

/**
 * Slugifies a string for use in URLs or as identifiers
 */
export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

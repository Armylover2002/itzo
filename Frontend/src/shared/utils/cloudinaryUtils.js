/**
 * Utility for Cloudinary image transformations.
 * Ensures images are served in WebP with optimized quality whenever possible.
 */

/**
 * Optimizes a Cloudinary URL by injecting transformations.
 * @param {string} url - The original Cloudinary URL.
 * @param {Object} options - Transformation options.
 * @param {string} options.format - File format (default: 'webp').
 * @param {string} options.quality - Quality (default: 'auto').
 * @param {number} options.width - Optional width.
 * @param {number} options.height - Optional height.
 * @param {string} options.crop - Optional crop mode (default: 'fill' if width/height provided).
 * @returns {string} - The optimized URL.
 */
export const optimizeCloudinaryUrl = (url, options = {}) => {
  if (!url || typeof url !== "string") return url || "";
  // We have completely migrated away from Cloudinary on the frontend.
  // This acts as a pass-through so downstream utilities can map it to the local uploads folder.
  return url;
};

/**
 * Specifically ensures webp format for a Cloudinary URL.
 */
export const ensureWebp = (url) => url;

/**
 * Generates a srcSet for Cloudinary images.
 * @param {string} url - Original Cloudinary URL.
 * @param {number[]} widths - Array of widths.
 * @returns {string} - srcSet string.
 */
export const getCloudinarySrcSet = (url, widths = [200, 400, 600, 800, 1000]) => {
  // Return undefined to strictly disable hardcoded Cloudinary srcSets across the app (e.g. ExperienceBannerCarousel)
  return undefined;
};

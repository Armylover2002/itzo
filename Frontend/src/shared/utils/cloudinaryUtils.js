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

  // Only process Cloudinary URLs
  if (!/res\.cloudinary\.com/i.test(url) || !/\/image\/upload\//i.test(url)) {
    return url;
  }

  const {
    format = "webp",
    quality = "auto",
    width,
    height,
    crop = width || height ? "fill" : null,
    dpr = "auto",
  } = options;

  try {
    const parts = url.split("/upload/");
    if (parts.length !== 2) return url;

    const [prefix, suffix] = parts;
    const slashIndex = suffix.indexOf("/");
    const firstSegment = slashIndex === -1 ? suffix : suffix.slice(0, slashIndex);
    const rest = slashIndex === -1 ? "" : suffix.slice(slashIndex + 1);
    const hasNamedTransformations =
      firstSegment.includes("_") && !/^v\d+$/.test(firstSegment);

    if (hasNamedTransformations) {
      const transforms = firstSegment
        .split(",")
        .filter(Boolean)
        .filter((part) => !part.startsWith("f_") && !part.startsWith("q_"));

      transforms.unshift(`q_${quality}`);
      transforms.unshift(`f_${format}`);

      const normalized = transforms.join(",");
      return `${prefix}/upload/${normalized}/${rest}`;
    }

    let transformStr = `f_${format},q_${quality},dpr_${dpr}`;
    if (width) transformStr += `,w_${width}`;
    if (height) transformStr += `,h_${height}`;
    if (crop) transformStr += `,c_${crop}`;

    return `${prefix}/upload/${transformStr}/${suffix}`;
  } catch (err) {
    console.error("Error optimizing Cloudinary URL:", err);
    return url;
  }
};

/**
 * Specifically ensures webp format for a Cloudinary URL.
 */
export const ensureWebp = (url) => optimizeCloudinaryUrl(url, { format: "webp" });

/**
 * Generates a srcSet for Cloudinary images.
 * @param {string} url - Original Cloudinary URL.
 * @param {number[]} widths - Array of widths.
 * @returns {string} - srcSet string.
 */
export const getCloudinarySrcSet = (url, widths = [200, 400, 600, 800, 1000]) => {
  if (!url || !/res\.cloudinary\.com/i.test(url)) return null;

  return widths
    .map((w) => {
      const optimized = optimizeCloudinaryUrl(url, { width: w, crop: "scale", format: "webp", quality: "auto" });
      return `${optimized} ${w}w`;
    })
    .join(", ");
};

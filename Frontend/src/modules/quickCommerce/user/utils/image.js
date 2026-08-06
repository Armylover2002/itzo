import { optimizeCloudinaryUrl } from "@/shared/utils/cloudinaryUtils";

const API_BASE_URL = ((import.meta.env && import.meta.env.VITE_API_BASE_URL) || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");
const ACTIVE_CLOUDINARY_CLOUD_NAME = "dm6dbsbfx";
const FALLBACK_LOGO = "/itzo-quick-logo.png";

export const resolveQuickImageUrl = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return null;

  const normalized = raw.replace(/\\/g, "/");
  let resolvedUrl = normalized;

  if (normalized.includes("/image/upload/")) {
    const uploadsIndex = normalized.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      resolvedUrl = `${API_BASE_URL}${normalized.slice(uploadsIndex)}`;
    } else {
      const parts = normalized.split("/image/upload/");
      if (parts.length === 2) {
        const extracted = "/" + parts[1].replace(/^(?:[a-z_0-9,]+\/)*(?:v\d+\/)?/i, "");
        resolvedUrl = extracted.startsWith("/uploads/") ? `${API_BASE_URL}${extracted}` : `${API_BASE_URL}/uploads${extracted}`;
      }
    }
  } else if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    resolvedUrl = normalized;
  } else if (normalized.startsWith("//")) {
    resolvedUrl = `https:${normalized}`;
  } else if (normalized.startsWith("/uploads/")) {
    resolvedUrl = `${API_BASE_URL}${normalized}`;
  } else {
    // Return relative paths like /itzo-quick-logo.png untouched
    resolvedUrl = normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  // We are no longer optimizing via Cloudinary, return the mapped url directly
  return resolvedUrl;
};

/**
 * Returns an array of fallback URLs: [LocalUpload, Cloudinary, FallbackLogo]
 */
export const resolveImageFallbacks = (value) => {
  if (!value) return [FALLBACK_LOGO];

  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return [FALLBACK_LOGO];

  const normalized = raw.replace(/\\/g, "/");
  
  let relativePath = normalized;
  
  // Extract path if it's already a Cloudinary URL (e.g. from an old cloud name or optimized URL)
  if (normalized.includes("/image/upload/")) {
    const uploadsIndex = normalized.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      relativePath = normalized.slice(uploadsIndex); // guarantees extraction of /uploads/...
    } else {
      const parts = normalized.split("/image/upload/");
      if (parts.length === 2) {
        // Strip out transformation parameters (e.g. f_webp,q_80/) and version tags (e.g. v1234/)
        relativePath = "/" + parts[1].replace(/^(?:[a-z_0-9,]+\/)*(?:v\d+\/)?/i, "");
      }
    }
  }
  
  // Extract path if it's a local server URL
  if (normalized.startsWith(API_BASE_URL)) {
    relativePath = normalized.replace(API_BASE_URL, "");
  }

  // Ensure leading slash
  if (!relativePath.startsWith("http") && !relativePath.startsWith("/") && !relativePath.startsWith("data:") && !relativePath.startsWith("blob:")) {
    relativePath = "/" + relativePath;
  }

  const fallbacks = [];

  // Priority 1: Local Upload Folder (if it's an upload path or can be mapped to one)
  if (relativePath.startsWith("/uploads/")) {
    fallbacks.push(`${API_BASE_URL}${relativePath}`);
  }
  
  // Priority 2: The Original URL (if it was an external URL or old cloudinary link, try it as a last resort before logo)
  if (normalized.startsWith("http") && !fallbacks.includes(normalized)) {
    fallbacks.push(normalized);
  }

  // Priority 3: Fallback Logo
  fallbacks.push(FALLBACK_LOGO);

  // Remove duplicates just in case
  return [...new Set(fallbacks)];
};

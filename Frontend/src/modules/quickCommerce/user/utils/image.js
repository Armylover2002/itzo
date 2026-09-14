import { optimizeCloudinaryUrl } from "@/shared/utils/cloudinaryUtils";

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/api\/v1\/?$/, "");

export const resolveQuickImageUrl = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return null;

  const normalized = raw.replace(/\\/g, "/");
  let resolvedUrl = normalized;

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    resolvedUrl = normalized;
  } else if (normalized.startsWith("//")) {
    resolvedUrl = `https:${normalized}`;
  } else {
    const path = normalized.startsWith("/") ? normalized : `/${normalized}`;
    resolvedUrl = `${API_BASE_URL}${path}`;
  }

  // Optimize Cloudinary URLs to use webp/f_auto
  return optimizeCloudinaryUrl(resolvedUrl);
};

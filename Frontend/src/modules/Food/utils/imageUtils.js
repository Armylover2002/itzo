import { optimizeCloudinaryUrl } from "../../../shared/utils/cloudinaryUtils";

export const normalizeImageUrl = (imageUrl, BACKEND_ORIGIN) => {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl.trim();
  if (!trimmed) return "";
  if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }
  
  const appProtocol = typeof window !== "undefined" ? window.location?.protocol : "";
  const appHost = typeof window !== "undefined" ? window.location?.hostname : "";
  
  let normalizedInput = trimmed
    .replace(/\\/g, "/")
    .replace(/^(https?):\/(?!\/)/i, "$1://")
    .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  if (/^\/\//.test(normalizedInput)) {
    normalizedInput = `${appProtocol || "https:"}${normalizedInput}`;
  }

  if (/^(https?:)?\/\//i.test(normalizedInput)) {
    try {
      const parsed = new URL(normalizedInput, window.location.origin);
      if (
        appHost &&
        appHost !== "localhost" &&
        appHost !== "127.0.0.1" &&
        /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
      ) {
        try {
          const backendUrl = new URL(BACKEND_ORIGIN);
          parsed.protocol = backendUrl.protocol;
          parsed.hostname = backendUrl.hostname;
          parsed.port = backendUrl.port;
        } catch {
          parsed.protocol = window.location.protocol;
          parsed.hostname = window.location.hostname;
          if (window.location.port) parsed.port = window.location.port;
        }
      }

      if (appProtocol === "https:" && parsed.protocol === "http:") {
        parsed.protocol = "https:";
      }

      const finalUrl = parsed.toString();
      const hasSignedParams = /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(finalUrl);
      return hasSignedParams ? finalUrl : encodeURI(finalUrl);
    } catch {
      return normalizedInput;
    }
  }

  const absolutePath = normalizedInput.startsWith("/")
    ? `${BACKEND_ORIGIN}${normalizedInput}`
    : `${BACKEND_ORIGIN}/${normalizedInput.replace(/^\.?\/*/, "")}`;

  try {
    const parsed = new URL(absolutePath, window.location.origin);
    if (appProtocol === "https:" && parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    const finalUrl = parsed.toString();
    return optimizeCloudinaryUrl(finalUrl);
  } catch {
    return absolutePath;
  }
};

export const extractImageFromValue = (value, BACKEND_ORIGIN) => {
  if (!value) return "";
  if (typeof value === "string") {
    return normalizeImageUrl(value, BACKEND_ORIGIN);
  }
  if (typeof value === "object") {
    const candidate = value.url || value.secure_url || value.imageUrl || value.imageURL || value.image || value.src || value.path || value.location || value.link || value.href || "";
    return typeof candidate === "string" ? normalizeImageUrl(candidate, BACKEND_ORIGIN) : "";
  }
  return "";
};

export const buildRestaurantImageCandidates = (value, BACKEND_ORIGIN) => {
  const normalized = extractImageFromValue(value, BACKEND_ORIGIN);
  if (!normalized) return [];

  if (/res\.cloudinary\.com/i.test(normalized) && /\/image\/upload\//i.test(normalized)) {
    const hasTransform = /\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(normalized);
    if (!hasTransform) {
      return Array.from(
        new Set([
          normalized.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_1080/"),
          normalized.replace("/image/upload/", "/image/upload/f_jpg,q_auto,w_1080/"),
          normalized,
        ])
      );
    }
  }
  return [normalized];
};

export const extractImages = (source, BACKEND_ORIGIN) => {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source.flatMap((entry) => buildRestaurantImageCandidates(entry, BACKEND_ORIGIN)).filter(Boolean);
  }
  return buildRestaurantImageCandidates(source, BACKEND_ORIGIN);
};

export const slugifyCategory = (value) => 
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const formatSavedAddress = (address) => {
  if (!address) return "Select Location";

  if (
    address.formattedAddress &&
    address.formattedAddress !== "Select location" &&
    !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(String(address.formattedAddress).trim())
  ) {
    return address.formattedAddress;
  }

  const parts = [];
  if (address.additionalDetails) parts.push(address.additionalDetails);
  if (address.street) parts.push(address.street);
  if (address.area) parts.push(address.area);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.zipCode || address.postalCode)
    parts.push(address.zipCode || address.postalCode);

  if (parts.length > 0) return parts.join(", ");
  if (address.address && address.address !== "Select location")
    return address.address;

  return "Select Location";
};

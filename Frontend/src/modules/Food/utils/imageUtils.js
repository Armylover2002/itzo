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

  // A real Cloudinary (or any other CDN) URL is already directly loadable —
  // this must be checked BEFORE the "/image/upload/" fragment rewrite below,
  // since a genuine Cloudinary URL also contains that substring and would
  // otherwise get mangled into a broken local /uploads/ path.
  const isAlreadyFullUrl = /^(https?:)?\/\//i.test(normalizedInput);

  // Intercept bare "/image/upload/..." fragments (no host) and map them to the
  // local uploads folder — a legacy shorthand, not a genuine remote URL.
  if (!isAlreadyFullUrl && normalizedInput.includes("/image/upload/")) {
    const uploadsIndex = normalizedInput.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      normalizedInput = `${BACKEND_ORIGIN}${normalizedInput.slice(uploadsIndex)}`;
    } else {
      const parts = normalizedInput.split("/image/upload/");
      if (parts.length === 2) {
        const extracted = "/" + parts[1].replace(/^(?:[a-z_0-9,]+\/)*(?:v\d+\/)?/i, "");
        normalizedInput = extracted.startsWith("/uploads/") ? `${BACKEND_ORIGIN}${extracted}` : `${BACKEND_ORIGIN}/uploads${extracted}`;
      }
    }
  }

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
    return finalUrl;
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

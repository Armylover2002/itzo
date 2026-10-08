/**
 * Uploaded files (images, videos, PDFs) live on our own server under /uploads/...
 * and the backend stores them as relative paths ("/uploads/<file>"). This module is
 * the single place that turns those into absolute URLs the browser can load, e.g.
 * https://itzofood.com/uploads/1791443092032-843f7e47b3928140.webp
 *
 * Origin used for uploads, in order of preference:
 *   1. VITE_UPLOADS_BASE_URL               (e.g. https://itzofood.com)
 *   2. origin of VITE_API_BASE_URL         (when it is an absolute, non-localhost URL)
 *   3. the page's own origin               (Nginx / Vite proxy serve /uploads there)
 */

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

const stripApiSuffix = (url) =>
  String(url || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api(?:\/v\d+)?$/i, "");

const pageOrigin = () =>
  typeof window !== "undefined" && window.location ? window.location.origin : "";

const resolveUploadsOrigin = () => {
  const env = typeof import.meta !== "undefined" ? import.meta.env || {} : {};

  const explicit = String(env.VITE_UPLOADS_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const apiOrigin = stripApiSuffix(env.VITE_API_BASE_URL);
  if (/^https?:\/\//i.test(apiOrigin)) {
    try {
      const parsed = new URL(apiOrigin);
      const page = typeof window !== "undefined" ? window.location?.hostname : "";
      // A localhost API URL baked into a live build would point the browser at the
      // visitor's own machine; only trust it while the page itself is on localhost.
      if (!LOCAL_HOST_RE.test(parsed.hostname) || LOCAL_HOST_RE.test(page || "")) {
        return parsed.origin;
      }
    } catch {
      // fall through to the page origin
    }
  }

  return pageOrigin();
};

export const UPLOADS_ORIGIN = resolveUploadsOrigin();

const baseDomain = (host) => String(host || "").toLowerCase().split(".").slice(-2).join(".");

/** Hosts whose /uploads/... URLs are ours (old localhost/IP/api-subdomain records included). */
const isOwnHost = (hostname) => {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  if (LOCAL_HOST_RE.test(host) || IPV4_RE.test(host)) return true;

  const known = [UPLOADS_ORIGIN, stripApiSuffix(import.meta.env?.VITE_API_BASE_URL), pageOrigin()];
  return known.some((origin) => {
    try {
      const knownHost = new URL(origin).hostname.toLowerCase();
      return knownHost === host || (!LOCAL_HOST_RE.test(knownHost) && baseDomain(knownHost) === baseDomain(host));
    } catch {
      return false;
    }
  });
};

const RELATIVE_UPLOAD_RE = /^(?:\.\/|\/)?uploads\/[^\s]+$/i;

/**
 * Returns the absolute uploads URL for anything that points at one of our uploaded
 * files ("/uploads/x.webp", "uploads/x.webp", "http://localhost:5000/uploads/x.webp", ...).
 * Every other value (Cloudinary, data:, blob:, other sites, non-strings) is returned unchanged.
 */
export const toUploadUrl = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return value;

  const normalized = trimmed.replace(/\\/g, "/");

  if (RELATIVE_UPLOAD_RE.test(normalized)) {
    return `${UPLOADS_ORIGIN}/${normalized.replace(/^\.?\/*/, "")}`;
  }

  if (/^(https?:)?\/\//i.test(normalized) && /\/uploads\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized, pageOrigin() || "https://localhost");
      if (parsed.pathname.toLowerCase().startsWith("/uploads/") && isOwnHost(parsed.hostname)) {
        return `${UPLOADS_ORIGIN}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return value;
    }
  }

  return value;
};

const isPlainObject = (value) => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Rewrites every uploads path in a parsed API response to its absolute URL (in place). */
export const absolutizeUploadUrls = (data) => {
  if (typeof data === "string") return toUploadUrl(data);
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i += 1) data[i] = absolutizeUploadUrls(data[i]);
    return data;
  }
  if (isPlainObject(data)) {
    for (const key of Object.keys(data)) data[key] = absolutizeUploadUrls(data[key]);
  }
  return data;
};

const ABSOLUTE_PREFIX_RE = new RegExp(
  `${UPLOADS_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/uploads/)`,
  "gi"
);

const relativizeString = (value) =>
  UPLOADS_ORIGIN && value.includes(UPLOADS_ORIGIN) ? value.replace(ABSOLUTE_PREFIX_RE, "") : value;

/**
 * Turns the absolute uploads URLs this module produced back into "/uploads/..." before
 * they are sent to the API, so the database keeps host-independent paths and the backend
 * does not mistake an unchanged image for a new one. Never mutates the caller's data.
 */
export const relativizeUploadUrls = (data) => {
  if (typeof data === "string") return relativizeString(data);

  if (Array.isArray(data)) {
    let changed = false;
    const next = data.map((item) => {
      const mapped = relativizeUploadUrls(item);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : data;
  }

  if (isPlainObject(data)) {
    let changed = false;
    const next = {};
    for (const key of Object.keys(data)) {
      next[key] = relativizeUploadUrls(data[key]);
      if (next[key] !== data[key]) changed = true;
    }
    return changed ? next : data;
  }

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    let changed = false;
    const entries = [];
    for (const [key, value] of data.entries()) {
      const mapped = typeof value === "string" ? relativizeString(value) : value;
      if (mapped !== value) changed = true;
      entries.push([key, mapped]);
    }
    if (!changed) return data;
    const next = new FormData();
    for (const [key, value] of entries) {
      if (typeof value === "string") next.append(key, value);
      else next.append(key, value, value.name);
    }
    return next;
  }

  return data;
};

/** Axios interceptors: absolute URLs going into the UI, relative paths going to the API. */
export const installUploadUrlInterceptors = (client) => {
  client.interceptors.request.use((config) => {
    if (config.data !== undefined) config.data = relativizeUploadUrls(config.data);
    if (config.params !== undefined) config.params = relativizeUploadUrls(config.params);
    return config;
  });
  client.interceptors.response.use((response) => {
    if (response && response.data !== undefined) response.data = absolutizeUploadUrls(response.data);
    return response;
  });
  return client;
};

/**
 * Central API client for backend (auth and future APIs).
 * - baseURL from VITE_API_BASE_URL (e.g. http://localhost:5000/api/v1)
 * - When baseURL ends with /api/v1, request paths must NOT include /v1 (use /food/..., /auth/...)
 * - Attaches Bearer token (user or admin based on request URL)
 * - On 401: attempts refresh, retries once; on refresh failure logs out
 */

import axios from "axios";

// Prefer explicit env. If not set, use same-origin (works with a Vite proxy).
// This avoids hardcoding ports like 5000 that may conflict with local setups.
const baseURL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
    : "";

const apiClient = axios.create({
  baseURL: baseURL || undefined,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Utility to globally resolve relative upload paths to absolute URLs
function prependBaseUrlToUploads(obj, apiRoot) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string' && obj[i].startsWith('/uploads/')) {
        obj[i] = apiRoot + obj[i];
      } else if (typeof obj[i] === 'object') {
        prependBaseUrlToUploads(obj[i], apiRoot);
      }
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string' && obj[key].startsWith('/uploads/')) {
          obj[key] = apiRoot + obj[key];
        } else if (typeof obj[key] === 'object') {
          prependBaseUrlToUploads(obj[key], apiRoot);
        }
      }
    }
  }
}

function getModuleFromUrl(url = "") {
  const normalized = (typeof url === "string" ? url : (url?.url || "")).toLowerCase();
  
  // 1. Admin detection (Priority)
  if (
    normalized.includes("/admin/") || 
    normalized.includes("/food/admin/") || 
    normalized.includes("/food/auth/admin") || 
    normalized.includes("/auth/admin") || 
    normalized.includes("admin/login")
  ) return "admin";

  // 2. Special case: /food/restaurants (plural) is a public endpoint
  // BUT only if it's not a restaurant owner's specific route
  if (normalized.includes("/food/restaurants") && !normalized.includes("/food/restaurant/")) {
    return "user";
  }

  // 3. Restaurant detection
  if (
    normalized.includes("/restaurant/") || 
    normalized.includes("/food/restaurant") ||
    normalized.includes("/auth/restaurant")
  ) {
    return "restaurant";
  }
  
  // 4. Delivery detection
  if (
    normalized.includes("/delivery/") || 
    normalized.includes("/food/delivery") ||
    normalized.includes("/auth/delivery")
  ) return "delivery";

  return "user";
}

function getModuleFromConfig(config) {
  if (config?.contextModule) return config.contextModule;
  
  const url = String(config?.url || "").toLowerCase();
  const method = String(config?.method || "").toLowerCase();
  
  // Custom routing: GET, PATCH, and DELETE requests to licensing-request belong to admin module; POST belongs to public user
  if (url.includes("/licensing-request")) {
    if (method === "post") {
      return "user";
    }
    return "admin";
  }

  return getModuleFromUrl(config?.url);
}

function getAccessToken(config) {
  const module = getModuleFromConfig(config);
  const key = `${module}_accessToken`;
  try {
    // 1. Try module-specific token first
    const moduleToken = localStorage.getItem(key);
    if (moduleToken) return moduleToken;
    
    // 2. Try auth context keys
    if (module === "user") {
      return localStorage.getItem("auth_customer") || localStorage.getItem("user_accessToken") || null;
    }
    if (module === "seller") {
      return localStorage.getItem("auth_seller") || localStorage.getItem("accessToken") || localStorage.getItem("token") || null;
    }
    if (module === "restaurant") {
      return localStorage.getItem("auth_restaurant") || localStorage.getItem("accessToken") || localStorage.getItem("token") || null;
    }
    if (module === "delivery") {
      return localStorage.getItem("auth_delivery") || localStorage.getItem("accessToken") || localStorage.getItem("token") || null;
    }
    if (module === "admin") {
      return localStorage.getItem("auth_admin") || localStorage.getItem("adminToken") || null;
    }

    return null;
  } catch {
    return null;
  }
}

function getRefreshToken(module) {
  try {
    const moduleRefreshToken = localStorage.getItem(`${module}_refreshToken`);
    if (moduleRefreshToken) return moduleRefreshToken;
    
    if (module === "user") {
      return localStorage.getItem("auth_customer_refresh") || localStorage.getItem("user_refreshToken") || localStorage.getItem("refreshToken") || null;
    }
    if (module === "seller") {
      return localStorage.getItem("auth_seller_refresh") || localStorage.getItem("refreshToken") || null;
    }
    if (module !== "admin") {
      return localStorage.getItem("refreshToken") || null;
    }
    return null;
  } catch {
    return null;
  }
}

function clearModuleAuth(module, forceGlobal = false) {
  try {
    localStorage.removeItem(`${module}_accessToken`);
    localStorage.removeItem(`${module}_refreshToken`);
    localStorage.removeItem(`${module}_authenticated`);
    localStorage.removeItem(`${module}_user`);
    if (forceGlobal) {
      if (module === "admin") {
        localStorage.removeItem("auth_admin");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminInfo");
      } else if (module === "user") {
        localStorage.removeItem("auth_customer");
        localStorage.removeItem("auth_customer_refresh");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
      }
    }
  } catch (_) {}
}

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeToRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken, module) {
  refreshSubscribers.forEach((cb) => cb(newToken, module));
  refreshSubscribers = [];
}

function onRefreshFailed(module) {
  clearModuleAuth(module, true);
  // Fail any queued requests that were waiting for this refresh
  refreshSubscribers.forEach((cb) => cb(null, module));
  refreshSubscribers = [];
  
  // Dispatch a custom event specifically for the module that failed refresh
  window.dispatchEvent(new CustomEvent("authRefreshFailed", { detail: { module } }));
}

// Ensure every request from the application receives appropriate context tags and authentication token.
apiClient.interceptors.request.use(
  async (config) => {
    // Determine target module for authorization headers scoping
    config.contextModule = getModuleFromConfig(config);

    const token = getAccessToken(config);
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    } else {
      // Clean stale header if token absent
      delete config.headers.Authorization;
    }

    // Attach context module as header for backend scoping (e.g. notifications)
    if (config.contextModule) {
      config.headers['x-context-module'] = config.contextModule;
    }

    // Let the browser automatically set the Content-Type with boundaries for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];

      try {
        const { compressImage } = await import("@shared/utils/imageCompression");
        const newFormData = new FormData();
        
        for (const [key, value] of config.data.entries()) {
          if ((value instanceof File || value instanceof Blob) && value.type && value.type.startsWith("image/")) {
            try {
              // Preserve original file type to respect backend strict mimetype validations
              const compressed = await compressImage(value, { fileType: value.type });
              newFormData.append(key, compressed, value.name || "image.jpg");
            } catch (err) {
              console.error("Global image compression failed, falling back to original:", err);
              newFormData.append(key, value);
            }
          } else {
            newFormData.append(key, value);
          }
        }
        config.data = newFormData;
      } catch (importErr) {
        console.error("Failed to load image compressor:", importErr);
      }
    }

    return config;
  },
  (err) => Promise.reject(err)
);

apiClient.interceptors.response.use(
  (response) => {
    const apiRoot = baseURL ? baseURL.replace(/\/api\/v1\/?$/, "") : "";
    if (apiRoot && response.data) {
      prependBaseUrlToUploads(response.data, apiRoot);
    }
    return response;
  },
  async (err) => {
    const original = err?.config;
    if (err?.response?.status === 429) {
      return Promise.reject(err);
    }
    if (err?.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(err);
    }
    
    // Skip token refresh if the 401 is specifically for the contacts viewer password
    if (err?.response?.data?.message === 'Invalid or missing contacts view password') {
      return Promise.reject(err);
    }
    const module = original.contextModule || getModuleFromUrl(original.url);
    const refreshToken = getRefreshToken(module);
    if (!refreshToken) {
      clearModuleAuth(module, false);
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeToRefresh((newToken) => {
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(original));
          } else {
            reject(err);
          }
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Use relative URL so this works both with an explicit baseURL and with a dev proxy.
      // Use plain axios to avoid interceptor recursion.
      const refreshUrl = baseURL ? `${baseURL}/food/auth/refresh-token` : "/api/v1/food/auth/refresh-token";
      const { data } = await axios.post(refreshUrl, { refreshToken }, { timeout: 10000 });
      const newAccessToken = data?.data?.accessToken || data?.accessToken;
      if (newAccessToken) {
        try {
          localStorage.setItem(`${module}_accessToken`, newAccessToken);
          
          // Also sync legacy and global keys for consistency across the app
          if (module === "admin") {
            localStorage.setItem("adminToken", newAccessToken);
          } else if (module === "user") {
            localStorage.setItem("auth_customer", newAccessToken);
          }
          localStorage.setItem("accessToken", newAccessToken);

          // Dispatch a custom event specifically for the module that refreshed
          window.dispatchEvent(new CustomEvent("authRefreshed", { 
            detail: { module, token: newAccessToken } 
          }));
        } catch (_) {}
        onRefreshed(newAccessToken, module);
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(original);
      }
    } catch (_) {
      onRefreshFailed(module);
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }

    onRefreshFailed(module);
    return Promise.reject(err);
  }
);

export default apiClient;

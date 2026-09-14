/**
 * Central API client for backend (auth and future APIs).
 * - baseURL from VITE_API_BASE_URL (e.g. http://localhost:5000/api/v1)
 * - When baseURL ends with /api/v1, request paths must NOT include /v1 (use /food/..., /auth/...)
 * - Attaches Bearer token (user or admin based on request URL)
 * - On 401: attempts refresh, retries once; on refresh failure logs out
 */

import axios from "axios";
import { redirectAdminToLogin } from "@/shared/utils/adminSession";

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
});

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
  return getModuleFromUrl(config?.url);
}

function getAccessToken(config) {
  const module = getModuleFromConfig(config);
  const key = `${module}_accessToken`;
  try {
    // OTP registration token for onboarding draft/step and final /register (not a session JWT).
    if (module === "restaurant") {
      const url = String(config?.url || "").toLowerCase();
      if (url.includes("/onboarding/") || url.includes("/restaurant/register")) {
        const registrationToken = sessionStorage.getItem("restaurant_registrationToken");
        if (registrationToken) return registrationToken;
      }
    }

    const moduleToken = localStorage.getItem(key);
    if (moduleToken) return moduleToken;
    
    if (module === "admin") return localStorage.getItem("adminToken") || null;
    if (module === "user") return localStorage.getItem("accessToken") || null;
    
    return null;
  } catch {
    return null;
  }
}

function getRefreshToken(module) {
  try {
    const moduleRefreshToken = localStorage.getItem(`${module}_refreshToken`);
    if (moduleRefreshToken) return moduleRefreshToken;
    
    if (module === "user") return localStorage.getItem("refreshToken") || null;
    
    return null;
  } catch {
    return null;
  }
}

function clearModuleAuth(module) {
  try {
    localStorage.removeItem(`${module}_accessToken`);
    localStorage.removeItem(`${module}_refreshToken`);
    localStorage.removeItem(`${module}_authenticated`);
    localStorage.removeItem(`${module}_user`);
    if (module === "admin") {
      localStorage.removeItem("auth_admin");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminInfo");
    } else if (module === "user") {
      localStorage.removeItem("auth_customer");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
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
  clearModuleAuth(module);
  // Fail any queued requests that were waiting for this refresh
  refreshSubscribers.forEach((cb) => cb(null, module));
  refreshSubscribers = [];
  
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("authRefreshFailed", { detail: { module } }));
  }
}

apiClient.interceptors.request.use(
  (config) => {
    config.contextModule = getModuleFromConfig(config);

    // If sending FormData, let the browser set proper multipart boundary.
    if (config.data instanceof FormData) {
      if (config.headers && config.headers["Content-Type"]) {
        delete config.headers["Content-Type"];
      }
    }

    const token = getAccessToken(config);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach context module as header for backend scoping (e.g. notifications)
    if (config.contextModule) {
      config.headers['x-context-module'] = config.contextModule;
    }

    return config;
  },
  (err) => Promise.reject(err)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (err) => {
    const original = err?.config;
    if (err?.response?.status === 429) {
      return Promise.reject(err);
    }
    if (err?.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(err);
    }
    const module = original.contextModule || getModuleFromUrl(original.url);
    const requestUrl = String(original.url || "").toLowerCase();
    const isAuthEndpoint =
      requestUrl.includes("/login") ||
      requestUrl.includes("/refresh-token") ||
      requestUrl.includes("/signup") ||
      requestUrl.includes("/forgot");

    const endAdminSession = () => {
      clearModuleAuth(module);
      if (module === "admin" && !isAuthEndpoint) {
        redirectAdminToLogin("session_expired");
      }
    };

    const refreshToken = getRefreshToken(module);
    if (!refreshToken) {
      endAdminSession();
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
      const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;
      if (newAccessToken) {
        try {
          localStorage.setItem(`${module}_accessToken`, newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem(`${module}_refreshToken`, newRefreshToken);
            if (module === "user") {
              localStorage.setItem("refreshToken", newRefreshToken);
            }
          }
          
          if (module === "admin") {
            localStorage.setItem("adminToken", newAccessToken);
          } else if (module === "user") {
            localStorage.setItem("accessToken", newAccessToken);
          }

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
      if (module === "admin" && !isAuthEndpoint) {
        redirectAdminToLogin("session_expired");
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }

    onRefreshFailed(module);
    if (module === "admin" && !isAuthEndpoint) {
      redirectAdminToLogin("session_expired");
    }
    return Promise.reject(err);
  }
);

export default apiClient;

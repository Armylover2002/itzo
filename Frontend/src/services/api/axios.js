/**
 * Central API client for backend (auth and future APIs).
 * - baseURL from VITE_API_BASE_URL (e.g. http://localhost:5000/api/v1)
 * - When baseURL ends with /api/v1, request paths must NOT include /v1 (use /food/..., /auth/...)
 * - Attaches Bearer token (user or admin based on request URL)
 * - On 401: attempts refresh, retries once; on refresh failure logs out
 */

import axios from "axios";
import { redirectAdminToLogin } from "@/shared/utils/adminSession";
import { refreshModuleSession } from "@/shared/utils/authRefresh";
import { installUploadUrlInterceptors } from "@/shared/utils/uploadUrl";

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

// "/uploads/..." paths from the API -> https://<uploads origin>/uploads/... for the UI.
installUploadUrlInterceptors(apiClient);

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

  // 2. Special case: public endpoints used by user app
  if (
    normalized.includes("/categories/public") ||
    normalized.includes("/menus/batch") ||
    normalized.includes("/fee-settings/public") ||
    (normalized.includes("/food/restaurants") && !normalized.includes("/food/restaurant/"))
  ) {
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

  // Licensing requests: public POST is a user submission; GET/PATCH/DELETE are admin-only.
  const url = String(config?.url || "").toLowerCase();
  if (url.includes("/licensing-request")) {
    return String(config?.method || "").toLowerCase() === "post" ? "user" : "admin";
  }

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

function onRefreshFailed(module) {
  clearModuleAuth(module);
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

    // A failed login/signup/refresh is the component's to report, not a session end.
    if (isAuthEndpoint) {
      return Promise.reject(err);
    }

    const endSession = () => {
      onRefreshFailed(module);
      if (module === "admin") {
        redirectAdminToLogin("session_expired");
      }
    };

    original._retry = true;

    const newAccessToken = await refreshModuleSession(module);
    if (!newAccessToken) {
      endSession();
      return Promise.reject(err);
    }

    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${newAccessToken}`;
    return apiClient(original);
  }
);

export default apiClient;

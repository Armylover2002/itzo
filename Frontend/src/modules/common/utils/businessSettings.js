/**
 * Business Settings Utility
 * Centralized load/cache for public global settings (favicon, title, logos).
 * Fetches at most once per browser session unless forceRefresh is requested.
 */

import apiClient from "@/services/api/axios";
import { API_ENDPOINTS } from "@/services/api/config";

const SETTINGS_KEY = 'global_business_settings';
let currentAppType = 'user';
let hasFetchedThisSession = false;
let inFlightSettingsPromise = null;

const getSettingsUpdatedAt = (settings) => {
  if (!settings?.updatedAt) return '';
  return String(settings.updatedAt);
};

const applySettingsToCache = (settings, { notify = false, markFetched = true } = {}) => {
  if (!settings) return;

  cachedSettings = settings;
  if (markFetched) {
    hasFetchedThisSession = true;
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}

  updateTitle(settings.companyName);
  updateThemeColor(settings.themeColor);

  const favicon = getAppFavicon(currentAppType);
  if (favicon) updateFavicon(favicon);

  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('businessSettingsUpdated', { detail: settings }));
  }
};

/**
 * Cross-tab sync only. No focus/visibility/poll refetch — settings are session-cached.
 */
const initSettingsSyncListeners = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('storage', (event) => {
    if (event.key !== SETTINGS_KEY || !event.newValue) return;

    try {
      const settings = JSON.parse(event.newValue);
      const currentUpdatedAt = getSettingsUpdatedAt(cachedSettings);
      const incomingUpdatedAt = getSettingsUpdatedAt(settings);
      if (incomingUpdatedAt && incomingUpdatedAt === currentUpdatedAt) return;
      applySettingsToCache(settings, { notify: true, markFetched: true });
    } catch (e) {}
  });
};

/**
 * Detect app type from URL if not set
 */
const detectAppType = () => {
  const path = window.location.pathname;
  if (path.includes('/ecs')) return 'admin';
  if (path.includes('/restaurant')) return 'restaurant';
  if (path.includes('/delivery')) return 'delivery';
  if (path.includes('/seller')) return 'seller';
  return 'user';
};

if (typeof window !== 'undefined') {
  currentAppType = detectAppType();
}

/**
 * Set current app type manually (updates favicon from cache; does not fetch)
 */
export const setAppType = (appType) => {
  currentAppType = appType;
  if (cachedSettings) {
    const favicon = getAppFavicon(appType);
    if (favicon) updateFavicon(favicon);
  }
};

let cachedSettings = (() => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
})();

export const updateThemeColor = (color) => {
  if (!color || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--primary-theme', color);
  document.documentElement.style.setProperty('--sidebar-theme', color);
};

if (cachedSettings) {
  setTimeout(() => {
    updateTitle(cachedSettings.companyName);
    updateThemeColor(cachedSettings.themeColor);
    const favicon = getAppFavicon(currentAppType);
    if (favicon) updateFavicon(favicon);
  }, 0);
}

/**
 * Load business settings from backend (public endpoint - no auth required).
 * Session-cached: after the first successful fetch, returns memory cache
 * unless options.forceRefresh is true. Concurrent callers share one Promise.
 */
export const loadBusinessSettings = async (options = {}) => {
  const forceRefresh = options?.forceRefresh === true;
  try {
    const endpoint = API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC;
    if (!endpoint || (typeof endpoint === "string" && !endpoint.trim())) {
      return cachedSettings;
    }

    if (!forceRefresh && hasFetchedThisSession && cachedSettings) {
      return cachedSettings;
    }

    // Join an in-flight fetch so index.jsx + SettingsProvider don't open parallel
    // `/public` requests. forceRefresh waits for the current one, then starts a new one.
    if (inFlightSettingsPromise) {
      if (!forceRefresh) {
        return await inFlightSettingsPromise;
      }
      try {
        await inFlightSettingsPromise;
      } catch {
        // Continue into a fresh force refresh below.
      }
    }

    inFlightSettingsPromise = (async () => {
      try {
        const response = await apiClient.get(endpoint);
        const settings = response?.data?.data || response?.data;

        if (settings) {
          // Notify so cache-only consumers (logos, banners) update after the single session fetch
          applySettingsToCache(settings, { notify: true, markFetched: true });
          return settings;
        }
        return cachedSettings;
      } finally {
        inFlightSettingsPromise = null;
      }
    })();

    return await inFlightSettingsPromise;
  } catch (error) {
    return cachedSettings;
  }
};

/**
 * Explicit refresh (admin update, manual refresh action).
 * Prefer this over loadBusinessSettings({ forceRefresh: true }) for clarity.
 */
export const refreshBusinessSettings = async () => {
  return loadBusinessSettings({ forceRefresh: true });
};

/**
 * @deprecated Use refreshBusinessSettings(). Kept for compatibility; no longer auto-polled.
 */
export const refreshBusinessSettingsIfStale = async () => {
  return refreshBusinessSettings();
};

export const updateFavicon = (url) => {
  if (!url || typeof document === 'undefined') return;

  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  existingLinks.forEach(el => el.remove());

  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/x-icon";
  link.href = url;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleIcon) {
    appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = url;
};

export const updateTitle = (companyName) => {
  if (companyName && typeof document !== 'undefined') {
    document.title = companyName;
  }
};

/**
 * Set cached settings manually (useful after admin update)
 */
export const setCachedSettings = (settings) => {
  applySettingsToCache(settings, { notify: true, markFetched: true });
};

/**
 * Clear cached settings (call after updating settings)
 */
export const clearCache = () => {
  cachedSettings = null;
  hasFetchedThisSession = false;
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {}
};

/**
 * Get cached settings (sync, no network)
 */
export const getCachedSettings = () => {
  return cachedSettings;
};

/**
 * Whether a network fetch already completed this page session
 */
export const hasSessionSettings = () => hasFetchedThisSession && !!cachedSettings;

/**
 * Get app specific logo with fallback to common logo
 */
export const getAppLogo = (appType) => {
  const settings = getCachedSettings();
  if (!settings) return null;

  switch (appType) {
    case 'admin': return settings.adminLogo?.url;
    case 'user': return settings.userLogo?.url;
    case 'delivery': return settings.deliveryLogo?.url;
    case 'restaurant': return settings.restaurantLogo?.url;
    case 'seller': return settings.sellerLogo?.url;
    default: return null;
  }
};

export const getLoginBanner = () => {
  const settings = getCachedSettings();
  return settings?.loginBanner?.url || null;
};

export const getSellerLoginBanner = () => {
  const settings = getCachedSettings();
  return settings?.sellerLoginBanner || { url: '', active: true };
};

export const getRestaurantLoginBanner = () => {
  const settings = getCachedSettings();
  return settings?.restaurantLoginBanner || { url: '', active: true };
};

export const getAppFavicon = (appType) => {
  const settings = getCachedSettings();
  if (!settings) return null;

  switch (appType) {
    case 'admin': return settings.adminFavicon?.url;
    case 'user': return settings.userFavicon?.url;
    case 'delivery': return settings.deliveryFavicon?.url;
    case 'restaurant': return settings.restaurantFavicon?.url;
    case 'seller': return settings.sellerFavicon?.url;
    default: return null;
  }
};

export const updateBrowserFavicon = (url) => {
  if (!url) return;
  const link = document.querySelector("link[rel~='icon']");
  if (link) {
    link.href = url;
  } else {
    const newLink = document.createElement("link");
    newLink.rel = "icon";
    newLink.href = url;
    document.head.appendChild(newLink);
  }
};

export const getCompanyName = () => {
  const settings = getCachedSettings();
  return settings?.companyName || "Appzeto";
};

/**
 * Company name from cache (no network). Kept async for call-site compatibility.
 */
export const getCompanyNameAsync = async () => getCompanyName();

/**
 * Subscribe to settings updates (cross-tab + admin setCachedSettings).
 * Returns unsubscribe function.
 */
export const subscribeBusinessSettings = (callback) => {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }
  const handler = (event) => {
    callback(event?.detail || getCachedSettings());
  };
  window.addEventListener('businessSettingsUpdated', handler);
  return () => window.removeEventListener('businessSettingsUpdated', handler);
};

initSettingsSyncListeners();

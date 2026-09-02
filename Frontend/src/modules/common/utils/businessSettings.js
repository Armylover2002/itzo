/**
 * Business Settings Utility
 * Handles loading and updating business settings (favicon, title, logo)
 */

import apiClient from "@/services/api/axios";
import { API_ENDPOINTS } from "@/services/api/config";
import { searchAPI } from "@/services/api";

const SETTINGS_KEY = 'global_business_settings';
let currentAppType = 'user'; // Default to user app

/**
 * Detect app type from URL if not set
 */
const detectAppType = () => {
  if (typeof window === 'undefined') return 'user';
  const path = window.location.pathname;
  if (path.includes('/ecs') || path.includes('/hrms')) return 'admin';
  if (path.includes('/restaurant')) return 'restaurant';
  if (path.includes('/delivery')) return 'delivery';
  if (path.includes('/seller')) return 'seller';
  return 'user';
};

// Initialize app type
if (typeof window !== 'undefined') {
  currentAppType = detectAppType();
}

/**
 * Set current app type manually
 */
export const setAppType = (appType) => {
  currentAppType = appType;
  if (cachedSettings) {
    const favicon = getAppFavicon(appType);
    if (favicon) updateFavicon(favicon);
  }
};

// Initialize from localStorage immediately so it's available for components on mount
let cachedSettings = (() => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? JSON.parse(saved) : null;
    return settings;
  } catch (e) {
    return null;
  }
})();

/**
 * Update theme color in document root
 */
export const updateThemeColor = (color) => {
  if (!color || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--primary-theme', color);
  document.documentElement.style.setProperty('--sidebar-theme', color);
};

// Apply cached settings immediately on module load if they exist
if (cachedSettings) {
  setTimeout(() => {
    updateTitle(cachedSettings.companyName);
    updateThemeColor(cachedSettings.themeColor);
    // Also apply favicon if we have it
    const favicon = getAppFavicon(currentAppType);
    if (favicon) updateFavicon(favicon);
  }, 0);
}

let inFlightSettingsPromise = null;

/**
 * Load business settings from backend (public endpoint - no auth required)
 */
export const loadBusinessSettings = async () => {
  try {
    const endpoint = API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC;
    if (!endpoint || (typeof endpoint === "string" && !endpoint.trim())) {
      return cachedSettings;
    }

    if (inFlightSettingsPromise) {
      return await inFlightSettingsPromise;
    }

    inFlightSettingsPromise = (async () => {
      // Use the generic searchAPI or a dedicated public getter if available
      const response = await apiClient.get(endpoint, { noCache: true });
      const settings = response?.data?.data || response?.data;

      if (settings) {
        cachedSettings = settings;
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {}
        
        updateTitle(settings.companyName);
        updateThemeColor(settings.themeColor);
        
        // Auto update favicon based on current app type
        const favicon = getAppFavicon(currentAppType);
        if (favicon) updateFavicon(favicon);

        return settings;
      }
      return cachedSettings;
    })();

    return await inFlightSettingsPromise;
  } catch (error) {
    return cachedSettings;
  } finally {
    inFlightSettingsPromise = null;
  }
};

/**
 * Update favicon in document
 */
export const updateFavicon = (url) => {
  if (!url || typeof document === 'undefined') return;
  
  // Remove all existing favicon links to prevent conflicts
  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  existingLinks.forEach(el => el.remove());

  // Create new favicon link
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/x-icon";
  link.href = url;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
  
  // Also update/create apple-touch-icon if needed
  let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleIcon) {
    appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = url;
};

/**
 * Update page title
 */
export const updateTitle = (companyName) => {
  if (companyName && typeof document !== 'undefined') {
    document.title = companyName;
  }
};

/**
 * Set cached settings manually (useful after update)
 */
export const setCachedSettings = (settings) => {
  if (settings) {
    cachedSettings = settings;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
    
    updateTitle(settings.companyName);
    updateThemeColor(settings.themeColor);
    
    // Auto update favicon based on current app type
    const favicon = getAppFavicon(currentAppType);
    if (favicon) updateFavicon(favicon);
    
    // Dispatch event so all components listening can update immediately
    window.dispatchEvent(new CustomEvent('businessSettingsUpdated', { detail: settings }));
  }
};

/**
 * Clear cached settings (call after updating settings)
 */
export const clearCache = () => {
  cachedSettings = null;
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {}
};

/**
 * Get cached settings
 */
export const getCachedSettings = () => {
  return cachedSettings;
};

/**
 * Whether the subscription / daily-pass gate is active for a partner type.
 * Mirrors the backend check and fails SAFE: anything other than an explicit
 * `false` keeps the existing subscription flow visible.
 *
 * @param {'DELIVERY_PARTNER'|'RESTAURANT'} userType
 * @returns {boolean}
 */
export const isSubscriptionEnforced = (userType) => {
  const enforcement = getCachedSettings()?.subscriptionEnforcement;
  if (!enforcement) return true;
  if (userType === 'DELIVERY_PARTNER') return enforcement.deliveryPartner !== false;
  if (userType === 'RESTAURANT') return enforcement.restaurant !== false;
  return true;
};

/**
 * Get app specific logo with fallback to common logo
 */
export const getAppLogo = (appType) => {
  const settings = getCachedSettings();
  if (!settings) return '/itzo-logo-transparent.png';
  
  const target = appType || detectAppType();
  let logo = null;
  switch(target) {
    case 'admin':
    case 'hrms': logo = settings.adminLogo?.url; break;
    case 'user': logo = settings.userLogo?.url; break;
    case 'delivery': logo = settings.deliveryLogo?.url; break;
    case 'restaurant': logo = settings.restaurantLogo?.url; break;
    case 'seller': logo = settings.sellerLogo?.url; break;
    default: logo = settings.userLogo?.url || settings.logo?.url; break;
  }
  return logo || '/itzo-logo-transparent.png';
};

/**
 * Get app specific favicon with fallback to common favicon
 */
export const getAppFavicon = (appType) => {
  const settings = getCachedSettings();
  if (!settings) return null;
  
  const target = appType || detectAppType();
  switch(target) {
    case 'admin':
    case 'hrms': return settings.adminFavicon?.url;
    case 'user': return settings.userFavicon?.url;
    case 'delivery': return settings.deliveryFavicon?.url;
    case 'restaurant': return settings.restaurantFavicon?.url;
    case 'seller': return settings.sellerFavicon?.url;
    default: return null;
  }
};

/**
 * Update browser favicon
 */
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

/**
 * Get company name from business settings with fallback
 */
export const getCompanyName = () => {
  const settings = getCachedSettings();
  return settings?.companyName || "Appzeto";
};

export const getCompanyNameAsync = async () => getCompanyName();

export const getSellerLoginBanner = () => {
  const settings = getCachedSettings();
  return settings?.sellerLoginBanner || { url: '', active: true };
};

export const getRestaurantLoginBanner = () => {
  const settings = getCachedSettings();
  return settings?.restaurantLoginBanner || { url: '', active: true };
};

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

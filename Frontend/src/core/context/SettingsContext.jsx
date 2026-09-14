import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { loadBusinessSettings, getCachedSettings } from "@common/utils/businessSettings";

const SettingsContext = createContext(undefined);

/** Default fallbacks when settings are not yet loaded or API fails */
const DEFAULT_SETTINGS = {
  appName: "App",
  supportEmail: "",
  supportPhone: "",
  currencySymbol: "₹",
  currencyCode: "INR",
  timezone: "Asia/Kolkata",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#FF0000",
  secondaryColor: "#64748b",
  companyName: "",
  taxId: "",
  address: "",
  facebook: "",
  twitter: "",
  instagram: "",
  linkedin: "",
  youtube: "",
  playStoreLink: "",
  appStoreLink: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  keywords: [],
  deliveryPricingMode: "distance_based",
  pricingMode: "distance_based",
  customerBaseDeliveryFee: 30,
  riderBasePayout: 30,
  baseDeliveryCharge: 30,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fleetCommissionRatePerKm: 5,
  fixedDeliveryFee: 30,
  handlingFeeStrategy: "highest_category_fee",
  codEnabled: true,
  onlineEnabled: true,
};

function normalizeGlobalSettings(raw) {
  if (!raw || typeof raw !== "object") return {};

  const social = raw.socialLinks || {};
  const phoneNumber = raw.phone?.number || "";

  return {
    ...raw,
    appName: raw.appName || raw.companyName || DEFAULT_SETTINGS.appName,
    logoUrl: raw.logoUrl || raw.userLogo?.url || DEFAULT_SETTINGS.logoUrl,
    faviconUrl: raw.faviconUrl || raw.userFavicon?.url || DEFAULT_SETTINGS.faviconUrl,
    primaryColor: raw.primaryColor || raw.themeColor || DEFAULT_SETTINGS.primaryColor,
    supportEmail: raw.supportEmail || raw.email || DEFAULT_SETTINGS.supportEmail,
    supportPhone: raw.supportPhone || phoneNumber || DEFAULT_SETTINGS.supportPhone,
    facebook: raw.facebook || social.facebook || DEFAULT_SETTINGS.facebook,
    twitter: raw.twitter || social.twitter || DEFAULT_SETTINGS.twitter,
    instagram: raw.instagram || social.instagram || DEFAULT_SETTINGS.instagram,
    linkedin: raw.linkedin || social.linkedin || DEFAULT_SETTINGS.linkedin,
    youtube: raw.youtube || social.youtube || DEFAULT_SETTINGS.youtube,
  };
}

/**
 * Applies theme CSS variables to document root from settings.
 * Called when settings are loaded so the whole app uses dynamic colors.
 */
function applyThemeVariables(settings) {
  if (!settings) return;
  const root = document.documentElement;
  root.style.setProperty(
    "--primary",
    settings.primaryColor || DEFAULT_SETTINGS.primaryColor,
  );
  root.style.setProperty(
    "--secondary",
    settings.secondaryColor || DEFAULT_SETTINGS.secondaryColor,
  );
  root.style.setProperty(
    "--primary-color",
    settings.primaryColor || DEFAULT_SETTINGS.primaryColor,
  );
  root.style.setProperty(
    "--secondary-color",
    settings.secondaryColor || DEFAULT_SETTINGS.secondaryColor,
  );
}

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applyMergedSettings = useCallback((raw) => {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...normalizeGlobalSettings(raw || {}),
    };
    setSettings(merged);
    applyThemeVariables(merged);
    return merged;
  }, []);

  const fetchSettings = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      setLoading(true);
      setError(null);
      const cached = getCachedSettings();
      if (cached && !forceRefresh) {
        applyMergedSettings(cached);
      }
      // Single session-cached fetch via centralized store (deduped in-flight)
      const data = await loadBusinessSettings({ forceRefresh });
      applyMergedSettings(data || cached || {});
    } catch (err) {
      console.error("Failed to fetch settings", err);
      setError(
        err?.response?.data?.message ||
        err.message ||
        "Failed to load settings",
      );
      applyMergedSettings(getCachedSettings() || DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [applyMergedSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBusinessSettingsUpdated = (event) => {
      const updatedSettings = event?.detail;
      if (!updatedSettings || typeof updatedSettings !== "object") return;

      const merged = {
        ...DEFAULT_SETTINGS,
        ...normalizeGlobalSettings(updatedSettings),
      };

      setSettings(merged);
      applyThemeVariables(merged);
    };

    window.addEventListener("businessSettingsUpdated", handleBusinessSettingsUpdated);
    return () => {
      window.removeEventListener("businessSettingsUpdated", handleBusinessSettingsUpdated);
    };
  }, []);

  const value = {
    settings,
    loading,
    error,
    refetch: () => fetchSettings({ forceRefresh: true }),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

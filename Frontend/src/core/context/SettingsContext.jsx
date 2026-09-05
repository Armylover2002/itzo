import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axiosInstance from "@core/api/axios";
import { getWithDedupe } from "@core/api/dedupe";
import { getCachedSettings, loadBusinessSettings } from "@common/utils/businessSettings";

const SettingsContext = createContext(undefined);

/** Default fallbacks when settings are not yet loaded or API fails */
const DEFAULT_SETTINGS = {
  appName: "ItzoFood",
  supportEmail: "",
  supportPhone: "",
  currencySymbol: "₹",
  currencyCode: "INR",
  timezone: "Asia/Kolkata",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#FE5502",
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
  returnDeliveryCommission: 0,
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
  const [settings, setSettings] = useState(() => {
    const cached = getCachedSettings();
    if (cached) {
      const formattedAddress = [cached.address, cached.state, cached.pincode].filter(Boolean).join(', ') || cached.address || '';
      const formattedPhone = cached.companySupportNumber || (cached.phone?.number ? `${cached.phone.countryCode || '+91'} ${cached.phone.number}` : '') || '';
      const formattedEmail = cached.customerSupportEmail || cached.helpAndSupportEmail || cached.email || '';
      const resolvedLogo = cached.userLogo?.url || cached.landingNavbarLogo?.url || cached.landingFooterLogo?.url || cached.logo?.url || cached.adminLogo?.url || '';

      return {
        ...DEFAULT_SETTINGS,
        ...cached,
        appName: cached.companyName || DEFAULT_SETTINGS.appName,
        companyName: cached.companyName || DEFAULT_SETTINGS.companyName,
        supportEmail: formattedEmail || DEFAULT_SETTINGS.supportEmail,
        supportPhone: formattedPhone || DEFAULT_SETTINGS.supportPhone,
        address: formattedAddress || DEFAULT_SETTINGS.address,
        logoUrl: resolvedLogo || DEFAULT_SETTINGS.logoUrl,
      };
    }
    return DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let raw = null;
      try {
        const res = await getWithDedupe("/food/admin/business-settings/public", {}, { ttl: 60 * 1000 });
        raw = res?.data?.data || res?.data?.result || res?.data;
      } catch (e) {
        // Fallback to common business settings loader if needed
        raw = await loadBusinessSettings();
      }

      if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
        raw = getCachedSettings() || {};
      }

      const formattedAddress = [raw.address, raw.state, raw.pincode].filter(Boolean).join(', ') || raw.address || '';
      const formattedPhone = raw.companySupportNumber || (raw.phone?.number ? `${raw.phone.countryCode || '+91'} ${raw.phone.number}` : '') || raw.supportPhone || '';
      const formattedEmail = raw.customerSupportEmail || raw.helpAndSupportEmail || raw.email || raw.supportEmail || '';
      const resolvedLogo = raw.userLogo?.url || raw.landingNavbarLogo?.url || raw.landingFooterLogo?.url || raw.logo?.url || raw.adminLogo?.url || raw.logoUrl || '';

      const normalized = {
        ...raw,
        appName: raw.companyName || raw.appName || DEFAULT_SETTINGS.appName,
        companyName: raw.companyName || DEFAULT_SETTINGS.companyName,
        supportEmail: formattedEmail || DEFAULT_SETTINGS.supportEmail,
        supportPhone: formattedPhone || DEFAULT_SETTINGS.supportPhone,
        address: formattedAddress || DEFAULT_SETTINGS.address,
        logoUrl: resolvedLogo || DEFAULT_SETTINGS.logoUrl,
        faviconUrl: raw.userFavicon?.url || raw.adminFavicon?.url || raw.faviconUrl || DEFAULT_SETTINGS.faviconUrl,
        facebook: raw.socialFacebookUrl || raw.facebook || "",
        twitter: raw.socialTwitterUrl || raw.twitter || "",
        instagram: raw.socialInstagramUrl || raw.instagram || "",
        linkedin: raw.socialLinkedinUrl || raw.linkedin || "",
        youtube: raw.socialYoutubeUrl || raw.youtube || "",
      };

      const merged = { ...DEFAULT_SETTINGS, ...raw, ...normalized };
      setSettings(merged);
      applyThemeVariables(merged);
    } catch (err) {
      console.error("Failed to fetch settings", err);
      const cached = getCachedSettings();
      if (cached) {
        const formattedAddress = [cached.address, cached.state, cached.pincode].filter(Boolean).join(', ') || cached.address || '';
        const formattedPhone = cached.companySupportNumber || (cached.phone?.number ? `${cached.phone.countryCode || '+91'} ${cached.phone.number}` : '') || '';
        const formattedEmail = cached.customerSupportEmail || cached.helpAndSupportEmail || cached.email || '';
        const resolvedLogo = cached.userLogo?.url || cached.landingNavbarLogo?.url || cached.landingFooterLogo?.url || cached.logo?.url || cached.adminLogo?.url || '';

        const merged = {
          ...DEFAULT_SETTINGS,
          ...cached,
          appName: cached.companyName || DEFAULT_SETTINGS.appName,
          companyName: cached.companyName || DEFAULT_SETTINGS.companyName,
          supportEmail: formattedEmail || DEFAULT_SETTINGS.supportEmail,
          supportPhone: formattedPhone || DEFAULT_SETTINGS.supportPhone,
          address: formattedAddress || DEFAULT_SETTINGS.address,
          logoUrl: resolvedLogo || DEFAULT_SETTINGS.logoUrl,
        };
        setSettings(merged);
        applyThemeVariables(merged);
      } else {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load settings",
        );
        setSettings(DEFAULT_SETTINGS);
        applyThemeVariables(DEFAULT_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const handleUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('businessSettingsUpdated', handleUpdate);
    return () => {
      window.removeEventListener('businessSettingsUpdated', handleUpdate);
    };
  }, [fetchSettings]);

  const value = {
    settings,
    loading,
    error,
    refetch: fetchSettings,
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

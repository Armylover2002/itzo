import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axiosInstance from "@core/api/axios";
import { getWithDedupe } from "@core/api/dedupe";

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Use the Food module's public settings endpoint
      const res = await getWithDedupe("/food/admin/business-settings/public", {}, { ttl: 60 * 1000 });
      const data = res.data?.result || res.data;
      const merged = { ...DEFAULT_SETTINGS, ...data };
      setSettings(merged);
      applyThemeVariables(merged);
    } catch (err) {
      console.error("Failed to fetch settings", err);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to load settings",
      );
      setSettings(DEFAULT_SETTINGS);
      applyThemeVariables(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
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

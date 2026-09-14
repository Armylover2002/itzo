import { useState, useEffect } from "react";
import {
  getCachedSettings,
  subscribeBusinessSettings,
  getAppLogo,
  getAppFavicon,
  getCompanyName,
  getLoginBanner,
  getSellerLoginBanner,
  getRestaurantLoginBanner,
} from "@common/utils/businessSettings";

/**
 * React hook over the centralized business-settings cache.
 * Does NOT trigger a network request — SettingsProvider / app bootstrap owns fetching.
 */
export function useBusinessSettingsCache() {
  const [settings, setSettings] = useState(() => getCachedSettings());

  useEffect(() => {
    setSettings(getCachedSettings());
    return subscribeBusinessSettings((next) => {
      setSettings(next || getCachedSettings());
    });
  }, []);

  return settings;
}

/**
 * Branding helpers for a panel (logo / company name) from the shared cache.
 */
export function useAppBranding(appType = "user") {
  const settings = useBusinessSettingsCache();

  return {
    settings,
    companyName: settings?.companyName || getCompanyName(),
    logoUrl: getAppLogo(appType) || null,
    faviconUrl: getAppFavicon(appType) || null,
    loginBannerUrl: getLoginBanner(),
    sellerLoginBanner: getSellerLoginBanner(),
    restaurantLoginBanner: getRestaurantLoginBanner(),
  };
}

export default useBusinessSettingsCache;

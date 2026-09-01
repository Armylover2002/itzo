import { useState, useEffect } from "react";
import {
  getCachedSettings,
  loadBusinessSettings,
  isSubscriptionEnforced,
} from "@common/utils/businessSettings";

/**
 * Whether the subscription / daily-pass flow applies to this partner type.
 *
 * Returns `true` (the existing paywall flow) until proven otherwise, so a slow
 * or failed settings load never accidentally hides the subscription UI.
 * Re-evaluates when the admin updates global settings.
 *
 * @param {'DELIVERY_PARTNER'|'RESTAURANT'} userType
 * @returns {boolean}
 */
export function useSubscriptionRequired(userType) {
  const [required, setRequired] = useState(() => isSubscriptionEnforced(userType));

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (mounted) setRequired(isSubscriptionEnforced(userType));
    };

    // Make sure settings are present, then evaluate.
    if (getCachedSettings()) {
      sync();
    } else {
      loadBusinessSettings().then(sync).catch(() => {});
    }

    window.addEventListener("businessSettingsUpdated", sync);
    return () => {
      mounted = false;
      window.removeEventListener("businessSettingsUpdated", sync);
    };
  }, [userType]);

  return required;
}

export default useSubscriptionRequired;

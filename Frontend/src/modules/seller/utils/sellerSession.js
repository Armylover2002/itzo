export const SELLER_LIVE_SESSION_KEY = "sellerLiveSession";
export const SELLER_ONBOARDING_RESUME_KEY = "sellerOnboardingResume";

const SELLER_AUTH_KEYS = [
  "auth_seller",
  "seller_accessToken",
  "seller_refreshToken",
  "seller_authenticated",
  "seller_user",
];

export function isNativeLikeShell() {
  if (typeof window === "undefined") return false;

  const protocol = String(window.location?.protocol || "").toLowerCase();
  const userAgent = String(window.navigator?.userAgent || "").toLowerCase();

  return (
    Boolean(window.flutter_inappwebview) ||
    Boolean(window.ReactNativeWebView) ||
    protocol === "file:" ||
    userAgent.includes(" wv") ||
    userAgent.includes("; wv")
  );
}

let liveSessionMemory = false;

export function markSellerLiveSession() {
  liveSessionMemory = true;
  try {
    sessionStorage.setItem(SELLER_LIVE_SESSION_KEY, "1");
  } catch {
    // sessionStorage can be blocked in private WebViews
  }
}

export function hasSellerLiveSession() {
  if (liveSessionMemory) return true;
  try {
    return sessionStorage.getItem(SELLER_LIVE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSellerOnboardingResume() {
  try {
    localStorage.setItem(SELLER_ONBOARDING_RESUME_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearSellerOnboardingResume() {
  try {
    localStorage.removeItem(SELLER_ONBOARDING_RESUME_KEY);
  } catch {
    // ignore
  }
}

export function hasSellerOnboardingResume() {
  try {
    return localStorage.getItem(SELLER_ONBOARDING_RESUME_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasSellerAuthToken() {
  try {
    return Boolean(
      localStorage.getItem("auth_seller") ||
        localStorage.getItem("seller_accessToken"),
    );
  } catch {
    return false;
  }
}

export function clearSellerAuthTokens() {
  try {
    SELLER_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/**
 * App process / WebView was killed mid-registration.
 * Drop the seller token so reopen starts at login, but keep the phone-keyed draft.
 */
export function applySellerOnboardingColdStart() {
  if (typeof window === "undefined") return false;
  if (!isNativeLikeShell()) return false;
  if (hasSellerLiveSession()) return false;
  if (!hasSellerAuthToken()) return false;
  if (!hasSellerOnboardingResume()) return false;

  clearSellerAuthTokens();
  return true;
}

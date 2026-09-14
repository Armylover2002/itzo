/**
 * Auth API – new backend (USER, ADMIN, RESTAURANT, DELIVERY).
 * Food-prefixed: POST /food/auth/...
 */

import apiClient from "./axios.js";

const AUTH = {
  USER_REQUEST_OTP: "/food/auth/user/request-otp",
  USER_VERIFY_OTP: "/food/auth/user/verify-otp",
  ADMIN_LOGIN: "/food/auth/admin/login",
  RESTAURANT_REQUEST_OTP: "/food/auth/restaurant/request-otp",
  RESTAURANT_VERIFY_OTP: "/food/auth/restaurant/verify-otp",
  DELIVERY_REQUEST_OTP: "/food/auth/delivery/request-otp",
  DELIVERY_VERIFY_OTP: "/food/auth/delivery/verify-otp",
  REFRESH_TOKEN: "/food/auth/refresh-token",
  LOGOUT: "/food/auth/logout",
  LOGOUT_ALL: "/food/auth/logout-all",
  ME: "/food/auth/me",
};

const LOGOUT_MAX_RETRIES = 2;
const LOGOUT_RETRY_DELAY_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postAuthWithRetry(requestFn, retries = LOGOUT_MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(LOGOUT_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastError;
}

/**
 * Normalize phone to digits only (for backend 8–15 digits).
 * @param {string} phone - e.g. "+91 9876543210" or "9876543210"
 */
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.slice(-15);
}

/** User phone: exactly 10 digits, numeric only. */
const USER_PHONE_LENGTH = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Request OTP for user login.
 * Validation: phone required, numeric only, exactly 10 digits (last 10 if country code included).
 * @param {string} phone - Phone (with or without country code, e.g. "+91 9876543210")
 * @returns {Promise<{ data }>}
 */
export function requestUserOtp(phone) {
  const isEmail = String(phone || "").includes("@");
  if (isEmail) {
    const trimmed = String(phone).trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      return Promise.reject(new Error("Please enter a valid email address"));
    }
    return apiClient.post(AUTH.USER_REQUEST_OTP, { phone: trimmed });
  }

  const digits = normalizePhone(phone);
  if (!digits) {
    return Promise.reject(new Error("Phone number is required"));
  }
  if (!/^\d+$/.test(digits)) {
    return Promise.reject(new Error("Phone must contain only digits"));
  }
  const normalized =
    digits.length > USER_PHONE_LENGTH
      ? digits.slice(-USER_PHONE_LENGTH)
      : digits;
  if (normalized.length !== USER_PHONE_LENGTH) {
    return Promise.reject(new Error("Phone number must be exactly 10 digits"));
  }
  return apiClient.post(AUTH.USER_REQUEST_OTP, { phone: normalized });
}

/**
 * Verify OTP and login (user).
 * Validation: phone 10 digits, OTP required, exactly 4 digits numeric.
 * Backend returns { accessToken, refreshToken, user }.
 * @param {string} phone - Same format as request
 * @param {string} otp - 4-digit OTP only
 */
export function verifyUserOtp(
  phone,
  otp,
  ref,
  name = null,
  fcmToken = null,
  platform = "web",
) {
  const isEmail = String(phone || "").includes("@");
  let normalized = "";

  if (isEmail) {
    normalized = String(phone).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) {
      return Promise.reject(new Error("Please enter a valid email address"));
    }
  } else {
    const digits = normalizePhone(phone);
    if (!digits) {
      return Promise.reject(new Error("Phone number is required"));
    }
    normalized =
      digits.length > USER_PHONE_LENGTH
        ? digits.slice(-USER_PHONE_LENGTH)
        : digits;
    if (normalized.length !== USER_PHONE_LENGTH) {
      return Promise.reject(new Error("Phone number must be exactly 10 digits"));
    }
  }
  const otpStr = String(otp ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (!otpStr) {
    return Promise.reject(new Error("OTP is required"));
  }
  if (otpStr.length !== 4) {
    return Promise.reject(new Error("OTP must be exactly 4 digits"));
  }
  const refValue = typeof ref === "string" ? ref.trim() : "";
  return apiClient.post(AUTH.USER_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(refValue ? { ref: refValue } : {}),
    ...(name ? { name } : {}),
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}

/**
 * Admin login (email + password).
 * Validation: email required and valid format, password required and min 6 characters.
 * Backend returns { accessToken, refreshToken, user } (key is "user" not "admin").
 */
export function adminLogin(email, password, roleId) {
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  if (!trimmedEmail) {
    return Promise.reject(new Error("Email or Employee ID is required"));
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const empIdRegex = /^EMPL\d+$/i;
  if (!emailRegex.test(trimmedEmail) && !empIdRegex.test(trimmedEmail)) {
    if (trimmedEmail.length < 3) {
      return Promise.reject(new Error("Please enter a valid Email Address or Employee ID"));
    }
  }
  const passwordStr = String(password ?? "");
  if (!passwordStr) {
    return Promise.reject(new Error("Password is required"));
  }
  if (passwordStr.length < 6) {
    return Promise.reject(new Error("Password must be at least 6 characters"));
  }
  return apiClient.post(AUTH.ADMIN_LOGIN, {
    email: trimmedEmail,
    password: passwordStr,
    ...(roleId ? { roleId } : {}),
  });
}

/**
 * Refresh access token.
 * @param {string} refreshToken
 * @returns {Promise<{ data }>} data.accessToken
 */
export function refreshToken(refreshToken) {
  if (!refreshToken)
    return Promise.reject(new Error("Refresh token is required"));
  return apiClient.post(AUTH.REFRESH_TOKEN, { refreshToken });
}

/**
 * Logout (invalidate refresh token).
 * @param {string} refreshToken
 * @param {string} fcmToken
 * @param {string} platform
 */
export function logout(refreshToken, fcmToken = null, platform = "web") {
  if (!refreshToken) return Promise.resolve({ data: { success: true } });

  const payload = { refreshToken };
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }

  return postAuthWithRetry(() => apiClient.post(AUTH.LOGOUT, payload));
}

/**
 * Logout from all devices (invalidate all refresh tokens for this user).
 * @param {string} refreshToken
 * @param {string} fcmToken
 * @param {string} platform
 */
export function logoutAll(refreshToken, fcmToken = null, platform = "web") {
  if (!refreshToken) return Promise.resolve({ data: { success: true } });

  const payload = { refreshToken };
  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.platform = platform;
  }

  return apiClient.post(AUTH.LOGOUT_ALL, payload);
}

/**
 * Get current profile (requires Bearer).
 * @param {string} [module] - "user" | "admin" | "restaurant" | "delivery" (which token to send; default "user")
 */
export function getMe(module = "user") {
  const m = String(module || "user");
  // Deduplicate /me calls to avoid request storms (and accidental 429s)
  // across multiple components mounting at once.
  return getMeOnce(m);
}

// ---- /me in-flight + short cache (per module) ----
const ME_CACHE_MS = 3000;
const meCache = new Map(); // module -> { at, res }
const meInFlight = new Map(); // module -> Promise

function hasAccessToken(module) {
  try {
    return Boolean(getAccessTokenForModule(module));
  } catch {
    return false;
  }
}

function getAccessTokenForModule(module) {
  try {
    if (module === "user") {
      return (
        localStorage.getItem("user_accessToken") ||
        localStorage.getItem("auth_customer") ||
        localStorage.getItem("accessToken") ||
        null
      );
    }

    return localStorage.getItem(`${module}_accessToken`);
  } catch {
    return null;
  }
}

// module -> { at, backoffUntil }
const meBackoff = new Map();
const BACKOFF_MS = 10000; // 10s wait on 429

function getMeOnce(module) {
  const now = Date.now();
  const currentToken = getAccessTokenForModule(module);
  const cacheKey = `${module}:${currentToken || "no-token"}`;
  
  // 1. Check Backoff (e.g. from previous 429)
  const backoff = meBackoff.get(cacheKey);
  if (backoff && now < backoff) {
    return Promise.reject(new Error("Rate limited. Retrying too soon."));
  }

  // 2. Check Cache
  const cached = meCache.get(cacheKey);
  if (cached && now - cached.at < ME_CACHE_MS) {
    return Promise.resolve(cached.res);
  }

  // 3. Check Auth Status
  if (!hasAccessToken(module)) {
    return Promise.reject(new Error("Not authenticated"));
  }

  // 4. Return In-Flight Promise
  const existing = meInFlight.get(cacheKey);
  if (existing) return existing;

  const p = apiClient
    .get(AUTH.ME, { contextModule: module })
    .then((res) => {
      meCache.set(cacheKey, { at: Date.now(), res });
      return res;
    })
    .catch((err) => {
      if (err?.response?.status === 429) {
        meBackoff.set(cacheKey, Date.now() + BACKOFF_MS);
      }
      throw err;
    })
    .finally(() => {
      meInFlight.delete(cacheKey);
    });

  meInFlight.set(cacheKey, p);
  return p;
}

/**
 * Restaurant OTP auth (backend: same phone format as user, 4-digit OTP e.g. 1234).
 */
export function requestRestaurantOtp(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) {
    return Promise.reject(new Error("Phone must be at least 8 digits"));
  }
  return apiClient.post(AUTH.RESTAURANT_REQUEST_OTP, { phone: normalized });
}

export function verifyRestaurantOtp(phone, otp, fcmToken = null, platform = "web") {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp).replace(/\D/g, "").slice(0, 6);
  if (!normalized || otpStr.length < 4) {
    return Promise.reject(new Error("Phone and 4-digit OTP are required"));
  }
  return apiClient.post(AUTH.RESTAURANT_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}

/**
 * Delivery partner OTP auth (backend: same phone + 4-digit OTP).
 */
export function requestDeliveryOtp(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) {
    return Promise.reject(new Error("Phone must be at least 8 digits"));
  }
  return apiClient.post(AUTH.DELIVERY_REQUEST_OTP, { phone: normalized });
}

export function verifyDeliveryOtp(phone, otp, fcmToken = null, platform = "web") {
  const normalized = normalizePhone(phone);
  const otpStr = String(otp).replace(/\D/g, "").slice(0, 6);
  if (!normalized || otpStr.length < 4) {
    return Promise.reject(new Error("Phone and 4-digit OTP are required"));
  }
  return apiClient.post(AUTH.DELIVERY_VERIFY_OTP, {
    phone: normalized,
    otp: otpStr,
    ...(fcmToken ? { fcmToken, platform } : {}),
  });
}

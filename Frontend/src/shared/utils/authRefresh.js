/**
 * Shared refresh-token flow for every axios client in the app.
 *
 * The backend rotates refresh tokens on each use and revokes the whole token
 * family when an already-rotated token is replayed, so two clients refreshing
 * in parallel would end the session instead of extending it. Every refresh
 * therefore goes through a single in-flight promise per module.
 */

import axios from "axios";

const API_BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

/** Legacy keys holding a copy of the same access token (written by setAuthData). */
const ACCESS_TOKEN_MIRRORS = {
  admin: ["auth_admin", "adminToken"],
  user: ["auth_customer", "accessToken", "token"],
  delivery: ["auth_delivery"],
  restaurant: [],
};

/** core/api/axios names modules after routes; map those onto the storage modules. */
const MODULE_ALIASES = { customer: "user" };

export function normalizeAuthModule(module) {
  const name = String(module || "").toLowerCase();
  return MODULE_ALIASES[name] || name;
}

export function getStoredRefreshToken(module) {
  const name = normalizeAuthModule(module);
  try {
    return (
      localStorage.getItem(`${name}_refreshToken`) ||
      (name === "user" ? localStorage.getItem("refreshToken") : null)
    );
  } catch {
    return null;
  }
}

/** Write new tokens to the module keys *and* every mirror key other modules read. */
export function persistRefreshedTokens(module, accessToken, refreshToken) {
  const name = normalizeAuthModule(module);
  try {
    localStorage.setItem(`${name}_accessToken`, accessToken);
    (ACCESS_TOKEN_MIRRORS[name] || []).forEach((key) => localStorage.setItem(key, accessToken));
    if (refreshToken) {
      localStorage.setItem(`${name}_refreshToken`, refreshToken);
      if (name === "user") localStorage.setItem("refreshToken", refreshToken);
    }
  } catch {
    // storage can be blocked in private mode / WebViews
  }
}

const pendingRefreshes = new Map();

async function requestNewTokens(module) {
  const refreshToken = getStoredRefreshToken(module);
  if (!refreshToken) return null;

  const url = API_BASE_URL
    ? `${API_BASE_URL}/food/auth/refresh-token`
    : "/api/v1/food/auth/refresh-token";

  try {
    // Plain axios so the shared clients' interceptors cannot re-enter this.
    const { data } = await axios.post(url, { refreshToken }, { timeout: 10000 });
    const accessToken = data?.data?.accessToken || data?.accessToken;
    if (!accessToken) return null;

    persistRefreshedTokens(module, accessToken, data?.data?.refreshToken || data?.refreshToken);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("authRefreshed", { detail: { module, token: accessToken } })
      );
    }
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Exchange the module's refresh token for a new access token.
 * Resolves to the new access token, or null when the session cannot be recovered.
 * Concurrent callers share one network round-trip.
 */
export function refreshModuleSession(module) {
  const name = normalizeAuthModule(module);
  const inFlight = pendingRefreshes.get(name);
  if (inFlight) return inFlight;

  const request = requestNewTokens(name);
  pendingRefreshes.set(name, request);
  request.finally(() => {
    if (pendingRefreshes.get(name) === request) pendingRefreshes.delete(name);
  });
  return request;
}

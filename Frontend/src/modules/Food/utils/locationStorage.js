export const USER_LOCATION_STORAGE_KEY = "userLocation"
export const LOCATION_PROMPT_DISMISS_KEY = "locationPromptDismissed_v2"
export const LOCATION_PROMPT_AFTER_LOGIN_KEY = "food_show_location_prompt"

export function hasValidCoordinates(location) {
  if (!location || typeof location !== "object") return false
  const lat = Number(location.latitude)
  const lng = Number(location.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function parseStoredUserLocation(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return hasValidCoordinates(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function readStoredUserLocation() {
  if (typeof window === "undefined") return null
  try {
    return parseStoredUserLocation(
      localStorage.getItem(USER_LOCATION_STORAGE_KEY),
    )
  } catch {
    return null
  }
}

export async function queryGeolocationPermission() {
  if (typeof window === "undefined" || !navigator.permissions?.query) {
    return "prompt"
  }
  try {
    const result = await navigator.permissions.query({ name: "geolocation" })
    return result.state
  } catch {
    return "prompt"
  }
}

/**
 * Whether the custom location modal should be hidden.
 * Session dismiss always wins. Permanent dismiss is ignored while the browser
 * permission is still "prompt" (e.g. user cleared site settings).
 */
export function isLocationPromptDismissed(permissionState = "unknown") {
  if (typeof window === "undefined") return false
  if (sessionStorage.getItem(LOCATION_PROMPT_DISMISS_KEY) === "true") {
    return true
  }
  if (permissionState === "prompt" || permissionState === "unknown") {
    return false
  }
  return localStorage.getItem(LOCATION_PROMPT_DISMISS_KEY) === "true"
}

export function dismissLocationPromptForSession() {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LOCATION_PROMPT_DISMISS_KEY, "true")
}

export function dismissLocationPromptPermanently() {
  if (typeof window === "undefined") return
  localStorage.setItem(LOCATION_PROMPT_DISMISS_KEY, "true")
}

export function clearSessionLocationPromptDismiss() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(LOCATION_PROMPT_DISMISS_KEY)
}

export function markLocationPromptAfterLogin() {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LOCATION_PROMPT_AFTER_LOGIN_KEY, "1")
  sessionStorage.removeItem(LOCATION_PROMPT_DISMISS_KEY)
}

export function peekLocationPromptAfterLogin() {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(LOCATION_PROMPT_AFTER_LOGIN_KEY) === "1"
}

export function clearLocationPromptAfterLogin() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(LOCATION_PROMPT_AFTER_LOGIN_KEY)
}

/** @deprecated Use peek + clear separately to avoid race on effect re-runs */
export function consumeLocationPromptAfterLogin() {
  const pending = peekLocationPromptAfterLogin()
  if (pending) clearLocationPromptAfterLogin()
  return pending
}

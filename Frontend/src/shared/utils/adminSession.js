import { toast } from "sonner";

export const ADMIN_SESSION_EXPIRED_KEY = "adminAuthLogoutReason";
export const ADMIN_SESSION_EXPIRED_TITLE = "Session expired";
export const ADMIN_SESSION_EXPIRED_MESSAGE =
  "Your admin session has expired. Please log in again to continue.";

const ADMIN_AUTH_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/signup"];

let adminRedirectInFlight = false;

export function markAdminSessionExpired(reason = "session_expired") {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ADMIN_SESSION_EXPIRED_KEY, reason);
  } catch {
    // sessionStorage can be blocked in some WebViews
  }
}

export function consumeAdminSessionExpired() {
  if (typeof window === "undefined") return null;
  try {
    const reason = sessionStorage.getItem(ADMIN_SESSION_EXPIRED_KEY);
    if (reason) sessionStorage.removeItem(ADMIN_SESSION_EXPIRED_KEY);
    return reason;
  } catch {
    return null;
  }
}

export function isAdminAuthPath(pathname = "") {
  return ADMIN_AUTH_PATHS.some((path) => String(pathname || "").includes(path));
}

export function notifyAdminSessionExpired(reason = "session_expired") {
  markAdminSessionExpired(reason);
  if (typeof window === "undefined") return;
  toast.error(ADMIN_SESSION_EXPIRED_TITLE, {
    description: ADMIN_SESSION_EXPIRED_MESSAGE,
    duration: 5000,
  });
  window.dispatchEvent(new CustomEvent("adminSessionExpired", { detail: { reason } }));
}

export function redirectAdminToLogin(reason = "session_expired") {
  if (typeof window === "undefined") return;
  if (isAdminAuthPath(window.location.pathname) || adminRedirectInFlight) {
    markAdminSessionExpired(reason);
    return;
  }

  adminRedirectInFlight = true;
  notifyAdminSessionExpired(reason);

  window.setTimeout(() => {
    window.location.assign("/admin/login");
  }, 1600);
}

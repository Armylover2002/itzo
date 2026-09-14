import { Navigate, useLocation } from "react-router-dom";
import {
  getModuleRefreshToken,
  getModuleToken,
  hasModuleSession,
  isModuleAuthenticated,
  isTokenExpired,
} from "@food/utils/auth";
import { markAdminSessionExpired } from "@/shared/utils/adminSession";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath = "/user/auth/login" }) {
  const location = useLocation();

  // If no role required, allow access
  if (!requiredRole) {
    return children;
  }

  const isAuthenticated =
    requiredRole === "admin"
      ? hasModuleSession("admin")
      : isModuleAuthenticated(requiredRole);

  // If not authenticated for this module, redirect to login
  if (!isAuthenticated) {
    let sessionExpired = false;
    if (requiredRole === "admin") {
      const token = getModuleToken("admin");
      if (token && isTokenExpired(token)) {
        markAdminSessionExpired("session_expired");
        sessionExpired = true;
      }
    }

    return (
      <Navigate
        to={loginPath}
        state={{
          from: location.pathname,
          sessionExpired,
        }}
        replace
      />
    );
  }

  return children;
}

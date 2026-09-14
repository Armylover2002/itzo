/**
 * @deprecated Import from `@food/utils/auth` instead.
 * Re-exports the canonical auth utilities for backward compatibility.
 */
export {
  decodeToken,
  getRoleFromToken,
  isTokenExpired,
  getUserIdFromToken,
  hasModuleAccess,
  getModuleToken,
  getModuleRefreshToken,
  getCurrentUserRole,
  getCurrentUser,
  syncRestaurantStoredUser,
  updateStoredModuleUser,
  isRestaurantPendingApproval,
  isModuleAuthenticated,
  hasModuleSession,
  clearModuleAuth,
  clearUserSession,
  clearRestaurantSessionCache,
  setRestaurantPendingPhone,
  getRestaurantPendingPhone,
  clearRestaurantPendingPhone,
  clearAuthData,
  setAuthData,
} from "@food/utils/auth";

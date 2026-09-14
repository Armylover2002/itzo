/**
 * JWT Token Utilities
 * Decode and extract information from JWT tokens
 */

import { clearOnboardingDraft } from "@food/utils/onboardingDraftStorage"
import { isRestaurantInitialPendingApproval } from "@food/utils/restaurantApproval"

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url encoded payload
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Get user role from token
 * @param {string} token - JWT token
 * @returns {string|null} - User role or null if not found
 */
export function getRoleFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if expired or invalid
 */
export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  return decoded.exp * 1000 < Date.now();
}

/**
 * Get user ID from token
 * @param {string} token - JWT token
 * @returns {string|null} - User ID or null if not found
 */
export function getUserIdFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.userId || decoded?.id || null;
}

/**
 * Check if user has access to a module based on role
 * @param {string} role - User role
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if user has access
 */
export function hasModuleAccess(role, module) {
  const roleModuleMap = {
    'admin': 'admin',
    'restaurant': 'restaurant',
    'delivery': 'delivery',
    'user': 'user'
  };

  return roleModuleMap[role] === module;
}

/**
 * Get module-specific access token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Access token or null
 */
export function getModuleToken(module) {
  return localStorage.getItem(`${module}_accessToken`);
}

/**
 * Get module-specific refresh token (fallback for WebView environments where cookies may be unreliable)
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Refresh token or null
 */
export function getModuleRefreshToken(module) {
  return localStorage.getItem(`${module}_refreshToken`);
}

/**
 * Get current user's role from a specific module's storage/token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Current user role or null
 */
export function getCurrentUserRole(module = null) {
  if (module) {
    const userStr = localStorage.getItem(`${module}_user`);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.role || module;
      } catch (e) {
        return module;
      }
    }
  }
  return module || 'user';
}

/**
 * Get current user object from specific module's storage
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {Object|null} - User object or null
 */
export function getCurrentUser(module) {
  if (!module) return null;
  const userStr = localStorage.getItem(`${module}_user`);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

/**
 * Refresh cached restaurant profile after server-side approval/status changes.
 */
export function syncRestaurantStoredUser(restaurant) {
  if (!restaurant) return;
  const token = getModuleToken("restaurant");
  if (!token) return;
  const refreshToken = getModuleRefreshToken("restaurant");
  setAuthData("restaurant", token, restaurant, refreshToken);
}

export function updateStoredModuleUser(module, user) {
  if (!module || !user) return;
  try {
    localStorage.setItem(`${module}_user`, JSON.stringify(user));
  } catch {
    // Ignore storage failures
  }
}

export function isRestaurantPendingApproval(user) {
  const status = String(user?.status || "").toLowerCase()
  return isRestaurantInitialPendingApproval(user) || status === "rejected"
}

/**
 * Check if user is authenticated for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if authenticated
 */
export function isModuleAuthenticated(module) {
  const token = getModuleToken(module);
  return !!token && !isTokenExpired(token);
}

/**
 * Check if user has a session (even if token is expired, but refresh token exists)
 * This helps ProtectedRoute allow the page to load and let axios handle background refresh.
 * @param {string} module - Module name
 * @returns {boolean} - True if session exists
 */
export function hasModuleSession(module) {
  const token = getModuleToken(module);
  const refreshToken = localStorage.getItem(`${module}_refreshToken`);
  
  // If we have a token that's NOT expired, we're definitely authenticated.
  if (!!token && !isTokenExpired(token)) return true;
  
  // If we have a refresh token, we might be able to recover the session.
  if (!!refreshToken) return true;
  
  return false;
}

/**
 * Clear authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 */
export function clearModuleAuth(module) {
  localStorage.removeItem(`${module}_accessToken`);
  localStorage.removeItem(`${module}_refreshToken`);
  localStorage.removeItem(`${module}_authenticated`);
  localStorage.removeItem(`${module}_user`);
  if (module === "admin") {
    localStorage.removeItem("auth_admin");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminInfo");
  }
  if (module === "user") {
    localStorage.removeItem("auth_customer");
    localStorage.removeItem("accessToken");
    clearUserSession();
  }
  // Clear cached FCM web token for this module (after logout has already used it)
  localStorage.removeItem(`fcm_web_registered_token_${module}`);
  localStorage.removeItem(`fcm_web_registered_owner_${module}`);
  if (module === "restaurant") {
    clearRestaurantSessionCache();
    sessionStorage.removeItem("restaurantReonboard");
    sessionStorage.removeItem("restaurant_registrationToken");
  }
  if (module === "seller") {
    sessionStorage.removeItem("sellerReonboard");
  }
  if (module === "delivery") {
    localStorage.removeItem("auth_delivery");
    sessionStorage.removeItem("deliveryIsRejected");
  }
  // Also clear any sessionStorage data
  sessionStorage.removeItem(`${module}AuthData`);
}

/**
 * Clear user-specific profile/session caches to prevent cross-account leakage.
 */
export function clearUserSession() {
  const keys = [
    "userProfile",
    "user_user",
    "user",
    "user_edit_profile_draft",
    "userAddresses",
    "userPaymentMethods",
    "userFavorites",
    "userDishFavorites",
  ];

  keys.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear restaurant-local cached UI data to prevent cross-account stale state.
 */
export function clearRestaurantSessionCache() {
  const keys = [
    "restaurant_owner_contact",
    "restaurant_onboarding",
    "restaurant_onboarding_data",
    "restaurant_invited_users",
    "restaurant_schedule_off",
    "restaurant_online_status",
    "restaurant_outlet_timings",
    "restaurant_hub_menu_active_tab",
    "restaurant_name",
    "restaurantName",
    "restaurant_pendingPhone",
  ];

  keys.forEach((key) => localStorage.removeItem(key));

  void clearOnboardingDraft();
}

export function setRestaurantPendingPhone(phone) {
  if (typeof localStorage === "undefined") return;
  if (!phone) {
    localStorage.removeItem("restaurant_pendingPhone");
    return;
  }
  const digits = String(phone).replace(/\D/g, "").slice(-10);
  localStorage.setItem("restaurant_pendingPhone", digits || String(phone).trim());
}

export function getRestaurantPendingPhone() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("restaurant_pendingPhone");
}

export function clearRestaurantPendingPhone() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("restaurant_pendingPhone");
}

/**
 * Clear all authentication data for all modules
 */
export function clearAuthData() {
  const modules = ['admin', 'restaurant', 'delivery', 'user'];
  modules.forEach(module => {
    clearModuleAuth(module);
  });
  // Also clear legacy token if it exists
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

/**
 * Set authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @param {string} token - Access token
 * @param {Object} user - User data
 * @param {string|null} refreshToken - Optional refresh token
 * @throws {Error} If localStorage is not available or quota exceeded
 */
export function setAuthData(module, token, user, refreshToken = null) {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined' || !localStorage) {
      throw new Error('localStorage is not available');
    }

    // Validate inputs
    if (!module || !token) {
      throw new Error(`Invalid parameters: module=${module}, token=${!!token}`);
    }

    console.log(`[setAuthData] Storing auth for module: ${module}`, {
      hasToken: !!token,
      tokenLength: token?.length,
      hasUser: !!user
    });

    // Store module-specific token (don't clear other modules)
    const tokenKey = `${module}_accessToken`;
    const refreshTokenKey = `${module}_refreshToken`;
    const authKey = `${module}_authenticated`;
    const userKey = `${module}_user`;

    // Prevent stale restaurant profile data from previous account after re-login.
    if (module === "restaurant") {
      clearRestaurantSessionCache();
    } else if (module === "user") {
      clearUserSession();
    }

    localStorage.setItem(tokenKey, token);

    if (module === "admin") {
      localStorage.setItem("auth_admin", token);
      localStorage.setItem("adminToken", token);
      if (user) {
        localStorage.setItem("adminInfo", JSON.stringify(user));
      }
    }
    if (module === "user") {
      localStorage.setItem("auth_customer", token);
      localStorage.setItem("accessToken", token);
      localStorage.setItem("token", token);
    }
    if (module === "delivery") {
      localStorage.setItem("auth_delivery", token);
    }
    if (refreshToken && typeof refreshToken === "string") {
      localStorage.setItem(refreshTokenKey, refreshToken);
    }
    localStorage.setItem(authKey, 'true');
    
    if (user) {
      try {
        localStorage.setItem(userKey, JSON.stringify(user));
        if (module === "user") {
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch (userError) {
        console.warn('Failed to store user data, but token was stored:', userError);
        // Don't throw - token storage is more important
      }
    }

    // Verify the token was stored correctly
    const storedToken = localStorage.getItem(tokenKey);
    const storedAuth = localStorage.getItem(authKey);
    
    if (storedToken !== token) {
      console.error(`[setAuthData] Token mismatch:`, {
        expected: token?.substring(0, 20) + '...',
        stored: storedToken?.substring(0, 20) + '...'
      });
      throw new Error(`Token storage verification failed for module: ${module}`);
    }

    if (storedAuth !== 'true') {
      console.error(`[setAuthData] Auth flag mismatch:`, {
        expected: 'true',
        stored: storedAuth
      });
      throw new Error(`Authentication flag storage failed for module: ${module}`);
    }

    console.log(`[setAuthData] Successfully stored auth data for ${module}`);
  } catch (error) {
    // If quota exceeded, try to clear some space
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded. Attempting to clear old data...');
      // Clear legacy tokens
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        if (module === "user") {
          clearUserSession();
        }
        // Retry storing
        localStorage.setItem(`${module}_accessToken`, token);
        if (module === "admin") {
          localStorage.setItem("auth_admin", token);
          localStorage.setItem("adminToken", token);
          if (user) {
            localStorage.setItem("adminInfo", JSON.stringify(user));
          }
        }
        if (module === "user") {
          localStorage.setItem("auth_customer", token);
          localStorage.setItem("accessToken", token);
          localStorage.setItem("token", token);
        }
        if (refreshToken && typeof refreshToken === "string") {
          localStorage.setItem(`${module}_refreshToken`, refreshToken);
        }
        localStorage.setItem(`${module}_authenticated`, 'true');
        if (user) {
          localStorage.setItem(`${module}_user`, JSON.stringify(user));
          if (module === "user") {
            localStorage.setItem("user", JSON.stringify(user));
          }
        }
        
        // Verify again after retry
        const storedToken = localStorage.getItem(`${module}_accessToken`);
        if (storedToken !== token) {
          throw new Error('Token storage failed even after clearing space');
        }
      } catch (retryError) {
        console.error('Failed to store auth data after clearing space:', retryError);
        throw new Error('Unable to store authentication data. Please clear browser storage and try again.');
      }
    } else {
      console.error('[setAuthData] Error storing auth data:', error);
      throw error;
    }
  }
}

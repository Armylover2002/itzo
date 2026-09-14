import React, { createContext, useContext, useState, useEffect } from 'react';
import { getWithDedupe } from '@core/api/dedupe';
import { isTokenExpired } from '@core/utils/token';
import { useAuthStore } from '../auth/auth.store';
import { clearSellerOnboardingDraft } from '../../modules/seller/utils/onboardingDraft';
import { clearSellerProductAddDraft } from '../../modules/seller/utils/productAddDraft';
import { markSellerLiveSession } from '../../modules/seller/utils/sellerSession';

const AuthContext = createContext(undefined);

const ROLE_STORAGE_KEYS = {
    customer: 'auth_customer',
    seller: 'auth_seller',
    admin: 'auth_admin',
    delivery: 'auth_delivery'
};

const LEGACY_ROLE_STORAGE_KEYS = {
    customer: ['user_accessToken', 'accessToken'],
    seller: ['seller_accessToken'],
    admin: ['admin_accessToken'],
    delivery: ['delivery_accessToken']
};

const extractProfilePayload = (response) => {
    const raw = response?.data?.result ?? response?.data?.data ?? null;
    if (raw && typeof raw === 'object' && raw.user) {
        return raw.user;
    }
    return raw;
};

const persistSellerUser = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    try {
        localStorage.setItem('seller_user', JSON.stringify(payload));
    } catch {
        // ignore quota / private mode
    }
};

const getProfileEndpoint = (role) => {
    if (role === 'seller') return '/seller/profile';
    return '/auth/me';
};

export const AuthProvider = ({ children }) => {
    // HashRouter (mobile WebView) keeps the app path in the hash, not pathname.
    const getLocationPath = () => {
        const hashPath = String(window.location.hash || '').replace(/^#/, '').split('?')[0];
        if (hashPath.startsWith('/')) return hashPath;
        return window.location.pathname;
    };

    // Current role based on URL (align with RouteGuard MODULE_ROUTES)
    const getCurrentRoleFromUrl = (path) => {
        if (path.startsWith('/seller')) return 'seller';
        if (path.startsWith('/ecs')) return 'admin';
        if (path.startsWith('/food/delivery') || path.startsWith('/delivery')) return 'delivery';
        return 'customer';
    };

    const isPublicAuthPath = (path) =>
        path.includes('/auth/') ||
        path.includes('/login') ||
        path.includes('/signup') ||
        path.includes('/otp') ||
        path.includes('/verification') ||
        path.includes('/welcome');

    const getSafeToken = (key) => {
        const val = localStorage.getItem(ROLE_STORAGE_KEYS[key]);
        const fallbackVal =
            val ||
            LEGACY_ROLE_STORAGE_KEYS[key]?.map((storageKey) => localStorage.getItem(storageKey)).find(Boolean) ||
            null;
        if (!fallbackVal) return null;
        const normalizedVal = fallbackVal;
        if (normalizedVal.startsWith('{')) {
            try { return JSON.parse(normalizedVal).token; } catch { return normalizedVal; }
        }
        return normalizedVal;
    };

    const [currentPath, setCurrentPath] = useState(getLocationPath());

    const [authData, setAuthData] = useState({
        customer: getSafeToken('customer'),
        seller: getSafeToken('seller'),
        admin: getSafeToken('admin'),
        delivery: getSafeToken('delivery'),
    });

    const currentRole = getCurrentRoleFromUrl(currentPath);
    const [user, setUser] = useState(null);
    const token = authData[currentRole];
    const [isLoading, setIsLoading] = useState(Boolean(authData[currentRole]));
    const isAuthenticated = !!token && !isTokenExpired(token);

    // Sync auth tokens on custom login events or cross-tab/storage changes, and track URL path changes since Provider is mounted outside Router
    useEffect(() => {
        const syncAuthData = () => {
            setAuthData({
                customer: getSafeToken('customer'),
                seller: getSafeToken('seller'),
                admin: getSafeToken('admin'),
                delivery: getSafeToken('delivery'),
            });
        };

        const handlePathChange = () => {
            setCurrentPath(getLocationPath());
        };

        // Custom events sent from login pages
        window.addEventListener('storage', syncAuthData);
        window.addEventListener('userAuthChanged', syncAuthData);
        window.addEventListener('restaurantAuthChanged', syncAuthData);
        window.addEventListener('adminAuthChanged', syncAuthData);
        window.addEventListener('deliveryAuthChanged', syncAuthData);
        window.addEventListener('sellerAuthChanged', syncAuthData);

        // Track navigation changes reactively
        window.addEventListener('popstate', handlePathChange);
        window.addEventListener('hashchange', handlePathChange);

        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;

        window.history.pushState = function (...args) {
            originalPushState.apply(this, args);
            handlePathChange();
        };

        window.history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            handlePathChange();
        };

        return () => {
            window.removeEventListener('storage', syncAuthData);
            window.removeEventListener('userAuthChanged', syncAuthData);
            window.removeEventListener('restaurantAuthChanged', syncAuthData);
            window.removeEventListener('adminAuthChanged', syncAuthData);
            window.removeEventListener('deliveryAuthChanged', syncAuthData);
            window.removeEventListener('sellerAuthChanged', syncAuthData);

            window.removeEventListener('popstate', handlePathChange);
            window.removeEventListener('hashchange', handlePathChange);

            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
        };
    }, []);

    // Fetch user profile on mount / token / role change.
    // Do NOT refetch on every in-module path change (e.g. /seller/onboarding → /seller/pending);
    // those pages share the same role token and would otherwise spam `/seller/profile`.
    // Re-run when leaving a public auth path so a fresh login lands on a loaded profile.
    const onPublicAuthPath = isPublicAuthPath(currentPath);
    useEffect(() => {
        const fetchProfile = async () => {
            if (onPublicAuthPath) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (token) {
                setIsLoading(true);
                try {
                    // Use deduplicated fetch to avoid multiple simultaneous profile calls.
                    // Auth is attached by the axios interceptor — do not pass headers here
                    // or the dedupe cache key won't match sellerApi.getProfile().
                    const response = await getWithDedupe(
                        getProfileEndpoint(currentRole),
                        {},
                        { ttl: 5000, contextModule: currentRole }
                    );
                    const payload = extractProfilePayload(response);
                    setUser(payload);
                    if (currentRole === 'seller') persistSellerUser(payload);
                    useAuthStore.getState().setAuth(payload, token, currentRole);
                } catch (error) {
                    console.error('Failed to fetch profile:', error);
                    // If 401, axios interceptor will handle it
                } finally {
                    setIsLoading(false);
                }
            } else {
                setUser(null);
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [token, currentRole, onPublicAuthPath]);

    const login = (userData) => {
        const role = userData.role?.toLowerCase() || 'customer';
        const storageKey = ROLE_STORAGE_KEYS[role];

        if (storageKey && userData.token) {
            // Save ONLY the token string as requested by the user
            localStorage.setItem(storageKey, userData.token);

            setAuthData(prev => ({ ...prev, [role]: userData.token }));
            setUser(userData); // Set full data initially
            if (role === 'seller') {
                markSellerLiveSession();
                persistSellerUser(userData);
            }
        } else {
            console.error('Invalid role or missing token for login:', role);
        }
    };

    const logout = ({ keepSellerOnboardingDraft = false } = {}) => {
        // Clear all role-specific tokens from localStorage
        Object.values(ROLE_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        Object.values(LEGACY_ROLE_STORAGE_KEYS).flat().forEach(key => {
            localStorage.removeItem(key);
        });

        const path = window.location.pathname;
        const hashPath = String(window.location.hash || '').replace(/^#/, '');

        // Also clear common/compat keys used by older module code.
        localStorage.removeItem('token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminInfo');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        ['admin', 'seller', 'delivery', 'user'].forEach((module) => {
            localStorage.removeItem(`${module}_accessToken`);
            localStorage.removeItem(`${module}_refreshToken`);
            localStorage.removeItem(`${module}_authenticated`);
            localStorage.removeItem(`${module}_user`);
        });

        // Keep the phone-keyed registration draft when quitting / cold-starting
        // so the same number can resume the last step after OTP.
        if (!keepSellerOnboardingDraft) {
            clearSellerOnboardingDraft();
        }
        clearSellerProductAddDraft();

        // Reset auth state for all roles to null
        setAuthData({
            customer: null,
            seller: null,
            admin: null,
            delivery: null,
        });

        // Clear the current user profile from memory
        setUser(null);

        // Final fallback: redirect based on current path if needed
        // (ProtectedRoute usually handles this, but explicit navigation is safer for some UI edge cases)
        if (path.startsWith('/ecs') || hashPath.startsWith('/ecs')) window.location.href = '/ecs/login';
        else if (path.startsWith('/seller') || hashPath.startsWith('/seller')) window.location.href = '/seller/auth';
        else if (path.startsWith('/delivery') || hashPath.startsWith('/delivery')) window.location.href = '/delivery/auth';
        else window.location.href = '/user/auth/login';
    };

    const refreshUser = async ({ forceRefresh = false } = {}) => {
        if (token) {
            try {
                const response = await getWithDedupe(
                    getProfileEndpoint(currentRole),
                    {},
                    { ttl: 5000, contextModule: currentRole, forceRefresh }
                );
                const payload = extractProfilePayload(response);
                setUser(payload);
                if (currentRole === 'seller') persistSellerUser(payload);
                useAuthStore.getState().setAuth(payload, token, currentRole);
                return payload;
            } catch (error) {
                console.error('Failed to refresh profile:', error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token, // Added token to context
            role: currentRole,
            isAuthenticated,
            isLoading,
            authData,
            login,
            logout,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

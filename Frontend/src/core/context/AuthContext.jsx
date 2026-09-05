import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axiosInstance from '@core/api/axios';
import { getWithDedupe } from '@core/api/dedupe';
import { isTokenExpired } from '@core/utils/token';

const AuthContext = createContext(undefined);

const ROLE_STORAGE_KEYS = {
    customer: 'auth_customer',
    seller: 'auth_seller',
    admin: 'auth_admin',
    delivery: 'auth_delivery',
    hrms: 'auth_hrms'
};

const LEGACY_ROLE_STORAGE_KEYS = {
    customer: ['user_accessToken'],
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

const getProfileEndpoint = (role) => {
    if (role === 'seller') return '/seller/profile';
    return '/auth/me';
};

export const AuthProvider = ({ children }) => {
    // Current role based on URL
    const getCurrentRoleFromUrl = () => {
        // In HashRouter mode (WebView), the route is in the hash, not pathname.
        // Check hash path first, then fall back to server pathname.
        const hash = window.location.hash || '';
        const hashPath = hash.startsWith('#') ? hash.substring(1) : '';
        const path = hashPath || window.location.pathname;
        if (path.startsWith('/seller')) return 'seller';
        if (path.startsWith('/ecs')) return 'admin';
        if (path.startsWith('/delivery')) return 'delivery';
        if (path.startsWith('/hrms')) return 'hrms';
        return 'customer';
    };

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

    const [authData, setAuthData] = useState({
        customer: getSafeToken('customer'),
        seller: getSafeToken('seller'),
        admin: getSafeToken('admin'),
        delivery: getSafeToken('delivery'),
        hrms: getSafeToken('hrms'),
    });

    useEffect(() => {
        const handleAuthChange = () => {
            setAuthData({
                customer: getSafeToken('customer'),
                seller: getSafeToken('seller'),
                admin: getSafeToken('admin'),
                delivery: getSafeToken('delivery'),
                hrms: getSafeToken('hrms'),
            });
        };

        window.addEventListener('userAuthChanged', handleAuthChange);
        // Also listen to storage events to sync across tabs if needed
        window.addEventListener('storage', handleAuthChange);

        return () => {
            window.removeEventListener('userAuthChanged', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, []);

    const currentRole = getCurrentRoleFromUrl();
    const [user, setUser] = useState(null);
    const token = authData[currentRole];
    const [isLoading, setIsLoading] = useState(Boolean(authData[currentRole]));
    const isAuthenticated = !!token && !isTokenExpired(token);

    // Fetch user profile on mount or token change
    useEffect(() => {
        const fetchProfile = async () => {
            if (token) {
                setIsLoading(true);
                try {
                    // Use deduplicated fetch to avoid multiple simultaneous profile calls
                    const requestConfig = { ttl: 5000, contextModule: currentRole };
                    if (token) {
                        requestConfig.headers = { Authorization: `Bearer ${token}` };
                    }
                    const response = await getWithDedupe(
                        getProfileEndpoint(currentRole),
                        {},
                        requestConfig
                    );
                    setUser(extractProfilePayload(response));
                } catch (error) {
                    if (error.response?.status === 404) {
                        console.warn(`Profile not found (404) for role: ${currentRole}`);
                    } else {
                        console.error('Failed to fetch profile:', error);
                    }
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

        // For customer sessions, validate session periodically and when tab becomes active
        // so that deactivated accounts are logged out in real-time
        let interval;
        if (token && currentRole === 'customer') {
            interval = setInterval(() => {
                if (!document.hidden) {
                    fetchProfile();
                }
            }, 15000);
        }

        const handleVisibility = () => {
            if (!document.hidden && token && currentRole === 'customer') {
                fetchProfile();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (interval) clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [token, currentRole]);

    const login = (userData) => {
        let role = userData.role?.toLowerCase() || 'customer';
        if (role === 'hrms_employee') role = 'hrms';
        const storageKey = ROLE_STORAGE_KEYS[role];

        if (storageKey && userData.token) {
            // Save ONLY the token string as requested by the user
            localStorage.setItem(storageKey, userData.token);

            setAuthData(prev => ({ ...prev, [role]: userData.token }));
            setUser(userData); // Set full data initially
        } else {
            console.error('Invalid role or missing token for login:', role);
        }
    };

    const logout = () => {
        // Clear all role-specific tokens from localStorage
        Object.values(ROLE_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        Object.values(LEGACY_ROLE_STORAGE_KEYS).flat().forEach(key => {
            localStorage.removeItem(key);
        });

        const path = window.location.pathname;

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

        // Reset auth state for all roles to null
        setAuthData({
            customer: null,
            seller: null,
            admin: null,
            delivery: null,
            hrms: null,
        });

        // Clear the current user profile from memory
        setUser(null);

        // Determine the correct login route for the current module
        // Use both hash path and server pathname for detection
        const hash = window.location.hash || '';
        const hashPath = hash.startsWith('#') ? hash.substring(1) : '';
        const effectivePath = hashPath || path;

        let logoutTarget;
        if (effectivePath.startsWith('/ecs')) logoutTarget = '/ecs/login';
        else if (effectivePath.startsWith('/seller')) logoutTarget = '/seller/auth';
        else if (effectivePath.startsWith('/delivery')) logoutTarget = '/delivery/auth';
        else if (effectivePath.startsWith('/hrms')) logoutTarget = '/hrms/login';
        else logoutTarget = '/user/auth/login';

        // Use hash navigation if in a native-like shell (HashRouter),
        // otherwise use standard navigation (BrowserRouter).
        const isHashRouter = Boolean(window.flutter_inappwebview) ||
            Boolean(window.ReactNativeWebView) ||
            String(window.location?.protocol || '').toLowerCase() === 'file:' ||
            String(window.navigator?.userAgent || '').toLowerCase().includes(' wv') ||
            String(window.navigator?.userAgent || '').toLowerCase().includes('; wv');

        if (isHashRouter) {
            window.location.hash = '#' + logoutTarget;
        } else {
            window.location.href = logoutTarget;
        }
    };

    const refreshUser = useCallback(async () => {
        if (token) {
            try {
                const response = await axiosInstance.get(getProfileEndpoint(currentRole));
                const payload = extractProfilePayload(response);
                setUser(payload);
                return payload;
            } catch (error) {
                if (error.response?.status === 404) {
                    console.warn(`Profile not found (404) for role: ${currentRole}`);
                } else {
                    console.error('Failed to refresh profile:', error);
                }
            }
        }
    }, [token, currentRole]);

    const contextValue = useMemo(() => ({
        user,
        token, // Added token to context
        role: currentRole,
        isAuthenticated,
        isLoading,
        authData,
        login,
        logout,
        refreshUser
    }), [user, token, currentRole, isAuthenticated, isLoading, authData, login, logout, refreshUser]);

    return (
        <AuthContext.Provider value={contextValue}>
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

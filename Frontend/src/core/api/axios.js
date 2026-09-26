import axios from 'axios';
import { isTokenExpired } from '@food/utils/auth';
import { redirectAdminToLogin } from '@/shared/utils/adminSession';

const pickCustomerToken = () => {
  const candidates = [
    localStorage.getItem('user_accessToken'),
    localStorage.getItem('auth_customer'),
    localStorage.getItem('accessToken'),
  ].filter((token) => token && token !== 'null' && token !== 'undefined');

  const valid = candidates.find((token) => !isTokenExpired(token));
  return valid || candidates[0] || null;
};

const pickDeliveryToken = () => {
  const candidates = [
    localStorage.getItem('delivery_accessToken'),
    localStorage.getItem('auth_delivery'),
    localStorage.getItem('token'),
  ].filter((token) => token && token !== 'null' && token !== 'undefined');

  const valid = candidates.find((token) => !isTokenExpired(token));
  return valid || candidates[0] || null;
};

const getAppPath = () => {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  if (hash.startsWith('/')) return hash;
  return window.location.pathname || '/';
};

const isDeliveryContext = (pagePath = '', url = '') => (
  pagePath.startsWith('/delivery')
  || pagePath.startsWith('/food/delivery')
  || url.startsWith('/delivery')
  || url.startsWith('/food/delivery')
);

const axiosInstance = axios.create({
    // Prefer env; fall back to Vite proxy path so local seller auth works without CORS/port issues.
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
    (config) => {
        let token = null;
        const url = config.url;
        const pagePath = getAppPath();

        // Determination strategy: 
        // 1. If we are on a module-specific page (e.g. /seller/dashboard), prioritize that module's token
        // This is crucial for shared APIs like /products or /admin/categories
        if (pagePath.startsWith('/seller')) {
            token = localStorage.getItem('auth_seller');
        } else if (pagePath.startsWith('/ecs')) {
            token = localStorage.getItem('auth_admin');
        } else if (pagePath.startsWith('/hrms')) {
            token = localStorage.getItem('auth_hrms');
        } else if (isDeliveryContext(pagePath, url)) {
            token = pickDeliveryToken();
        } else if (pagePath.startsWith('/customer') || pagePath.startsWith('/quick')) {
            token = pickCustomerToken();
        }

        // 2. Fallback to URL-based detection
        if (!token) {
            if (url.startsWith('/seller')) token = localStorage.getItem('auth_seller');
            else if (url.startsWith('/admin')) token = localStorage.getItem('auth_admin');
            else if (isDeliveryContext(pagePath, url)) token = pickDeliveryToken();
            else if (
              url.startsWith('/customer') ||
              url.startsWith('/quick-commerce') ||
              url.startsWith('/cart') ||
              url.startsWith('/wishlist') ||
              url.startsWith('/categories') ||
              url.startsWith('/products')
            ) {
                token = pickCustomerToken();
            }
        }

        // 3. Final default: if we are on a general page and STILL no token, try customer token
        if (!token && !pagePath.startsWith('/ecs') && !pagePath.startsWith('/seller') && !pagePath.startsWith('/hrms') && !isDeliveryContext(pagePath, url)) {
            token = pickCustomerToken();
        }

        // 3. Last fallback: Check common 'token' key if implemented
        if (!token) {
            token = localStorage.getItem('token');
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Let the browser set multipart boundary. A hardcoded Content-Type
        // (or the default application/json) makes multer throw Unexpected field.
        if (typeof FormData !== "undefined" && config.data instanceof FormData) {
            if (config.headers && typeof config.headers.delete === "function") {
                config.headers.delete("Content-Type");
            } else if (config.headers) {
                delete config.headers["Content-Type"];
                delete config.headers["content-type"];
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const requestUrl = String(originalRequest?.url || '');
            // Skip redirect for authentication endpoints to allow components to handle invalid credentials/OTP
            if (requestUrl.includes('/auth/')) {
                return Promise.reject(error);
            }

            // Only reload when we had a token that's now invalid (expired/logged out elsewhere).
            // If no token exists, skip reload to avoid infinite loop on public pages.
            const hasToken = ['auth_seller', 'auth_admin', 'auth_delivery', 'auth_customer', 'user_accessToken', 'accessToken', 'token'].some(
                (key) => localStorage.getItem(key)
            );
            if (!hasToken) {
                return Promise.reject(error);
            }
            const path = window.location.pathname;
            const currentModule = path.startsWith('/seller')
                ? 'seller'
                : path.startsWith('/ecs')
                    ? 'admin'
                    : (path.startsWith('/delivery') || path.startsWith('/food/delivery'))
                        ? 'delivery'
                        : 'customer';
            const requestModule = requestUrl.startsWith('/seller')
                ? 'seller'
                : requestUrl.startsWith('/admin')
                    ? 'admin'
                    : (requestUrl.startsWith('/delivery') || requestUrl.startsWith('/food/delivery'))
                        ? 'delivery'
                        : requestUrl.startsWith('/user') || requestUrl.startsWith('/customer') || requestUrl.startsWith('/auth')
                            ? 'customer'
                            : null;

            // Prevent cross-module 401s from logging out the active session
            // (e.g. seller page accidentally calling an admin endpoint).
            if (requestModule && requestModule !== currentModule) {
                return Promise.reject(error);
            }

            const moduleStorageKeys = {
                seller: ['auth_seller', 'seller_accessToken', 'token'],
                admin: ['auth_admin', 'admin_accessToken', 'token'],
                delivery: ['auth_delivery', 'delivery_accessToken', 'token'],
                customer: ['auth_customer', 'user_accessToken', 'accessToken', 'token'],
            };
            const keysToClear = moduleStorageKeys[currentModule] || ['token'];
            keysToClear.forEach((key) => localStorage.removeItem(key));

            if (currentModule === 'seller') window.location.href = '/seller/auth';
            else if (currentModule === 'admin') redirectAdminToLogin('session_expired');
            else if (currentModule === 'delivery') window.location.href = '/delivery/auth';
            else window.location.href = '/user/auth/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;

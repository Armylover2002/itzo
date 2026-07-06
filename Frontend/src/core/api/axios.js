import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

const getCustomerToken = () =>
    localStorage.getItem('auth_customer') ||
    localStorage.getItem('user_accessToken') ||
    localStorage.getItem('accessToken') ||
    null;

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
    (config) => {
        let token = null;
        const url = config.url;
        const pagePath = window.location.pathname;

        // Determination strategy: 
        // 1. If we are on a module-specific page (e.g. /seller/dashboard), prioritize that module's token
        // This is crucial for shared APIs like /products or /admin/categories
        if (pagePath.startsWith('/seller')) {
            token = localStorage.getItem('auth_seller');
        } else if (pagePath.startsWith('/ecs')) {
            token = localStorage.getItem('auth_admin');
        } else if (pagePath.startsWith('/delivery')) {
            token = localStorage.getItem('auth_delivery');
        } else if (pagePath.startsWith('/hrms')) {
            token = localStorage.getItem('auth_hrms');
        } else if (pagePath.startsWith('/customer')) {
            token = getCustomerToken();
        }

        // 2. Fallback to URL-based detection
        if (!token) {
            if (url.startsWith('/seller')) token = localStorage.getItem('auth_seller');
            else if (url.startsWith('/ecs')) token = localStorage.getItem('auth_admin');
            else if (url.startsWith('/delivery')) token = localStorage.getItem('auth_delivery');
            else if (url.startsWith('/customer') || url.startsWith('/cart') || url.startsWith('/wishlist') || url.startsWith('/categories') || url.startsWith('/products')) {
                token = getCustomerToken();
            }
        }

        // 3. Final default: if we are on a general page and STILL no token, try customer token
        if (!token && !pagePath.startsWith('/ecs') && !pagePath.startsWith('/seller') && !pagePath.startsWith('/delivery') && !pagePath.startsWith('/hrms')) {
            token = getCustomerToken();
        }

        // 3. Last fallback: Check common 'token' key if implemented
        if (!token) {
            token = localStorage.getItem('token');
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
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

            // Only reload when we had a token that's now invalid (expired/logged out elsewhere).
            // If no token exists, skip reload to avoid infinite loop on public pages.
            const hasToken = ['auth_seller', 'auth_admin', 'auth_delivery', 'auth_customer', 'user_accessToken', 'accessToken', 'token'].some(
                (key) => localStorage.getItem(key)
            );
            if (!hasToken) {
                return Promise.reject(error);
            }
            const path = window.location.pathname;
            const requestUrl = String(originalRequest?.url || '');
            const currentModule = path.startsWith('/seller')
                ? 'seller'
                : path.startsWith('/ecs')
                    ? 'admin'
                    : path.startsWith('/delivery')
                        ? 'delivery'
                        : path.startsWith('/hrms')
                            ? 'hrms'
                            : 'customer';
            const requestModule = requestUrl.startsWith('/seller')
                ? 'seller'
                : requestUrl.startsWith('/ecs')
                    ? 'admin'
                    : requestUrl.startsWith('/delivery')
                        ? 'delivery'
                        : requestUrl.startsWith('/hrms')
                            ? 'hrms'
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
                hrms: ['auth_hrms'],
                customer: ['auth_customer', 'user_accessToken', 'accessToken', 'token'],
            };
            const keysToClear = moduleStorageKeys[currentModule] || ['token'];
            keysToClear.forEach((key) => localStorage.removeItem(key));

            if (currentModule === 'seller') window.location.href = '/seller/auth';
            else if (currentModule === 'admin') window.location.href = '/ecs/login';
            else if (currentModule === 'delivery') window.location.href = '/delivery/auth';
            else if (currentModule === 'hrms') window.location.href = '/hrms/login';
            else window.location.href = '/user/auth/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;

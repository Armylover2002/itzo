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
    null;

// Utility to globally resolve relative upload paths to absolute URLs
function prependBaseUrlToUploads(obj, apiRoot) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string' && obj[i].startsWith('/uploads/')) {
                obj[i] = apiRoot + obj[i];
            } else if (typeof obj[i] === 'object') {
                prependBaseUrlToUploads(obj[i], apiRoot);
            }
        }
    } else {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string' && obj[key].startsWith('/uploads/')) {
                    obj[key] = apiRoot + obj[key];
                } else if (typeof obj[key] === 'object') {
                    prependBaseUrlToUploads(obj[key], apiRoot);
                }
            }
        }
    }
}

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
    async (config) => {
        let token = null;
        const url = config.url;
        const pagePath = window.location.pathname;

        // 0. Explicit Context Module overriding everything else
        if (config.contextModule) {
            const moduleKeys = {
                seller: 'auth_seller',
                admin: 'auth_admin',
                delivery: 'auth_delivery',
                hrms: 'auth_hrms',
                user: 'auth_customer',
                customer: 'auth_customer'
            };
            if (config.contextModule === 'customer' || config.contextModule === 'user') {
                token = getCustomerToken();
            } else if (moduleKeys[config.contextModule]) {
                token = localStorage.getItem(moduleKeys[config.contextModule]);
            }
        }

        // Determination strategy: 
        // 1. If we are on a module-specific page (e.g. /seller/dashboard), prioritize that module's token
        // This is crucial for shared APIs like /products or /admin/categories
        if (!token) {
            // Prefer the module-specific access token first — it's the one kept
            // up to date by the refresh flow in services/api/axios.js. The
            // legacy auth_* aliases below are only updated at login time, so
            // relying on them alone re-attaches a stale token after any
            // silent refresh and causes spurious 401s (and forced logout) on
            // page reload once the original access token has expired.
            if (pagePath.startsWith('/seller')) {
                token = localStorage.getItem('seller_accessToken') || localStorage.getItem('auth_seller');
            } else if (pagePath.startsWith('/ecs')) {
                token = localStorage.getItem('admin_accessToken') || localStorage.getItem('auth_admin');
            } else if (pagePath.startsWith('/delivery')) {
                token = localStorage.getItem('delivery_accessToken') || localStorage.getItem('auth_delivery');
            } else if (pagePath.startsWith('/hrms')) {
                token = localStorage.getItem('hrms_accessToken') || localStorage.getItem('auth_hrms');
            } else if (pagePath.startsWith('/customer') || pagePath.startsWith('/quick') || pagePath === '/') {
                token = getCustomerToken();
            }
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

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Let the browser automatically set the Content-Type with boundaries for FormData
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];

            try {
                const { compressImage } = await import("@shared/utils/imageCompression");
                const newFormData = new FormData();
                
                for (const [key, value] of config.data.entries()) {
                    if ((value instanceof File || value instanceof Blob) && value.type && value.type.startsWith("image/")) {
                        try {
                            // Preserve original file type to respect backend strict mimetype validations
                            const compressed = await compressImage(value, { fileType: value.type });
                            newFormData.append(key, compressed, value.name || "image.jpg");
                        } catch (err) {
                            console.error("Global image compression failed, falling back to original:", err);
                            newFormData.append(key, value);
                        }
                    } else {
                        newFormData.append(key, value);
                    }
                }
                config.data = newFormData;
            } catch (importErr) {
                console.error("Failed to load image compressor:", importErr);
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
    (response) => {
        const baseUrlRaw = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
        const apiRoot = String(baseUrlRaw).replace(/\/$/, "");
        if (response.data) {
            prependBaseUrlToUploads(response.data, apiRoot);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Skip redirect for ACCOUNT_DELETED — this is a business-logic error
            if (error.response?.data?.code === 'ACCOUNT_DELETED') {
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
            // Use hash path when available (HashRouter in WebView),
            // otherwise fall back to server pathname.
            const rawHash = window.location.hash || '';
            const hashPath = rawHash.startsWith('#') ? rawHash.substring(1) : '';
            const path = hashPath || window.location.pathname;
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
            const isDeactivated = error.response?.data?.message === 'User account is deactivated' ||
                error.response?.data?.code === 'ACCOUNT_DEACTIVATED';

            const isCustomerEndpoint =
                requestUrl.startsWith('/user') ||
                requestUrl.startsWith('/customer') ||
                requestUrl.startsWith('/auth') ||
                (requestUrl.startsWith('/quick-commerce') && !requestUrl.includes('/admin') && !requestUrl.includes('/seller'));

            const requestModule = requestUrl.startsWith('/seller')
                ? 'seller'
                : requestUrl.startsWith('/ecs') || requestUrl.includes('/admin')
                    ? 'admin'
                    : requestUrl.startsWith('/delivery')
                        ? 'delivery'
                        : requestUrl.startsWith('/hrms')
                            ? 'hrms'
                            : isCustomerEndpoint
                                ? 'customer'
                                : null;

            // Prevent cross-module (and unclassifiable) 401s from logging out the
            // active session, UNLESS the account is explicitly deactivated.
            if (!isDeactivated && requestModule !== currentModule) {
                return Promise.reject(error);
            }

            const moduleStorageKeys = {
                seller: ['auth_seller', 'seller_accessToken', 'token'],
                admin: ['auth_admin', 'admin_accessToken', 'token'],
                delivery: ['auth_delivery', 'delivery_accessToken', 'token'],
                hrms: ['auth_hrms'],
                customer: ['auth_customer', 'user_accessToken', 'accessToken', 'token'],
            };
            const targetModule = isDeactivated ? 'customer' : currentModule;
            const keysToClear = moduleStorageKeys[targetModule] || ['token'];
            keysToClear.forEach((key) => localStorage.removeItem(key));
            try {
                window.dispatchEvent(new Event('userAuthChanged'));
            } catch {
                // ignore
            }

            // Use hash navigation if in a native-like shell (HashRouter),
            // otherwise use standard navigation (BrowserRouter).
            const isHashRouter = Boolean(window.flutter_inappwebview) ||
                Boolean(window.ReactNativeWebView) ||
                String(window.location?.protocol || '').toLowerCase() === 'file:' ||
                String(window.navigator?.userAgent || '').toLowerCase().includes(' wv') ||
                String(window.navigator?.userAgent || '').toLowerCase().includes('; wv');

            let redirectTarget;
            if (currentModule === 'seller') redirectTarget = '/seller/auth';
            else if (currentModule === 'admin') redirectTarget = '/ecs/login';
            else if (currentModule === 'delivery') redirectTarget = '/delivery/auth';
            else if (currentModule === 'hrms') redirectTarget = '/hrms/login';
            else redirectTarget = '/user/auth/login';

            if (isHashRouter) {
                window.location.hash = '#' + redirectTarget;
            } else {
                window.location.href = redirectTarget;
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;

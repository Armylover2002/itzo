import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";

const normalizeResponse = (response) => {
  const payload =
    response?.data?.result ??
    response?.data?.results ??
    response?.data?.data ??
    null;

  return {
    ...response,
    data: {
      ...response.data,
      result: payload,
      results: payload,
    },
  };
};

const call = (request) => request.then(normalizeResponse);

const bustSellerGetCache = (...prefixes) => {
  prefixes.forEach((prefix) => invalidateCache(prefix));
};

export const sellerApi = {
  requestOtp: (phone) =>
    call(axiosInstance.post("/seller/auth/request-otp", { phone })),

  getTerms: () => call(axiosInstance.get("/food/pages/terms?role=seller")),
  getPrivacy: () => call(axiosInstance.get("/food/pages/privacy?role=seller")),
  getSupport: () => call(axiosInstance.get("/food/pages/support?role=seller")),

  verifyOtp: (phone, otp) =>
    call(axiosInstance.post("/seller/auth/verify-otp", { phone, otp })),

  // In-flight + short TTL coalesce StrictMode/remount duplicate GETs.
  // Pass { forceRefresh: true } after mutations or intentional polls.
  getProducts: (params = {}, options = {}) =>
    call(
      getWithDedupe("/seller/products", params, {
        contextModule: "seller",
        ttl: 8000,
        ...options,
      }),
    ),

  getProductById: (productId) =>
    call(axiosInstance.get(`/seller/products/${String(productId)}`)),

  // Lookup a product by its SKU/Product ID for auto-fill
  lookupProductBySku: (sku) =>
    call(axiosInstance.get("/seller/catalog/lookup", { params: { sku } })),

  createProduct: (formData) =>
    call(
      axiosInstance.post("/seller/products", formData),
    ).then((res) => {
      bustSellerGetCache("/seller/products", "/seller/stats");
      return res;
    }),

  bulkUploadProducts: (formData) =>
    call(
      axiosInstance.post("/seller/products/bulk", formData),
    ).then((res) => {
      bustSellerGetCache("/seller/products", "/seller/stats");
      return res;
    }),

  updateProduct: (productId, formData) =>
    call(
      axiosInstance.put(`/seller/products/${String(productId)}`, formData),
    ).then((res) => {
      bustSellerGetCache("/seller/products", "/seller/stats");
      return res;
    }),

  deleteProduct: (productId) =>
    call(axiosInstance.delete(`/seller/products/${String(productId)}`)).then((res) => {
      bustSellerGetCache("/seller/products", "/seller/stats");
      return res;
    }),

  getCategoryTree: (options = {}) =>
    call(
      getWithDedupe("/seller/categories/tree", {}, {
        contextModule: "seller",
        ttl: 60000,
        ...options,
      }),
    ),

  getStats: (range = "daily", options = {}) =>
    call(
      getWithDedupe("/seller/stats", { range }, {
        contextModule: "seller",
        ttl: 10000,
        ...options,
      }),
    ),

  getOrders: (params = {}, options = {}) =>
    call(
      getWithDedupe("/seller/orders", params, {
        contextModule: "seller",
        ttl: 10000,
        ...options,
      }),
    ),

  updateOrderStatus: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/orders/${String(orderId)}/status`, data),
    ).then((res) => {
      bustSellerGetCache("/seller/orders", "/seller/earnings", "/seller/stats", "/seller/returns");
      return res;
    }),

  resendOrderDispatch: (orderId) =>
    call(axiosInstance.post(`/seller/orders/${String(orderId)}/resend-dispatch`)),

  getEarnings: (options = {}) =>
    call(
      getWithDedupe("/seller/earnings", {}, {
        contextModule: "seller",
        ttl: 10000,
        ...options,
      }),
    ),

  getProfile: (options = {}) =>
    call(
      getWithDedupe("/seller/profile", {}, {
        contextModule: "seller",
        ttl: 5000,
        ...options,
      }),
    ),

  getQuickZonesPublic: () => call(getWithDedupe("/quick-commerce/zones/public")),

  updateProfile: (data = {}) =>
    call(
      axiosInstance.put("/seller/profile", data, data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined),
    ).then((res) => {
      bustSellerGetCache("/seller/profile");
      return res;
    }),

  adjustStock: (data = {}) =>
    call(axiosInstance.post("/seller/stock-adjustments", data)).then((res) => {
      bustSellerGetCache("/seller/products", "/seller/stock-history");
      return res;
    }),

  getStockHistory: (options = {}) =>
    call(
      getWithDedupe("/seller/stock-history", {}, {
        contextModule: "seller",
        ttl: 10000,
        ...options,
      }),
    ),

  getNotifications: (options = {}) =>
    call(
      getWithDedupe("/seller/notifications", {}, {
        contextModule: "seller",
        ttl: 8000,
        ...options,
      }),
    ),

  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return call(axiosInstance.post(path, { token: String(token), platform }));
  },

  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return call(
      axiosInstance.delete(`/fcm-tokens/remove/${encodeURIComponent(String(token))}`, {
        data: { token: String(token), platform },
      }),
    );
  },

  markNotificationRead: (id) =>
    call(axiosInstance.put(`/seller/notifications/${String(id)}/read`)),

  markAllNotificationsRead: () =>
    call(axiosInstance.put("/seller/notifications/mark-all-read")),

  requestWithdrawal: (data = {}) =>
    call(axiosInstance.post("/seller/withdrawals", data)).then((res) => {
      bustSellerGetCache("/seller/earnings", "/seller/withdrawal-settings");
      return res;
    }),
  getWithdrawalSettings: (options = {}) =>
    call(
      getWithDedupe("/seller/withdrawal-settings", {}, {
        contextModule: "seller",
        ttl: 30000,
        ...options,
      }),
    ),

  getReturns: (options = {}) =>
    call(
      getWithDedupe("/seller/returns", {}, {
        contextModule: "seller",
        ttl: 8000,
        ...options,
      }),
    ),

  approveReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/approve`, data),
    ).then((res) => {
      bustSellerGetCache("/seller/returns", "/seller/earnings");
      return res;
    }),

  rejectReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/reject`, data),
    ).then((res) => {
      bustSellerGetCache("/seller/returns");
      return res;
    }),

  requestReturnPickup: (orderId) =>
    call(
      axiosInstance.post(`/seller/returns/${String(orderId)}/request-pickup`),
    ).then((res) => {
      bustSellerGetCache("/seller/returns");
      return res;
    }),

  getCoupons: (options = {}) =>
    call(
      getWithDedupe("/seller/coupons", {}, {
        contextModule: "seller",
        ttl: 10000,
        ...options,
      }),
    ),
  createCoupon: (data = {}) => call(axiosInstance.post("/seller/coupons", data)).then((res) => {
    bustSellerGetCache("/seller/coupons");
    return res;
  }),
  updateCoupon: (couponId, data = {}) => call(axiosInstance.put(`/seller/coupons/${String(couponId)}`, data)).then((res) => {
    bustSellerGetCache("/seller/coupons");
    return res;
  }),
  deleteCoupon: (couponId) => call(axiosInstance.delete(`/seller/coupons/${String(couponId)}`)).then((res) => {
    bustSellerGetCache("/seller/coupons");
    return res;
  }),
  deleteAccount: () => call(axiosInstance.delete("/seller/profile")),
  getCODDeposits: () => call(axiosInstance.get("/seller/finance/cod-verification")),
  processCODDeposit: (id, formData) =>
    call(
      axiosInstance.post(`/seller/finance/cod-verification/${String(id)}/action`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),
};

export default sellerApi;

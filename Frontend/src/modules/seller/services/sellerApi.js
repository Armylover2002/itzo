import axiosInstance from "@core/api/axios";

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

export const sellerApi = {
  requestOtp: (phone) =>
    call(axiosInstance.post("/seller/auth/request-otp", { phone })),

  getTerms: () => call(axiosInstance.get("/food/pages/terms?role=seller")),
  getPrivacy: () => call(axiosInstance.get("/food/pages/privacy?role=seller")),
  getSupport: () => call(axiosInstance.get("/food/pages/support?role=seller")),

  verifyOtp: (phone, otp) =>
    call(axiosInstance.post("/seller/auth/verify-otp", { phone, otp })),

  getProducts: (params = {}) =>
    call(axiosInstance.get("/seller/products", { params })),

  getProductById: (productId) =>
    call(axiosInstance.get(`/seller/products/${String(productId)}`)),

  createProduct: (formData) =>
    call(
      axiosInstance.post("/seller/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  updateProduct: (productId, formData) =>
    call(
      axiosInstance.put(`/seller/products/${String(productId)}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ),

  deleteProduct: (productId) =>
    call(axiosInstance.delete(`/seller/products/${String(productId)}`)),

  getCategoryTree: () => call(axiosInstance.get("/seller/categories/tree")),

  getStats: (range = "daily") =>
    call(axiosInstance.get("/seller/stats", { params: { range } })),

  getOrders: (params = {}) =>
    call(axiosInstance.get("/seller/orders", { params })),

  updateOrderStatus: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/orders/${String(orderId)}/status`, data),
    ),

  resendOrderDispatch: (orderId) =>
    call(axiosInstance.post(`/seller/orders/${String(orderId)}/resend-dispatch`)),

  getEarnings: () => call(axiosInstance.get("/seller/earnings")),

  getProfile: () => call(axiosInstance.get("/seller/profile")),

  getPublicZones: () => call(axiosInstance.get("/quick-commerce/zones/public")),
  getQuickZonesPublic: () => call(axiosInstance.get("/quick-commerce/zones/public")),

  updateProfile: (data = {}) =>
    call(
      axiosInstance.put("/seller/profile", data, data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined),
    ),

  deleteProfile: () => call(axiosInstance.delete("/seller/profile")),

  adjustStock: (data = {}) =>
    call(axiosInstance.post("/seller/stock-adjustments", data)),

  getStockHistory: () => call(axiosInstance.get("/seller/stock-history")),

  getNotifications: () => call(axiosInstance.get("/seller/notifications")),

  markNotificationRead: (id) =>
    call(axiosInstance.put(`/seller/notifications/${String(id)}/read`)),

  markAllNotificationsRead: () =>
    call(axiosInstance.put("/seller/notifications/mark-all-read")),

  requestWithdrawal: (data = {}) =>
    call(axiosInstance.post("/seller/withdrawals", data)),

  getWithdrawalLimits: () =>
    call(axiosInstance.get("/quick-commerce/billing/settings")),

  getReturns: () => call(axiosInstance.get("/seller/returns")),

  approveReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/approve`, data),
    ),

  rejectReturn: (orderId, data = {}) =>
    call(
      axiosInstance.put(`/seller/returns/${String(orderId)}/reject`, data),
    ),
    
  getReturnOtp: (sellerReturnId) =>
    call(axiosInstance.get(`/seller/returns/${String(sellerReturnId)}/otp`)),

  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path = platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return call(axiosInstance.post(path, { token: String(token), platform }));
  },

  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return call(axiosInstance.delete(`/fcm-tokens/remove/${encodeURIComponent(String(token))}`, {
      data: { token: String(token), platform }
    }));
  }
};

export default sellerApi;

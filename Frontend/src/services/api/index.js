/**
 * API layer - auth connected to new backend; rest stubbed for UI compatibility.
 */

import apiClient from "./axios.js";
import { getWithDedupe } from "@core/api/dedupe";
import { API_ENDPOINTS } from "./config.js";
import * as authService from "./auth.js";

const stub = () =>
  Promise.resolve({
    data: { success: false, message: "Backend not connected", data: null },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  });

/** Search API - unified search for user app */
export const searchAPI = {
  unifiedSearch: (params = {}) =>
    apiClient.get("/food/search/unified", { params }),
  getAdminCategories: (params = {}) =>
    apiClient.get("/food/search/categories/admin", { params }),
};

// User Subscription (Restaurant/Delivery)
export const subscriptionAPI = {
  getPlans: (userType) =>
    apiClient.get("/food/subscriptions/plans", {
      params: { userType },
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  getMySubscription: (userType) =>
    apiClient.get("/food/subscriptions/my-subscription", {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  purchase: (userType, payload) =>
    apiClient.post("/food/subscriptions/purchase", payload, {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  verify: (userType, payload) =>
    apiClient.post("/food/subscriptions/verify", payload, {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  createWalletTopupOrder: (userType, amount) =>
    apiClient.post("/food/subscriptions/wallet/topup", { amount }, {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  verifyWalletTopup: (userType, payload) =>
    apiClient.post("/food/subscriptions/wallet/verify", payload, {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  getWalletLedger: (userType, params = {}) =>
    apiClient.get("/food/subscriptions/wallet/ledger", {
      params,
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  getEligibility: (userType) =>
    apiClient.get("/food/subscriptions/eligibility", {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
  cancelAutoRenew: (userType) =>
    apiClient.post("/food/subscriptions/cancel-auto-renew", {}, {
      contextModule: userType.toLowerCase().replace("_partner", ""),
    }),
};

// Dining (public discovery + user booking/bills)
export const diningAPI = {
  getCategories: () => apiClient.get("/food/dining/public/categories"),
  getBanners: () => apiClient.get("/food/dining/public/banners"),
  getRestaurants: (params = {}) =>
    apiClient.get("/food/dining/public/restaurants", { params }),
  getRestaurantDetail: (restaurantId) =>
    apiClient.get(`/food/dining/public/restaurants/${restaurantId}`),
  getAvailability: (restaurantId, date) =>
    apiClient.get(`/food/dining/public/restaurants/${restaurantId}/availability`, { params: { date } }),

  createReservation: (payload) =>
    apiClient.post("/food/user/dining/reservations", payload, { contextModule: "user" }),
  getMyReservations: (params = {}) =>
    apiClient.get("/food/user/dining/reservations", { params, contextModule: "user" }),
  getMyReservationDetail: (id) =>
    apiClient.get(`/food/user/dining/reservations/${id}`, { contextModule: "user" }),
  cancelReservation: (id, reason) =>
    apiClient.post(`/food/user/dining/reservations/${id}/cancel`, { reason }, { contextModule: "user" }),
  getBill: (billId) =>
    apiClient.get(`/food/user/dining/bills/${billId}`, { contextModule: "user" }),
  createBillPaymentOrder: (billId) =>
    apiClient.post(`/food/user/dining/bills/${billId}/pay`, {}, { contextModule: "user" }),
  verifyBillPayment: (billId, payload) =>
    apiClient.post(`/food/user/dining/bills/${billId}/verify`, payload, { contextModule: "user" }),
};

const createStubAPI = () =>
  new Proxy(
    {},
    {
      get(_, prop) {
        return () => stub();
      },
    },
  );

export default apiClient;
export { API_ENDPOINTS };

// Stub for non-auth endpoints so we don't hit backend for unimplemented routes (avoids 404s and extra calls).
// Auth is done via authAPI/authService which use apiClient directly.
const emptyDataStub = () =>
  Promise.resolve({
    data: { success: false, data: null },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  });

export const api = {
  get: (_url, _config) => emptyDataStub(),
  post: (_url, _data, _config) => emptyDataStub(),
  put: (_url, _data, _config) => emptyDataStub(),
  patch: (_url, _data, _config) => emptyDataStub(),
  delete: (_url, _config) => emptyDataStub(),
};

/** Single in-flight + short cache for user /auth/me - avoids duplicate calls. */
let userMeInFlight = null;
let userMeCached = null;
let userMeCacheTime = 0;
let userMeCacheToken = null;
const USER_ME_CACHE_MS = 60 * 1000;

const getUserAccessToken = () =>
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("user_accessToken") ||
      localStorage.getItem("auth_customer") ||
      localStorage.getItem("accessToken"))) ||
  null;

/** Clear /me cache on logout or account switch so COD / profile flags cannot leak across sessions. */
export const invalidateUserMeCache = () => {
  userMeCached = null;
  userMeCacheTime = 0;
  userMeCacheToken = null;
  userMeInFlight = null;
};

const getUserMeOnce = () => {
  const now = Date.now();
  const token = getUserAccessToken();
  if (
    userMeCached &&
    userMeCacheToken === token &&
    token &&
    now - userMeCacheTime < USER_ME_CACHE_MS
  ) {
    return Promise.resolve(userMeCached);
  }
  if (!userMeInFlight) {
    userMeInFlight = authService
      .getMe("user")
      .then((res) => {
        userMeCached = res;
        userMeCacheTime = Date.now();
        userMeCacheToken = getUserAccessToken();
        return res;
      })
      .finally(() => {
        userMeInFlight = null;
      });
  }
  return userMeInFlight;
};

/** Auth API - user OTP + admin login via new backend */
export const authAPI = {
  sendOTP: (phone, _purpose = "login", _email = null) => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestUserOtp(phone);
  },
  verifyOTP: (
    phone,
    otp,
    _purpose,
    _name,
    _email,
    _role,
    _password,
    _referralCode,
    fcmToken = null,
    platform = "web",
  ) => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyUserOtp(
      phone,
      otp,
      _referralCode,
      _name,
      fcmToken,
      platform,
    );
  },
  getCurrentUser: () => getUserMeOnce(),
  refreshToken: (token) => authService.refreshToken(token),
  logout: (refreshToken, fcmToken = null, platform = "web") => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("user_refreshToken")
        : null);
    return authService.logout(token, fcmToken, platform);
  },
  logoutAll: (refreshToken, fcmToken = null, platform = "web") => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("user_refreshToken")
        : null);
    return authService.logoutAll(token, fcmToken, platform);
  },
};

export const supportAPI = {
  createTicket: (body) =>
    apiClient.post("/food/user/support/ticket", body ?? {}, {
      contextModule: "user",
    }),
  getMyTickets: (params = {}) =>
    apiClient.get("/food/user/support/my-tickets", {
      params,
      contextModule: "user",
    }),
  getSupportTicketsAdmin: (params = {}) =>
    apiClient.get("/food/admin/support-tickets", {
      params,
      contextModule: "admin",
    }),
  updateSupportTicketAdmin: (id, body = {}) =>
    apiClient.patch(`/food/admin/support-tickets/${String(id)}`, body ?? {}, {
      contextModule: "admin",
    }),
};

export const notificationAPI = {
  getInbox: (params = {}, config = {}) =>
    apiClient.get("/food/notifications/inbox", {
      params,
      ...config,
    }),
  markAsRead: (id, config = {}) =>
    apiClient.patch(`/food/notifications/${String(id)}/read`, {}, config),
  dismiss: (id, config = {}) =>
    apiClient.delete(`/food/notifications/${String(id)}`, config),
  dismissAll: (config = {}) =>
    apiClient.delete("/food/notifications/inbox/all", config),
};

/** Collapse duplicate zone list fetches (StrictMode remounts, overlapping effects). */
const adminZonesListCache = (() => {
  let inFlight = new Map();
  let cache = new Map();
  const CACHE_MS = 2500;

  const stableKey = (params = {}) => {
    const normalized = { limit: 1000, ...params };
    delete normalized._ts;
    return JSON.stringify(
      Object.keys(normalized)
        .sort()
        .reduce((acc, key) => {
          acc[key] = normalized[key];
          return acc;
        }, {}),
    );
  };

  const clear = () => {
    inFlight.clear();
    cache.clear();
  };

  const get = (params = {}) => {
    const key = stableKey(params);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.at < CACHE_MS) {
      return Promise.resolve(cached.res);
    }

    const existing = inFlight.get(key);
    if (existing) return existing;

    const request = apiClient
      .get("/food/admin/zones", {
        params: { limit: 1000, ...params },
        contextModule: "admin",
      })
      .then((res) => {
        cache.set(key, { at: Date.now(), res });
        return res;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  };

  return { get, clear };
})();

/** Admin API - new backend only (GET /auth/me, PATCH /auth/admin/profile, POST /auth/admin/change-password) */
export const adminAPI = {
  getSidebarBadges: () =>
    apiClient.get("/food/admin/sidebar-badges", { contextModule: "admin" }),
  getPublicRoles: () => apiClient.get("/auth/admin/roles"),
  login: (email, password, roleId) => authService.adminLogin(email, password, roleId),
  /** POST /auth/admin/forgot-password/request-otp – only accepts registered admin email */
  requestForgotPasswordOtp: (email) =>
    apiClient.post("/auth/admin/forgot-password/request-otp", {
      email: String(email || "")
        .trim()
        .toLowerCase(),
    }),
  /** POST /auth/admin/forgot-password/reset – verify OTP and set new password in one call */
  resetPasswordWithOtp: (email, otp, newPassword) =>
    apiClient.post("/auth/admin/forgot-password/reset", {
      email: String(email || "")
        .trim()
        .toLowerCase(),
      otp: String(otp || "").replace(/\D/g, ""),
      newPassword: String(newPassword || ""),
    }),
  /** Raw /auth/me for admin (e.g. navbar). For Profile & Settings use getAdminProfile. */
  getCurrentAdmin: () => authService.getMe("admin"),
  /** Single API for admin profile: GET /auth/me, returns { data: { admin } }. Use on Profile & Settings only. */
  getAdminProfile: () =>
    authService.getMe("admin").then((res) => {
      const user =
        res?.data?.data?.user ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data;
      return { data: { data: { admin: user }, admin: user } };
    }),
  /** PATCH /auth/admin/profile. Body: name?, phone?, profileImage? */
  updateAdminProfile: (body) =>
    apiClient.patch("/auth/admin/profile", body ?? {}, {
      contextModule: "admin",
    }),
  /** POST /auth/admin/change-password */
  changePassword: (currentPassword, newPassword) => {
    // Send the current refresh token so the backend revokes all OTHER sessions
    // after the password change while keeping this session alive.
    const refreshToken =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("admin_refreshToken")
        : null;
    return apiClient.post(
      "/auth/admin/change-password",
      { currentPassword, newPassword, ...(refreshToken ? { refreshToken } : {}) },
      { contextModule: "admin" },
    );
  },
  logout: (refreshToken) => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("admin_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_admin") : null;
    return authService.logout(token, fcmToken, "web");
  },
  logoutAll: (refreshToken) => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("admin_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_admin") : null;
    return authService.logoutAll(token, fcmToken, "web");
  },
  // Restaurant approvals and join requests
  getPendingRestaurants: () =>
    apiClient.get("/food/admin/restaurants/pending", {
      contextModule: "admin",
    }),
  /** List restaurant complaints (admin). */
  getRestaurantComplaints: (params = {}) =>
    apiClient.get("/food/admin/restaurants/complaints", {
      params,
      contextModule: "admin",
    }),
  updateRestaurantComplaint: (id, body) =>
    apiClient.patch(`/food/admin/restaurants/complaints/${id}`, body, {
      contextModule: "admin",
    }),
  /** Global universal search (admin). */
  globalSearch: (query) =>
    apiClient.get("/food/admin/global-search", {
      params: { query },
      contextModule: "admin",
    }),
  approveRestaurant: (id) =>
    apiClient.patch(
      `/food/admin/restaurants/${id}/approve`,
      {},
      {
        contextModule: "admin",
      },
    ),
  rejectRestaurant: (id, reason) =>
    apiClient.patch(
      `/food/admin/restaurants/${id}/reject`,
      { reason },
      { contextModule: "admin" },
    ),
  /** Delivery partner join requests - uses /food/admin/delivery/* (new backend API) */
  getDeliveryPartnerJoinRequests: (params) =>
    apiClient.get("/food/admin/delivery/join-requests", {
      params,
      contextModule: "admin",
    }),
  getDeliveryPartnerSubmissions: (id) =>
    apiClient.get(`/food/admin/delivery/${id}/submissions`, {
      contextModule: "admin",
    }),
  /** List approved delivery partners (Deliveryman List page) */
  getDeliveryPartners: (params) =>
    apiClient.get("/food/admin/delivery/partners", {
      params,
      contextModule: "admin",
    }),
  /** Admin creates delivery partner (multipart FormData — same fields as driver onboarding). Auto-approved. */
  createDeliveryPartner: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(
        new Error("FormData with driver details and document files is required"),
      );
    }
    return apiClient.post("/food/admin/delivery/partners", formData, {
      contextModule: "admin",
    });
  },
  getDeliverymanReviews: (params = {}) =>
    apiClient.get("/food/admin/delivery/reviews", {
      params,
      contextModule: "admin",
    }),
  getContactMessages: (params = {}) =>
    apiClient.get("/food/admin/contact-messages", {
      params,
      contextModule: "admin",
    }),
  /** Dashboard summary stats (admin home) */
  getDashboardStats: (params = {}) =>
    apiClient.get("/food/admin/dashboard-stats", {
      params,
      contextModule: "admin",
    }),
  /** List restaurant withdrawal requests (admin). */
  getWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/withdrawals", {
      params,
      contextModule: "admin",
    }),
  /** Update status of a withdrawal request. */
  updateWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/withdrawals/${id}`, body, {
      contextModule: "admin",
    }),
  /** List delivery withdrawal requests (admin). */
  getDeliveryWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/delivery/withdrawals", {
      params,
      contextModule: "admin",
    }),
  /** Update status of a delivery withdrawal request. */
  updateDeliveryWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/delivery/withdrawals/${id}`, body, {
      contextModule: "admin",
    }),
  /** Delivery withdrawal aliases */
  getDeliveryWithdrawalRequests: (params) => adminAPI.getDeliveryWithdrawals(params),
  approveDeliveryWithdrawal: (id) => adminAPI.updateDeliveryWithdrawalStatus(id, { status: "approved" }),
  rejectDeliveryWithdrawal: (id, reason) => adminAPI.updateDeliveryWithdrawalStatus(id, { status: "rejected", rejectionReason: reason }),
  // Aliases for RestaurantWithdraws page
  getWithdrawalRequests: (params) => adminAPI.getWithdrawals(params),
  approveWithdrawalRequest: (id) => adminAPI.updateWithdrawalStatus(id, { status: "approved" }),
  rejectWithdrawalRequest: (id, reason) => adminAPI.updateWithdrawalStatus(id, { status: "rejected", rejectionReason: reason }),
  /** Delivery boy wallets (stub until backend implements - returns empty so list still loads) */
  getDeliveryBoyWallets: (params) =>
    apiClient.get("/food/admin/delivery/wallets", {
      params,
      contextModule: "admin",
    }),
  updateDeliveryBoyWallet: (body) =>
    apiClient.patch("/food/admin/delivery/wallets", body, {
      contextModule: "admin",
    }),
  getDeliveryPartnerById: (id) =>
    apiClient.get(`/food/admin/delivery/${id}`, { contextModule: "admin" }),
  approveDeliveryPartner: (id) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/approve`,
      {},
      {
        contextModule: "admin",
      },
    ),
  rejectDeliveryPartner: (id, reason) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      {
        contextModule: "admin",
      },
    ),
  updateDeliveryPartnerActiveStatus: (id, isActive) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/active-status`,
      { isActive: isActive !== false },
      { contextModule: "admin" },
    ),
  /** GET /food/admin/delivery/support-tickets - list all delivery support tickets (query: status, priority, search, page, limit). */
  getDeliverySupportTickets: (params) =>
    apiClient.get("/food/admin/delivery/support-tickets", {
      params,
      contextModule: "admin",
    }),
  getExpiredFssaiNotifications: (params = {}) =>
    apiClient.get("/food/admin/notifications/fssai-expired", {
      params,
      contextModule: "admin",
    }),
  /** GET /food/admin/delivery/support-tickets/stats - counts by status. */
  getDeliverySupportTicketStats: () =>
    apiClient.get("/food/admin/delivery/support-tickets/stats", {
      contextModule: "admin",
    }),
  /** PATCH /food/admin/delivery/support-tickets/:id - update adminResponse, status. */
  updateDeliverySupportTicket: (id, body) =>
    apiClient.patch(`/food/admin/delivery/support-tickets/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  createBroadcastNotification: (body = {}) =>
    apiClient.post("/food/admin/notifications/broadcast", body ?? {}, {
      contextModule: "admin",
    }),
  getBroadcastNotifications: (params = {}) =>
    apiClient.get("/food/admin/notifications/broadcast", {
      params,
      contextModule: "admin",
    }),
  deleteBroadcastNotification: (id) =>
    apiClient.delete(`/food/admin/notifications/broadcast/${String(id)}`, {
      contextModule: "admin",
    }),
  getNotificationChannels: (params = {}) =>
    apiClient.get("/food/admin/notifications/channels", {
      params,
      contextModule: "admin",
    }),
  updateNotificationChannelTopic: (role, topicKey, channels = {}) =>
    apiClient.patch(
      `/food/admin/notifications/channels/${encodeURIComponent(role)}/topics/${encodeURIComponent(topicKey)}`,
      { channels },
      { contextModule: "admin" }
    ),
  updateNotificationChannels: (role, topics = []) =>
    apiClient.put(
      `/food/admin/notifications/channels/${encodeURIComponent(role)}`,
      { topics },
      { contextModule: "admin" }
    ),
  /** List restaurants for admin. Requires admin auth. */
  getRestaurants: (params = {}, config = {}) =>
    apiClient.get("/food/admin/restaurants", {
      params: { limit: 1000, ...params },
      contextModule: "admin",
      ...config,
    }),
  getRestaurantReviews: (params = {}) =>
    apiClient.get("/food/admin/restaurants/reviews", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  /** Categories (admin) */
  getCategories: (params = {}) =>
    apiClient.get("/food/admin/categories", { params, contextModule: "admin" }),
  createCategory: (body) =>
    apiClient.post("/food/admin/categories", body ?? {}, {
      contextModule: "admin",
    }),
  updateCategory: (id, body) =>
    apiClient.patch(`/food/admin/categories/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteCategory: (id) =>
    apiClient.delete(`/food/admin/categories/${id}`, {
      contextModule: "admin",
    }),
  approveCategory: (id) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectCategory: (id, reason) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  makeCategoryGlobal: (id) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/make-global`,
      {},
      { contextModule: "admin" },
    ),
  toggleCategoryStatus: (id) =>
    apiClient.patch(
      `/food/admin/categories/${id}/toggle`,
      {},
      { contextModule: "admin" },
    ),
  /** Get single restaurant by id (full details for View Details modal). */
  getRestaurantById: (id) =>
    apiClient.get(`/food/admin/restaurants/${id}`, { contextModule: "admin" }),
  /** Get restaurant analytics for POS. */
  getRestaurantAnalytics: (id) =>
    apiClient.get(`/food/admin/restaurants/${id}/analytics`, {
      contextModule: "admin",
    }),
  /** Search POS analytics targets (orders) by order ID. */
  searchPosAnalytics: (q) =>
    apiClient.get(`/food/admin/pos-analytics/search`, {
      params: { q },
      contextModule: "admin",
    }),
  /** Get single-order analytics for POS. */
  getOrderPosAnalytics: (orderId) =>
    apiClient.get(`/food/admin/orders/${encodeURIComponent(orderId)}/pos-analytics`, {
      contextModule: "admin",
    }),
  /** Update restaurant basic details (admin). */
  updateRestaurant: (id, body) =>
    apiClient.patch(`/food/admin/restaurants/${String(id)}`, body ?? {}, {
      contextModule: "admin",
    }),
  /** Update restaurant status (admin). Body: { status: boolean } */
  updateRestaurantStatus: (id, status) =>
    apiClient.patch(
      `/food/admin/restaurants/${String(id)}/status`,
      { status: status !== false },
      { contextModule: "admin" },
    ),
  /** Toggle restaurant listing visibility (admin). */
  toggleRestaurantListing: (id, isListed) =>
    apiClient.patch(
      `/food/admin/restaurants/${String(id)}/visibility`,
      { isListed: Boolean(isListed) },
      { contextModule: "admin" },
    ),
  toggleShowWithoutMenu: (id, showWithoutMenu) =>
    apiClient.patch(
      `/food/admin/restaurants/${String(id)}/show-without-menu`,
      { showWithoutMenu: Boolean(showWithoutMenu) },
      { contextModule: "admin" },
    ),
  /** Update restaurant location (admin). Body includes lat/lng + address fields. */
  updateRestaurantLocation: (id, body) =>
    apiClient.patch(
      `/food/admin/restaurants/${String(id)}/location`,
      body ?? {},
      { contextModule: "admin" },
    ),
  /** Restaurant menu (admin) */
  getRestaurantMenuById: (id, config = {}) =>
    apiClient.get(`/food/admin/restaurants/${id}/menu`, {
      contextModule: "admin",
      ...config,
    }),
  /** Categories & slot timings for admin add-food (scoped like restaurant app) */
  getRestaurantCategoriesForMenu: (restaurantId, params = {}) =>
    apiClient.get(`/food/admin/restaurants/${String(restaurantId)}/categories`, {
      params: { compact: true, limit: 1000, ...params },
      contextModule: "admin",
    }),
  getRestaurantCategoryStatus: (restaurantId, categoryId) =>
    apiClient.get(
      `/food/admin/restaurants/${String(restaurantId)}/categories/${String(categoryId)}/status`,
      { contextModule: "admin" },
    ),
  getRestaurantItemSlotTimings: (restaurantId) =>
    apiClient.get(`/food/admin/restaurants/${String(restaurantId)}/item-slot-timings`, {
      contextModule: "admin",
    }),
  updateRestaurantMenuById: (id, body) =>
    apiClient.patch(`/food/admin/restaurants/${id}/menu`, body ?? {}, {
      contextModule: "admin",
    }),
  /** Foods (admin) - separate collection */
  getFoods: (params = {}) =>
    apiClient.get("/food/admin/foods", { params, contextModule: "admin" }),
  getFoodById: (id) =>
    apiClient.get(`/food/admin/foods/${String(id)}`, { contextModule: "admin" }),
  createFood: (body) =>
    apiClient.post("/food/admin/foods", body ?? {}, { contextModule: "admin" }),
  updateFood: (id, body) =>
    apiClient.patch(`/food/admin/foods/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteFood: (id) =>
    apiClient.delete(`/food/admin/foods/${id}`, { contextModule: "admin" }),
  /** Food approvals (admin) - pending items created by restaurants */
  getPendingFoodApprovals: (params = {}) =>
    apiClient.get("/food/admin/foods/pending-approvals", {
      params,
      contextModule: "admin",
    }),
  approveFoodItem: (id) =>
    apiClient.patch(
      `/food/admin/foods/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectFoodItem: (id, reason) =>
    apiClient.patch(
      `/food/admin/foods/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  /** Customers (admin) */
  getCustomers: (params = {}) =>
    apiClient.get("/food/admin/customers", { params, contextModule: "admin" }),
  getCustomerById: (id) =>
    apiClient.get(`/food/admin/customers/${String(id)}`, {
      contextModule: "admin",
    }),
  getCustomerContacts: (id, params = {}) =>
    apiClient.get(`/food/admin/customers/${String(id)}/contacts`, {
      params,
      contextModule: "admin",
    }),
  updateCustomerStatus: (id, isActive) =>
    apiClient.patch(
      `/food/admin/customers/${String(id)}/status`,
      { isActive: isActive !== false },
      { contextModule: "admin" },
    ),
  updateCustomerCodAccess: (id, isCodAllowed) =>
    apiClient.patch(
      `/food/admin/customers/${String(id)}/cod-access`,
      { isCodAllowed: isCodAllowed !== false },
      { contextModule: "admin" },
    ),
  bulkUpdateCustomerCodAccess: (ids = [], isCodAllowed) =>
    apiClient.patch(
      "/food/admin/customers/cod-access/bulk",
      {
        ids: Array.isArray(ids) ? ids : [],
        isCodAllowed: isCodAllowed !== false,
      },
      { contextModule: "admin" },
    ),
  /** Alias — same as supportAPI.getSupportTicketsAdmin */
  getSupportTicketsAdmin: (params = {}) => supportAPI.getSupportTicketsAdmin(params),
  /** Orders (admin) – list, get by id, assign delivery partner */
  getOrders: (params = {}) =>
    apiClient.get("/food/admin/orders", {
      params: { limit: 50, page: 1, ...params },
      contextModule: "admin",
    }),
  getOrderById: (orderId) =>
    apiClient.get(`/food/admin/orders/${String(orderId)}`, {
      contextModule: "admin",
    }),
  /** Admin Accept/Reject (acts on behalf of restaurant) */
  acceptOrder: (orderId, prepTimeMins = null) =>
    apiClient.patch(
      `/food/admin/orders/${String(orderId)}/status`,
            { orderStatus: "confirmed", ...(prepTimeMins != null ? { prepTimeMins } : {}) },
      { contextModule: "admin" },
    ),
  rejectOrder: (orderId, reason = "") =>
    apiClient.patch(
      `/food/admin/orders/${String(orderId)}/status`,
            { orderStatus: "cancelled_by_admin", reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  processRefund: (orderId, body = {}) =>
    apiClient.post(`/food/admin/orders/${String(orderId)}/refund`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteOrder: (orderId) =>
    apiClient.delete(`/food/admin/orders/${String(orderId)}`, {
      contextModule: "admin",
    }),
  /** Dispatch settings – auto vs manual assign (global) */
  /** Create restaurant (admin). Single API: POST /food/admin/restaurants. Body: JSON with image URLs. */
  createRestaurant: (body) =>
    apiClient.post("/food/admin/restaurants", body ?? {}, {
      contextModule: "admin",
    }),
  /** List delivery zones. Query: limit, page, isActive, search, view=summary|full */
  getZones: (params = {}) => adminZonesListCache.get(params),
  /** Restaurant report (admin). */
  getRestaurantReport: (params = {}) =>
    apiClient.get("/food/admin/reports/restaurants", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),

  // Subscription Management
  getSubscriptionPlans: (params) =>
    apiClient.get("/food/admin/subscription-plans", {
      params,
      contextModule: "admin",
    }),
  createSubscriptionPlan: (payload) =>
    apiClient.post("/food/admin/subscription-plans", payload, {
      contextModule: "admin",
    }),
  updateSubscriptionPlan: (id, payload) =>
    apiClient.patch(`/food/admin/subscription-plans/${id}`, payload, {
      contextModule: "admin",
    }),
  deleteSubscriptionPlan: (id) =>
    apiClient.delete(`/food/admin/subscription-plans/${id}`, {
      contextModule: "admin",
    }),
  getSubscriptionOverview: () =>
    apiClient.get("/food/admin/subscription/overview", {
      contextModule: "admin",
    }),
  getSubscriptionHistory: (params, config = {}) =>
    apiClient.get("/food/admin/subscription/history", {
      params,
      contextModule: "admin",
      ...config,
    }),
  getSubscriptionAnalytics: () =>
    apiClient.get("/food/admin/subscription/analytics", {
      contextModule: "admin",
    }),

  // Dining Management
  getDiningCategories: () =>
    apiClient.get("/food/admin/dining/categories", { contextModule: "admin" }),
  createDiningCategory: (payload) =>
    apiClient.post("/food/admin/dining/categories", payload, { contextModule: "admin" }),
  updateDiningCategory: (id, payload) =>
    apiClient.patch(`/food/admin/dining/categories/${id}`, payload, { contextModule: "admin" }),
  deleteDiningCategory: (id) =>
    apiClient.delete(`/food/admin/dining/categories/${id}`, { contextModule: "admin" }),
  toggleDiningCategoryStatus: (id) =>
    apiClient.patch(`/food/admin/dining/categories/${id}/toggle`, {}, { contextModule: "admin" }),

  getDiningBanners: () =>
    apiClient.get("/food/admin/dining/banners", { contextModule: "admin" }),
  createDiningBanner: (payload) =>
    apiClient.post("/food/admin/dining/banners", payload, { contextModule: "admin" }),
  updateDiningBanner: (id, payload) =>
    apiClient.patch(`/food/admin/dining/banners/${id}`, payload, { contextModule: "admin" }),
  deleteDiningBanner: (id) =>
    apiClient.delete(`/food/admin/dining/banners/${id}`, { contextModule: "admin" }),
  toggleDiningBannerStatus: (id) =>
    apiClient.patch(`/food/admin/dining/banners/${id}/toggle`, {}, { contextModule: "admin" }),

  getDiningSettings: () =>
    apiClient.get("/food/admin/dining/settings", { contextModule: "admin" }),
  updateDiningSettings: (payload) =>
    apiClient.patch("/food/admin/dining/settings", payload, { contextModule: "admin" }),

  getDiningRequests: (params = {}) =>
    apiClient.get("/food/admin/dining/requests", { params, contextModule: "admin" }),
  reviewDiningRequest: (id, payload) =>
    apiClient.patch(`/food/admin/dining/requests/${id}/review`, payload, { contextModule: "admin" }),

  getDiningRestaurants: (params = {}) =>
    apiClient.get("/food/admin/dining/restaurants", { params, contextModule: "admin" }),
  setDiningCommissionOverride: (id, payload) =>
    apiClient.patch(`/food/admin/dining/restaurants/${id}/commission`, payload, { contextModule: "admin" }),

  getDiningBookings: (params = {}) =>
    apiClient.get("/food/admin/dining/bookings", { params, contextModule: "admin" }),
  getDiningBills: (params = {}) =>
    apiClient.get("/food/admin/dining/bills", { params, contextModule: "admin" }),
  getDiningRevenueStats: () =>
    apiClient.get("/food/admin/dining/revenue", { contextModule: "admin" }),

  getTransactionReport: (params = {}) =>
    apiClient.get("/food/admin/reports/transactions", {
      params: { page: 1, limit: 50, ...params },
      contextModule: "admin",
    }),
  getTaxReport: (params = {}) =>
    apiClient.get("/food/admin/reports/tax", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  getTaxReportDetail: (id, params = {}) =>
    apiClient.get(`/food/admin/reports/tax/${id}`, {
      params,
      contextModule: "admin",
    }),
  /** Get single zone by id */
  getZoneById: (id) =>
    apiClient.get(`/food/admin/zones/${id}`, { contextModule: "admin" }),
  /** Create zone. Body: name, zoneName?, country?, unit?, coordinates, isActive? */
  createZone: (body) =>
    apiClient
      .post("/food/admin/zones", body ?? {}, { contextModule: "admin" })
      .finally(() => {
        adminZonesListCache.clear();
      }),
  /** Update zone. Body: name?, zoneName?, country?, unit?, coordinates?, isActive? */
  updateZone: (id, body) =>
    apiClient
      .patch(`/food/admin/zones/${id}`, body ?? {}, {
        contextModule: "admin",
      })
      .finally(() => {
        adminZonesListCache.clear();
      }),
  /** Delete zone */
  deleteZone: (id) =>
    apiClient
      .delete(`/food/admin/zones/${id}`, { contextModule: "admin" })
      .finally(() => {
        adminZonesListCache.clear();
      }),

  /** Feedback Experience (admin) */
  getFeedbackExperiences: (params = {}) =>
    apiClient.get(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, {
      params,
      contextModule: "admin",
    }),
  deleteFeedbackExperience: (id) =>
    apiClient.delete(`${API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE}/${id}`, {
      contextModule: "admin",
    }),

  /** Public env variables (safe subset). Used for runtime keys like Google Maps. */
  // getPublicEnvVariables removed: rely on import.meta.env instead.

  /** Public categories (user app) - zone-aware */
  getPublicCategories: (params = {}, config = {}) =>
    apiClient.get("/food/restaurant/categories/public", {
      params: params ?? {},
      ...config,
    }),

  /** Offers & Coupons (admin) */
  getAllOffers: (params = {}) =>
    apiClient.get("/food/admin/offers", { params, contextModule: "admin" }),
  createAdminOffer: (body) =>
    apiClient.post("/food/admin/offers", body ?? {}, {
      contextModule: "admin",
    }),
  updateAdminOffer: (offerId, body) =>
    apiClient.patch(`/food/admin/offers/${String(offerId)}`, body ?? {}, {
      contextModule: "admin",
    }),
  updateAdminOfferStatus: (offerId, status) =>
    apiClient.patch(
      `/food/admin/offers/${String(offerId)}/status`,
      { status: String(status) },
      { contextModule: "admin" },
    ),
  updateAdminOfferCartVisibility: (offerId, itemId, showInCart) =>
    apiClient.patch(
      `/food/admin/offers/${String(offerId)}/cart-visibility`,
      { itemId: String(itemId), showInCart: Boolean(showInCart) },
      { contextModule: "admin" },
    ),
  deleteAdminOffer: (offerId) =>
    apiClient.delete(`/food/admin/offers/${String(offerId)}`, {
      contextModule: "admin",
    }),

  /** Delivery Partner Bonus (admin) */
  getDeliveryPartnerBonusTransactions: (params = {}) =>
    apiClient.get("/food/admin/delivery/bonus-transactions", {
      params: {
        page: params.page ?? 1,
        limit: Math.min(Number(params.limit) || 20, 100),
        ...(params.search ? { search: String(params.search).trim() } : {}),
      },
      contextModule: "admin",
    }),
  /** Delivery Earnings (admin) */
  getDeliveryEarnings: (params = {}) =>
    apiClient.get("/food/admin/delivery/earnings", {
      params,
      contextModule: "admin",
    }),
  getAdvertisements: (params = {}) =>
    apiClient.get("/food/admin/advertisements", {
      params,
      contextModule: "admin",
    }),
  updateAdvertisement: (adId, body) =>
    apiClient.patch(`/food/admin/advertisements/${String(adId)}`, body, {
      contextModule: "admin",
    }),
  addDeliveryPartnerBonus: (deliveryPartnerId, amount, reference = "", idempotencyKey = null) =>
    apiClient.post(
      "/food/admin/delivery/bonus",
      {
        deliveryPartnerId: String(deliveryPartnerId),
        amount: Number(amount),
        reference: String(reference || ""),
        ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : {}),
      },
      {
        contextModule: "admin",
        headers: idempotencyKey
          ? { "Idempotency-Key": String(idempotencyKey) }
          : undefined,
      },
    ),

  /** Earning Addon Offers (admin) */
  getEarningAddons: (params = {}) =>
    apiClient.get("/food/admin/delivery/earning-addons", {
      params,
      contextModule: "admin",
    }),
  createEarningAddon: (body) =>
    apiClient.post("/food/admin/delivery/earning-addons", body ?? {}, {
      contextModule: "admin",
    }),
  updateEarningAddon: (id, body) =>
    apiClient.patch(
      `/food/admin/delivery/earning-addons/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  deleteEarningAddon: (id) =>
    apiClient.delete(`/food/admin/delivery/earning-addons/${String(id)}`, {
      contextModule: "admin",
    }),
  toggleEarningAddonStatus: (id, status) =>
    apiClient.patch(
      `/food/admin/delivery/earning-addons/${String(id)}/status`,
      { status: String(status) },
      { contextModule: "admin" },
    ),

  /** Earning Addon History (admin) */
  getEarningAddonHistory: (params = {}) =>
    apiClient.get("/food/admin/delivery/earning-addon-history", {
      params,
      contextModule: "admin",
    }),
  creditEarningToWallet: (historyId, notes = "") =>
    apiClient.post(
      `/food/admin/delivery/earning-addon-history/${String(historyId)}/credit`,
      { notes: String(notes || "") },
      { contextModule: "admin" },
    ),
  cancelEarningAddonHistory: (historyId, reason = "") =>
    apiClient.post(
      `/food/admin/delivery/earning-addon-history/${String(historyId)}/cancel`,
      { reason: String(reason || "") },
      { contextModule: "admin" },
    ),
  checkEarningAddonCompletions: (deliveryPartnerId, force = false) =>
    apiClient.post(
      "/food/admin/delivery/earning-addon-completions/check",
      { deliveryPartnerId: String(deliveryPartnerId), force: Boolean(force) },
      { contextModule: "admin" },
    ),
  getDeliveryWallets: (params = {}) =>
    apiClient.get("/food/admin/delivery/wallets", {
      params,
      contextModule: "admin",
    }),
  getDeliveryWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/delivery/withdrawals", {
      params,
      contextModule: "admin",
    }),
  updateDeliveryWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/delivery/withdrawals/${String(id)}`, body, {
      contextModule: "admin",
    }),
  getDepositPaymentSettings: () =>
    apiClient.get("/food/admin/deposit-payment-settings", {
      contextModule: "admin",
    }),
  updateDepositPaymentSettings: (data) =>
    apiClient.patch("/food/admin/deposit-payment-settings", data, {
      contextModule: "admin",
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getCashLimitSettlements: (params = {}) =>
    apiClient.get("/food/admin/delivery/cash-limit-settlements", {
      params,
      contextModule: "admin",
    }),
  getCashPayRequests: (params = {}) =>
    apiClient.get("/food/admin/delivery/cash-pay-requests", {
      params,
      contextModule: "admin",
    }),
  updateCashPayRequestStatus: (id, body) =>
    apiClient.patch(`/food/admin/delivery/cash-pay-requests/${String(id)}`, body, {
      contextModule: "admin",
    }),
  getZoneHubs: (params = {}) =>
    apiClient.get("/food/admin/zone-hubs", {
      params,
      contextModule: "admin",
    }),
  getRestaurantsInZone: (id) =>
    apiClient.get(`/food/admin/zones/${String(id)}/restaurants`, {
      contextModule: "admin",
    }),
  createZoneHub: (body) =>
    apiClient.post("/food/admin/zone-hubs", body ?? {}, {
      contextModule: "admin",
    }),
  getCODVerifications: (params = {}) =>
    apiClient.get("/food/admin/zone-hubs/cod-verification", {
      params,
      contextModule: "admin",
    }),
  settleCODVerification: (id, body) =>
    apiClient.post(`/food/admin/zone-hubs/cod-verification/${String(id)}/action`, body ?? {}, {
      contextModule: "admin",
    }),

  /** Backward-compatible alias used in UI */
  getApprovedRestaurants: (params = {}) =>
    apiClient.get("/food/admin/restaurants", {
      params: { status: "approved", limit: 1000, ...params },
      contextModule: "admin",
    }),

  /** Fee Settings (admin) */
  getFeeSettings: () =>
    apiClient.get("/food/admin/fee-settings", { contextModule: "admin" }),
  getPublicFeeSettings: () => apiClient.get("/food/fee-settings/public"),
  createOrUpdateFeeSettings: (body) =>
    apiClient.put("/food/admin/fee-settings", body ?? {}, {
      contextModule: "admin",
    }),

  /** Referral Settings (admin) */
  getReferralSettings: () =>
    apiClient.get("/food/admin/referral-settings", { contextModule: "admin" }),
  createOrUpdateReferralSettings: (body) =>
    apiClient.put("/food/admin/referral-settings", body ?? {}, {
      contextModule: "admin",
    }),

  /** Safety / Emergency Reports (admin) */
  getSafetyEmergencyReports: (params) =>
    apiClient.get("/food/admin/safety-emergency-reports", {
      params: params ?? {},
      contextModule: "admin",
    }),
  updateSafetyEmergencyStatus: (id, status) =>
    apiClient.put(
      `/food/admin/safety-emergency-reports/${String(id)}/status`,
      { status: String(status) },
      { contextModule: "admin" },
    ),
  updateSafetyEmergencyPriority: (id, priority) =>
    apiClient.put(
      `/food/admin/safety-emergency-reports/${String(id)}/priority`,
      { priority: String(priority) },
      { contextModule: "admin" },
    ),
  deleteSafetyEmergencyReport: (id) =>
    apiClient.delete(`/food/admin/safety-emergency-reports/${String(id)}`, {
      contextModule: "admin",
    }),

  /** Delivery Cash Limit (admin) */
  getDeliveryCashLimit: () =>
    apiClient.get("/food/admin/delivery-cash-limit", {
      contextModule: "admin",
    }),
  updateDeliveryCashLimit: (body) =>
    apiClient.patch("/food/admin/delivery-cash-limit", body ?? {}, {
      contextModule: "admin",
    }),

  /** Restaurant Withdrawal Limits (admin) — separate from delivery */
  getRestaurantWithdrawalLimit: () =>
    apiClient.get("/food/admin/restaurant-withdrawal-limit", {
      contextModule: "admin",
    }),
  updateRestaurantWithdrawalLimit: (body) =>
    apiClient.patch("/food/admin/restaurant-withdrawal-limit", body ?? {}, {
      contextModule: "admin",
    }),

  /** Delivery Emergency Help (admin) */
  getEmergencyHelp: () =>
    apiClient.get("/food/admin/delivery-emergency-help", {
      contextModule: "admin",
    }),
  createOrUpdateEmergencyHelp: (body) =>
    apiClient.put("/food/admin/delivery-emergency-help", body ?? {}, {
      contextModule: "admin",
    }),

  /** Restaurant add-ons approval (admin) */
  getRestaurantAddons: (params = {}) =>
    apiClient.get("/food/admin/addons", {
      params: params ?? {},
      contextModule: "admin",
    }),
  updateRestaurantAddon: (id, body) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  approveRestaurantAddon: (id) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectRestaurantAddon: (id, reason) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  /** Global Business Settings (common) */
  getBusinessSettings: () =>
    apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, {
      contextModule: "admin",
    }),
  updateBusinessSettings: (data, files = {}) => {
    const formData = new FormData();
    // Add JSON data as a string in the 'data' field
    formData.append("data", JSON.stringify(data));
    
    // Add files with the same names expected by the backend
    const fileFields = [
      'logo', 'adminLogo', 'adminFavicon', 'userLogo', 'userFavicon', 
      'deliveryLogo', 'deliveryFavicon', 'restaurantLogo', 'restaurantFavicon', 
      'sellerLogo', 'sellerFavicon', 'favicon', 'loginBanner', 'sellerLoginBanner', 'restaurantLoginBanner'
    ];
    fileFields.forEach(field => {
      if (files[field]) {
        formData.append(field, files[field]);
      }
    });

    return apiClient.patch(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, formData, {
      contextModule: "admin",
    });
  },
  /** GET /food/admin/customer-role-requests (Bearer ADMIN) */
  getCustomerRoleRequests: () =>
    apiClient.get("/food/admin/customer-role-requests", { contextModule: "admin" }),
  /** PATCH /food/admin/customer-role-requests/:id/status (Bearer ADMIN) */
  updateCustomerRoleRequestStatus: (id, status) =>
    apiClient.patch(`/food/admin/customer-role-requests/${id}/status`, { status }, { contextModule: "admin" }),
  getRestaurantCoupons: () =>
    apiClient.get("/food/admin/restaurant-coupons", { contextModule: "admin" }),
  updateRestaurantCouponStatus: (id, status) =>
    apiClient.patch(`/food/admin/restaurant-coupons/${id}/status`, { status }, { contextModule: "admin" }),
  getAdvertisements: () =>
    apiClient.get("/food/admin/advertisements", { contextModule: "admin" }),
  getAdvertisementRequests: () =>
    apiClient.get("/food/admin/advertisement-requests", { contextModule: "admin" }),
  createAdvertisement: (formData) =>
    apiClient.post("/food/admin/advertisements", formData, {
      contextModule: "admin",
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateAdvertisementStatus: (id, status) =>
    apiClient.patch(`/food/admin/advertisements/${id}/status`, { status }, { contextModule: "admin" }),
  updateAdvertisementPriority: (id, priority) =>
    apiClient.patch(`/food/admin/advertisements/${id}/priority`, { priority }, { contextModule: "admin" }),
  deleteAdvertisement: (id) =>
    apiClient.delete(`/food/admin/advertisements/${id}`, { contextModule: "admin" }),
  getDeletedAccounts: () =>
    apiClient.get("/food/admin/deleted-accounts", { contextModule: "admin" }),
  reactivateAccount: (id, role) =>
    apiClient.post(`/food/admin/deleted-accounts/${id}/reactivate`, { role }, { contextModule: "admin" }),
};

/** Restaurant API - OTP login via new backend; no email/password. */
export const restaurantAPI = {
  sendOTP: (phone, _purpose = "login") => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestRestaurantOtp(phone);
  },
  verifyOTP: (phone, otp, _purpose, _name, _email, fcmToken = null, platform = "web") => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyRestaurantOtp(phone, otp, fcmToken, platform);
  },
  getMe: () => authService.getMe("restaurant"),
  /** Restaurant dashboard: fetch current restaurant profile (deduped + short-cached). */
  getCurrentRestaurant: () => getRestaurantCurrentOnce(),
  /** Update live location for Street Food Vendors */
  updateLiveLocation: (latitude, longitude, address) =>
    apiClient.put(
      "/food/restaurant/live-location",
      { latitude, longitude, address },
      { contextModule: "restaurant" },
    ),
  /** Update live tracking broadcast status for Street Food Vendors */
  updateLiveTrackingStatus: (enabled) =>
    apiClient.put(
      "/food/restaurant/live-tracking-status",
      { enabled },
      { contextModule: "restaurant" },
    ),
  /** Dining (table booking) — restaurant side */
  getDiningProfile: () =>
    apiClient.get("/food/restaurant/dining/profile", { contextModule: "restaurant" }),
  requestDining: () =>
    apiClient.post("/food/restaurant/dining/request", {}, { contextModule: "restaurant" }),
  updateDiningSetup: (payload) =>
    apiClient.patch("/food/restaurant/dining/setup", payload, { contextModule: "restaurant" }),
  toggleDiningEnabled: (enabled) =>
    apiClient.patch("/food/restaurant/dining/toggle", { enabled }, { contextModule: "restaurant" }),
  getDiningReservations: (params = {}) =>
    apiClient.get("/food/restaurant/dining/reservations", { params, contextModule: "restaurant" }),
  updateDiningReservationStatus: (id, payload) =>
    apiClient.patch(`/food/restaurant/dining/reservations/${id}/status`, payload, { contextModule: "restaurant" }),
  saveDiningBill: (reservationId, payload) =>
    apiClient.put(`/food/restaurant/dining/reservations/${reservationId}/bill`, payload, { contextModule: "restaurant" }),
  finalizeDiningBill: (billId) =>
    apiClient.post(`/food/restaurant/dining/bills/${billId}/finalize`, {}, { contextModule: "restaurant" }),
  getDiningBill: (billId) =>
    apiClient.get(`/food/restaurant/dining/bills/${billId}`, { contextModule: "restaurant" }),
  /**
   * Order payout / Hub Finance (canonical — food_transactions ledger).
   * Do NOT use deprecated GET /food/payments/restaurant/:id/wallet for payouts.
   */
  getFinance: (params = {}) =>
    apiClient.get("/food/restaurant/finance", {
      contextModule: "restaurant",
      params: params || {},
    }),
  /**
   * Subscription daily-pass wallet (canonical — food_restaurant_wallets.subscriptionBalance).
   * Do NOT use deprecated GET /food/payments/restaurant/:id/wallet for subscription balance.
   */
  getSubscriptionWallet: () =>
    apiClient.get("/food/restaurant/subscription-wallet", {
      contextModule: "restaurant",
    }),
  /** Create a topup order for subscription wallet. */
  createSubscriptionTopupOrder: (amount) =>
    apiClient.post("/food/restaurant/subscription-topup", { amount: Number(amount) }, {
      contextModule: "restaurant"
    }),
  /** Verify topup payment and credit wallet. */
  verifyTopup: (data) =>
    apiClient.post("/food/restaurant/verify-topup", data, {
      contextModule: "restaurant"
    }),
  /** Get current recurring subscription status. */
  getMySubscription: () =>
    apiClient.get("/food/subscriptions/my-subscription", {
      contextModule: "restaurant"
    }),
  /** Fetch restaurant by owner (stub for missing backend endpoint). */
  getRestaurantByOwner: () =>
    Promise.resolve({
      data: {
        success: true,
        data: {
          restaurant: {
            name: "Your Restaurant",
            restaurantId: "REST000001",
            address: "Your address",
          },
        },
      },
    }),
  /** Submit a real withdrawal request to the backend. */
  createWithdrawalRequest: (amount, options = {}) => {
    const body = { amount: Number(amount) };
    const key = String(options?.idempotencyKey || "").trim();
    if (key.length >= 8) body.idempotencyKey = key.slice(0, 128);
    return apiClient.post("/food/restaurant/withdraw", body, {
      contextModule: "restaurant"
    });
  },
  /** Cancel a pending restaurant withdrawal. */
  cancelWithdrawalRequest: (id) =>
    apiClient.post(`/food/restaurant/withdrawals/${id}/cancel`, {}, {
      contextModule: "restaurant"
    }),
  /** List withdrawal history for current restaurant (supports page, limit, status). */
  getWithdrawalHistory: (params = {}) =>
    apiClient.get("/food/restaurant/withdrawals", {
      contextModule: "restaurant",
      params: params || {},
    }),
  getCODDeposits: (params = {}) =>
    apiClient.get("/food/restaurant/finance/cod-verification", {
      contextModule: "restaurant",
      params: params || {},
    }),
  processCODDeposit: (id, formData) =>
    apiClient.post(`/food/restaurant/finance/cod-verification/${String(id)}/action`, formData, {
      contextModule: "restaurant",
      headers: { "Content-Type": "multipart/form-data" },
    }),
  /** Update restaurant profile fields (name/cuisines/location/menuImages). */
  updateProfile: (body) =>
    apiClient
      .patch("/food/restaurant/profile", body ?? {}, {
        contextModule: "restaurant",
      })
      .then((res) => {
        // Keep cache coherent to avoid an immediate refetch storm.
        restaurantCurrentCached = res;
        restaurantCurrentCacheTime = Date.now();
        return res;
      }),
  /** PATCH /food/restaurant/availability. Body: { isAcceptingOrders: boolean } */
  updateAcceptingOrders: (isAcceptingOrders) =>
    apiClient
      .patch(
        "/food/restaurant/availability",
        { isAcceptingOrders: Boolean(isAcceptingOrders) },
        { contextModule: "restaurant" },
      )
      .then((res) => {
        // Keep cache coherent to avoid an immediate refetch storm.
        restaurantCurrentCached = res;
        restaurantCurrentCacheTime = Date.now();
        return res;
      }),
  /** Check subscription eligibility before going online. */
  checkSubscriptionEligibility: () =>
    apiClient.get("/food/restaurant/subscription-eligibility", {
      contextModule: "restaurant",
    }),
  /** Upload and set restaurant profile image (multipart). Field name: file */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/restaurant/profile/profile-image", formData, {
      contextModule: "restaurant",
    });
  },
  /** Upload a menu/cover image (multipart). Does not auto-attach; use updateProfile(menuImages) after. */
  uploadMenuImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/restaurant/profile/menu-image", formData, {
      contextModule: "restaurant",
    });
  },
  uploadCoverImages: (files = []) => {
    const normalizedFiles = Array.from(files || []).filter(Boolean);
    if (normalizedFiles.length === 0) {
      return Promise.reject(new Error("At least one file is required"));
    }
    const formData = new FormData();
    normalizedFiles.forEach((file) => formData.append("files", file));
    return apiClient.post("/food/restaurant/profile/cover-images", formData, {
      contextModule: "restaurant",
    });
  },
  uploadMenuImages: (files = []) => {
    const normalizedFiles = Array.from(files || []).filter(Boolean);
    if (normalizedFiles.length === 0) {
      return Promise.reject(new Error("At least one file is required"));
    }
    const formData = new FormData();
    normalizedFiles.forEach((file) => formData.append("files", file));
    return apiClient.post("/food/restaurant/profile/menu-images", formData, {
      contextModule: "restaurant",
    });
  },
  /** Delete current restaurant account. */
  deleteAccount: () =>
    apiClient.delete("/food/restaurant/delete-account", {
      contextModule: "restaurant",
    }),
  /** Public Offers for users (global/selected restaurant) */
  getPublicOffers: () =>
    apiClient.get("/food/restaurant/offers", {
      contextModule: "user",
    }),
  /** Backward-compat helper used by Cart: returns coupons array for an item by adapting public offers */
  getCouponsByItemIdPublic: (restaurantId, _itemId, subtotal) =>
    apiClient.get("/food/restaurant/offers", {
      contextModule: "user",
      params: {
        restaurantId,
        ...(subtotal != null && subtotal !== "" ? { subtotal: Number(subtotal) || 0 } : {}),
      },
    }).then((res) => {
      const list = res?.data?.data?.allOffers || res?.data?.allOffers || [];
      const coupons = list.map((o) => {
        const isPct = o.discountType === "percentage";
        const discountValue = Number(o.discountValue) || 0;
        const estimatedDiscount = Number(o.estimatedDiscount) || 0;
        const displayDiscount = Number(o.displayDiscount) || (isPct ? estimatedDiscount : discountValue);
        const customerScope = o.customerScope || "all";
        const isFirstTime =
          customerScope === "first-time" || o.isFirstOrderOnly === true;
        return {
          couponCode: o.couponCode,
          discountType: o.discountType,
          discountValue,
          discountPercentage: isPct ? discountValue : 0,
          displayDiscount,
          originalPrice: Number(subtotal) || 0,
          discountedPrice: Math.max(0, (Number(subtotal) || 0) - estimatedDiscount),
          minOrderValue: Number(o.minOrderValue || 0),
          minOrder: Number(o.minOrderValue || 0),
          maxDiscount: o.maxDiscount != null ? Number(o.maxDiscount) : null,
          customerGroup: isFirstTime ? "first-time" : "all",
          customerScope: isFirstTime ? "first-time" : "all",
          isFirstOrderOnly: Boolean(o.isFirstOrderOnly),
          isGlobalCoupon: o.restaurantScope !== "selected",
          restaurantScope: o.restaurantScope || "all",
          endDate: o.endDate || null,
          showInCart: o.showInCart !== false,
          estimatedDiscount,
          couponSource: o.couponSource || "admin",
          meetsMinOrder: o.meetsMinOrder !== false,
          amountToUnlock: Number(o.amountToUnlock || 0),
        };
      });
      return { data: { success: true, data: { coupons } } };
    }),
  /** Categories (restaurant dashboard) */
  getCategories: (params = {}) =>
    // Compact payload for item creation forms (id + name only).
    apiClient.get("/food/restaurant/categories", {
      params: { compact: true, limit: 1000, ...params },
      contextModule: "restaurant",
    }),
  // For MenuCategoriesPage compatibility
  getAllCategories: (params = {}) =>
    apiClient.get("/food/restaurant/categories", {
      params: {
        includeInactive: true,
        withCounts: true,
        limit: 1000,
        ...params,
      },
      contextModule: "restaurant",
    }),
  // Live status of a single category (used to dynamically warn when a category
  // has been deactivated by the admin).
  getCategoryStatus: (id) =>
    apiClient.get(`/food/restaurant/categories/${String(id)}/status`, {
      contextModule: "restaurant",
    }),
  createCategory: (body) =>
    apiClient.post("/food/restaurant/categories", body ?? {}, {
      contextModule: "restaurant",
    }),
  updateCategory: (id, body) =>
    apiClient.patch(`/food/restaurant/categories/${String(id)}`, body ?? {}, {
      contextModule: "restaurant",
    }),
  deleteCategory: (id) =>
    apiClient.delete(`/food/restaurant/categories/${String(id)}`, {
      contextModule: "restaurant",
    }),
  /** Item slot timings (restaurant dashboard) */
  getItemSlotTimings: () =>
    apiClient.get("/food/restaurant/item-slot-timings", {
      contextModule: "restaurant",
    }),
  getItemSlotTimingById: (id) =>
    apiClient.get(`/food/restaurant/item-slot-timings/${String(id)}`, {
      contextModule: "restaurant",
    }),
  createItemSlotTiming: (body) =>
    apiClient.post("/food/restaurant/item-slot-timings", body ?? {}, {
      contextModule: "restaurant",
    }),
  updateItemSlotTiming: (id, body) =>
    apiClient.patch(`/food/restaurant/item-slot-timings/${String(id)}`, body ?? {}, {
      contextModule: "restaurant",
    }),
  deleteItemSlotTiming: (id) =>
    apiClient.delete(`/food/restaurant/item-slot-timings/${String(id)}`, {
      contextModule: "restaurant",
    }),
  /** Menu (restaurant dashboard) */
  getMenu: (params = {}) =>
    apiClient.get("/food/restaurant/menu", {
      params,
      contextModule: "restaurant",
    }),
  /** Orders (restaurant dashboard) */
  getOrders: (params = {}) =>
    apiClient.get("/food/restaurant/orders", {
      params: { limit: 50, page: 1, ...params },
      contextModule: "restaurant",
    }),
  getOrderById: (orderId) =>
    apiClient.get(`/food/restaurant/orders/${String(orderId)}`, {
      contextModule: "restaurant",
    }),
  updateMenu: (body) =>
    apiClient.patch("/food/restaurant/menu", body ?? {}, {
      contextModule: "restaurant",
    }),
  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "restaurant" },
    );
  },
  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "restaurant",
      },
    );
  },
  /** Outlet timings (restaurant dashboard) */
  getOutletTimings: () =>
    apiClient.get("/food/restaurant/outlet-timings", {
      contextModule: "restaurant",
    }),
  saveOutletTimings: (outletTimings) =>
    apiClient.put(
      "/food/restaurant/outlet-timings",
      { outletTimings: outletTimings || {} },
      { contextModule: "restaurant" },
    ),
  /** Foods (restaurant) - stored in food_items collection */
  createFood: (body) =>
    apiClient.post("/food/restaurant/foods", body ?? {}, {
      contextModule: "restaurant",
    }),
  updateFood: (id, body) =>
    apiClient.patch(`/food/restaurant/foods/${String(id)}`, body ?? {}, {
      contextModule: "restaurant",
    }),
  /** Orders (restaurant dashboard) — single-flight + short TTL; one cache per query key. */
  getOrders: (() => {
    let inFlight = null;
    let inFlightKey = "";
    let cache = null;
    let cacheKey = "";
    let cacheAt = 0;
    // Coalesce OrdersMain tabs, popup fallback, and alert poll when they share params.
    const CACHE_MS = 2500;
    /** Canonical dashboard list size (tabs + popup + socket-fallback alerts). */
    const DASHBOARD_DEFAULTS = { limit: 50, page: 1 };

    const buildKey = (p = {}) => JSON.stringify({ ...DASHBOARD_DEFAULTS, ...p });

    const getOrders = (params = {}) => {
      const key = buildKey(params);
      const now = Date.now();

      if (cache && cacheKey === key && now - cacheAt < CACHE_MS) {
        return Promise.resolve(cache);
      }

      if (inFlight && inFlightKey === key) return inFlight;

      inFlightKey = key;
      inFlight = apiClient
        .get("/food/restaurant/orders", {
          params: { ...DASHBOARD_DEFAULTS, ...params },
          contextModule: "restaurant",
        })
        .then((res) => {
          // Backend paginated shape: { data: { data: [...], meta: {...} } }
          // Normalize to { data: { data: { orders: [...], meta } } } for restaurant UI pages.
          const payload = res?.data?.data || {};
          const rowsRaw = Array.isArray(payload.data) ? payload.data : [];

          // Normalize backend order fields to match existing restaurant UI expectations.
          // UI historically uses: order.status, order.address, order.total, order.paymentMethod
          const normalizeStatus = (s) => {
            const v = String(s || "").toLowerCase();
            // Backend: created -> treat as confirmed/new in UI
            if (v === "created") return "confirmed";
            // Backend: ready_for_pickup -> ready
            if (v === "ready_for_pickup") return "ready";
            // Backend: picked_up -> out_for_delivery (restaurant handed over)
            if (v === "picked_up") return "out_for_delivery";
            if (v.includes("cancel")) return "cancelled";
            return v || "confirmed";
          };

          const rows = rowsRaw.map((o) => {
            const status = normalizeStatus(o.orderStatus || o.status);
            const address = o.deliveryAddress || o.address;
            const total = o.pricing?.total ?? o.total ?? 0;
            const paymentMethod = o.payment?.method || o.paymentMethod || null;
            return { ...o, status, address, total, paymentMethod };
          });
          const meta = payload.meta || {};
          const normalized = {
            ...res,
            data: {
              ...res.data,
              data: { orders: rows, meta },
            },
          };

          cache = normalized;
          cacheKey = key;
          cacheAt = Date.now();
          return normalized;
        })
        .finally(() => {
          inFlight = null;
          inFlightKey = "";
        });

      return inFlight;
    };

    getOrders.invalidate = () => {
      cache = null;
      cacheKey = "";
      cacheAt = 0;
    };

    return getOrders;
  })(),
  updateOrderStatus: (orderId, body) => {
    const raw = body ?? {};
    const outgoing = { ...raw };

    // Translate UI-friendly statuses to backend enum values.
    const normalizeOutgoingStatus = (s) => {
      const v = String(s || "")
        .toLowerCase()
        .trim();
      if (!v) return v;
      if (v === "ready") return "ready_for_pickup";
      if (v === "out_for_delivery") return "picked_up";
      if (v === "cancelled") return "cancelled_by_restaurant";
      return v;
    };

    if (outgoing.orderStatus) {
      outgoing.orderStatus = normalizeOutgoingStatus(outgoing.orderStatus);
    }

    return apiClient.patch(
      `/food/restaurant/orders/${String(orderId)}/status`,
      outgoing,
      { contextModule: "restaurant" },
    );
  },
  /**
   * Accept an incoming order (restaurant).
   * UI expects this to move order into "preparing" bucket.
   * Backend supports PATCH /food/restaurant/orders/:orderId/status with { orderStatus }.
   */
  acceptOrder: (orderId, prepTimeMins = null) =>
    restaurantAPI.updateOrderStatus(orderId, {
      orderStatus: "preparing",
      ...(prepTimeMins != null && Number(prepTimeMins) > 0
        ? { prepTimeMins: Number(prepTimeMins) }
        : {}),
    }),
  /**
   * Reject/cancel order by restaurant.
   * Backend orderStatus enum: cancelled_by_restaurant.
   */
  rejectOrder: (orderId, _reason = "") =>
    restaurantAPI.updateOrderStatus(orderId, {
      orderStatus: "cancelled_by_restaurant",
      reason: String(_reason || "").trim(),
    }),
  /** Mark order ready (restaurant handoff). */
  markOrderReady: (orderId) =>
    restaurantAPI.updateOrderStatus(orderId, {
      orderStatus: "ready_for_pickup",
    }),
  /**
   * Get a single order by id for restaurant screens.
   * Prefer direct endpoint; fallback to list+filter for backward compatibility.
   */
  getOrderById: async (orderId) => {
    return await apiClient.get(`/food/restaurant/orders/${String(orderId)}`, {
      contextModule: "restaurant",
    });
  },
  /** Add-ons (restaurant) - approval handled by admin */
  getAddons: (params = {}) =>
    apiClient.get("/food/restaurant/addons", {
      // Backend validator enforces limit <= 100
      params: { limit: 100, page: 1, ...params },
      contextModule: "restaurant",
    }),
  addAddon: (body) =>
    apiClient.post("/food/restaurant/addons", body ?? {}, {
      contextModule: "restaurant",
    }),
  updateAddon: (id, body) =>
    apiClient.patch(`/food/restaurant/addons/${String(id)}`, body ?? {}, {
      contextModule: "restaurant",
    }),
  deleteAddon: (id) =>
    apiClient.delete(`/food/restaurant/addons/${String(id)}`, {
      contextModule: "restaurant",
    }),
  logout: (refreshToken) => {
    restaurantCurrentInFlight = null;
    restaurantCurrentCached = null;
    restaurantCurrentCacheTime = 0;
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("restaurant_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_restaurant") : null;
    return authService.logout(token, fcmToken, "web");
  },
  logoutAll: (refreshToken) => {
    restaurantCurrentInFlight = null;
    restaurantCurrentCached = null;
    restaurantCurrentCacheTime = 0;
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("restaurant_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_restaurant") : null;
    return authService.logoutAll(token, fcmToken, "web");
  },
  /** Backend has no email/password login; use phone OTP only. */
  login: (_email, _password) =>
    Promise.reject(new Error("Please use phone number and OTP to sign in.")),
  /**
   * Register a restaurant (multipart FormData).
   * Backend: POST /v1/food/restaurant/register (path relative to baseURL /api/v1)
   */
  register: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.post("/food/restaurant/register", formData);
  },
  /** Save an onboarding step incrementally (multipart FormData). */
  saveOnboardingStep: (step, formData) => {
    if (!step || !formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("Step and FormData are required"));
    }
    return apiClient.post(`/food/restaurant/onboarding/step/${step}`, formData);
  },
  /** Fetch in-progress onboarding draft by verified phone. */
  getOnboardingDraft: (phone) => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    const digits = String(phone).replace(/\D/g, "").slice(-15);
    return apiClient.get("/food/restaurant/onboarding/draft", {
      params: { phone: digits },
    });
  },
  /** Public: list approved restaurants for user app */
  getRestaurants: (params = {}, config = {}) =>
    getPublicRestaurantsOnce(params, config),
  /** Public: restaurants with dishes priced at or below ₹250 (single batched query) */
  getUnder250Restaurants: (params = {}, config = {}) =>
    getPublicUnder250RestaurantsOnce(params, config),
  /** @deprecated use getUnder250Restaurants */
  getRestaurantsUnder250: (zoneId, config = {}) =>
    getPublicUnder250RestaurantsOnce(
      zoneId ? { zoneId } : {},
      config,
    ),
  /** Public: get single approved restaurant by id or slug */
  getRestaurantById: (id, config = {}) =>
    apiClient.get(`/food/restaurant/restaurants/${String(id)}`, { ...config }),
  /** Public: get approved menu by restaurant id or slug */
  getMenuByRestaurantId: (id, config = {}) =>
    getPublicRestaurantMenuOnce(id, config),
  /** Public: batch fetch lightweight menu sections for multiple restaurants */
  getMenusBatch: (ids = [], config = {}) => {
    const safeIds = (Array.isArray(ids) ? ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!safeIds.length) {
      return Promise.resolve({ data: { success: true, data: { menus: {} } } });
    }
    const { noCache, ...axiosConfig } = config || {};
    if (noCache) {
      return apiClient.get("/food/restaurant/menus/batch", {
        params: { ids: safeIds.join(",") },
        ...axiosConfig,
      });
    }
    const key = `menus-batch:${stableStringify(safeIds.sort())}`;
    return publicMenusBatchCache.getOrCreate(key, () =>
      apiClient.get("/food/restaurant/menus/batch", {
        params: { ids: safeIds.join(",") },
        ...axiosConfig,
      }),
    );
  },
  /** Public: get outlet timings by restaurant id */
  getOutletTimingsByRestaurantId: (id, config = {}) =>
    getPublicRestaurantOutletTimingsOnce(id, config),
  /** Public (user app): approved add-ons by restaurant id/slug */
  getAddonsByRestaurantId: (id, config = {}) =>
    apiClient.get(`/food/restaurant/restaurants/${String(id)}/addons`, {
      ...config,
    }),
  getPublicOffers: (params = {}, config = {}) =>
    apiClient.get("/food/restaurant/offers", { params, ...config }),
  /** Resend delivery notification (restaurant dashboard) */
  resendDeliveryNotification: (orderId) =>
    apiClient.post(`/food/restaurant/orders/${String(orderId)}/resend-notification`, {}, {
      contextModule: "restaurant",
    }),
  /** List restaurant complaints (for current restaurant dashboard) */
  getComplaints: (params = {}) =>
    apiClient.get("/food/restaurant/complaints", {
      params,
      contextModule: "restaurant",
    }),
  /** Restaurant support tickets */
  createSupportTicket: (body = {}) =>
    apiClient.post("/food/restaurant/support/tickets", body ?? {}, {
      contextModule: "restaurant",
    }),
  getSupportTickets: (params = {}) =>
    apiClient.get("/food/restaurant/support/tickets", {
      params,
      contextModule: "restaurant",
    }),
  /** Referral stats and details (restaurant dashboard) */
  getReferralStats: () =>
    apiClient.get("/food/restaurant/referral-stats", {
      contextModule: "restaurant",
    }),
  getReferralDetails: () =>
    apiClient.get("/food/restaurant/referral-details", {
      contextModule: "restaurant",
    }),
  getCoupons: () =>
    apiClient.get("/food/restaurant/coupons", {
      contextModule: "restaurant",
    }),
  createCoupon: (body) =>
    apiClient.post("/food/restaurant/coupons", body ?? {}, {
      contextModule: "restaurant",
    }),
  updateCoupon: (id, body) =>
    apiClient.put(`/food/restaurant/coupons/${String(id)}`, body ?? {}, {
      contextModule: "restaurant",
    }),
  deleteCoupon: (id) =>
    apiClient.delete(`/food/restaurant/coupons/${String(id)}`, {
      contextModule: "restaurant",
    }),
  getAdvertisements: () =>
    apiClient.get("/food/restaurant/advertisements", {
      contextModule: "restaurant",
    }),
  getAdvertisement: (id) =>
    apiClient.get(`/food/restaurant/advertisements/${String(id)}`, {
      contextModule: "restaurant",
    }),
  createAdvertisement: (formData) =>
    apiClient.post("/food/restaurant/advertisements", formData, {
      contextModule: "restaurant",
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateAdvertisement: (id, formData) =>
    apiClient.put(`/food/restaurant/advertisements/${String(id)}`, formData, {
      contextModule: "restaurant",
      headers: { "Content-Type": "multipart/form-data" },
    }),
  pauseAdvertisement: (id) =>
    apiClient.patch(`/food/restaurant/advertisements/${String(id)}/pause`, {}, {
      contextModule: "restaurant",
    }),
  deleteAdvertisement: (id) =>
    apiClient.delete(`/food/restaurant/advertisements/${String(id)}`, {
      contextModule: "restaurant",
    }),
};

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function createInFlightCache({ ttlMs }) {
  const inFlight = new Map();
  const cached = new Map(); // key -> { t, v }

  const getCached = (key) => {
    const hit = cached.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > ttlMs) {
      cached.delete(key);
      return null;
    }
    return hit.v;
  };

  const getOrCreate = (key, factory) => {
    const cachedValue = getCached(key);
    if (cachedValue) return Promise.resolve(cachedValue);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = Promise.resolve()
      .then(factory)
      .then((res) => {
        cached.set(key, { t: Date.now(), v: res });
        return res;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, p);
    return p;
  };

  return { getOrCreate };
}

// Public user-app endpoints can be called by multiple components/effects on refresh (and React StrictMode in dev).
// A small in-flight + short TTL cache collapses duplicate requests without changing functionality.
const publicRestaurantsCache = createInFlightCache({ ttlMs: 60 * 1000 });
const publicRestaurantMenuCache = createInFlightCache({ ttlMs: 60 * 1000 });
const publicRestaurantOutletTimingsCache = createInFlightCache({ ttlMs: 60 * 1000 });
const publicGenericGetCache = createInFlightCache({ ttlMs: 60 * 1000 });
const publicMenusBatchCache = createInFlightCache({ ttlMs: 60 * 1000 });
const publicUnder250RestaurantsCache = createInFlightCache({ ttlMs: 60 * 1000 });

export const publicGetOnce = (url, config = {}) => {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...axiosConfig } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));

  if (noCache) {
    return apiClient.get(safeUrl, { params, ...axiosConfig });
  }

  const keyParams =
    params && typeof params === "object" ? { ...params } : params;
  if (keyParams && typeof keyParams === "object") {
    // `_ts` is used as a cache-buster in some call sites; ignore it for dedupe purposes.
    delete keyParams._ts;
  }

  const key = `GET:${safeUrl}:${stableStringify(keyParams)}`;
  return publicGenericGetCache.getOrCreate(key, () =>
    apiClient.get(safeUrl, { params, ...axiosConfig }),
  );
};

const getPublicRestaurantsOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  const normalizedParams = { ...(params || {}) };
  if (!normalizedParams.zoneId && typeof window !== "undefined") {
    const storedZoneId = window.localStorage?.getItem("userZoneId");
    if (storedZoneId) {
      normalizedParams.zoneId = storedZoneId;
    }
  }
  if (noCache) {
    return apiClient.get("/food/restaurant/restaurants", {
      params: { limit: 1000, ...normalizedParams },
      ...axiosConfig,
    });
  }
  const keyParams = { limit: 1000, ...normalizedParams };
  // `_ts` is an explicit cache-buster in many call sites; ignore it for dedupe purposes.
  if (keyParams && typeof keyParams === "object") {
    delete keyParams._ts;
  }
  const key = `restaurants:${stableStringify(keyParams)}`;
  return publicRestaurantsCache.getOrCreate(key, () =>
    apiClient.get("/food/restaurant/restaurants", {
      params: { limit: 1000, ...normalizedParams },
      ...axiosConfig,
    }),
  );
};

const getPublicUnder250RestaurantsOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  const normalizedParams = { ...(params || {}) };
  if (!normalizedParams.zoneId && typeof window !== "undefined") {
    const storedZoneId = window.localStorage?.getItem("userZoneId");
    if (storedZoneId) {
      normalizedParams.zoneId = storedZoneId;
    }
  }
  if (noCache) {
    return apiClient.get("/food/restaurant/restaurants/under-250", {
      params: normalizedParams,
      ...axiosConfig,
    });
  }
  const keyParams = { ...normalizedParams };
  if (keyParams && typeof keyParams === "object") {
    delete keyParams._ts;
  }
  const key = `under-250:${stableStringify(keyParams)}`;
  return publicUnder250RestaurantsCache.getOrCreate(key, () =>
    apiClient.get("/food/restaurant/restaurants/under-250", {
      params: normalizedParams,
      ...axiosConfig,
    }),
  );
};

const getPublicRestaurantMenuOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) {
    return Promise.resolve({
      data: { success: false, data: null },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });
  }
  if (noCache) {
    return apiClient.get(`/food/restaurant/restaurants/${safeId}/menu`, {
      ...axiosConfig,
    });
  }
  const key = `menu:${safeId}`;
  return publicRestaurantMenuCache.getOrCreate(key, () =>
    apiClient.get(`/food/restaurant/restaurants/${safeId}/menu`, {
      ...axiosConfig,
    }),
  );
};

const getPublicRestaurantOutletTimingsOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) {
    return Promise.resolve({
      data: { success: false, data: null },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });
  }
  if (noCache) {
    return apiClient.get(
      `/food/restaurant/restaurants/${safeId}/outlet-timings`,
      { ...axiosConfig },
    );
  }
  const key = `outletTimings:${safeId}`;
  return publicRestaurantOutletTimingsCache.getOrCreate(key, () =>
    apiClient.get(`/food/restaurant/restaurants/${safeId}/outlet-timings`, {
      ...axiosConfig,
    }),
  );
};

/** Single in-flight + short cache for restaurant /food/restaurant/current - prevents request storms. */
let restaurantCurrentInFlight = null;
let restaurantCurrentCached = null;
let restaurantCurrentCacheTime = 0;
const RESTAURANT_CURRENT_CACHE_MS = 3000;

const getRestaurantCurrentOnce = () => {
  const now = Date.now();
  if (
    restaurantCurrentCached &&
    now - restaurantCurrentCacheTime < RESTAURANT_CURRENT_CACHE_MS
  ) {
    return Promise.resolve(restaurantCurrentCached);
  }
  if (!restaurantCurrentInFlight) {
    restaurantCurrentInFlight = apiClient
      .get("/food/restaurant/current", { contextModule: "restaurant" })
      .then((res) => {
        restaurantCurrentCached = res;
        restaurantCurrentCacheTime = Date.now();
        return res;
      })
      .finally(() => {
        restaurantCurrentInFlight = null;
      });
  }
  return restaurantCurrentInFlight;
};

/** Single in-flight + short cache for delivery /auth/me - one call per page load / refresh. */
let deliveryMeInFlight = null;
let deliveryMeCached = null;
let deliveryMeCacheTime = 0;
const DELIVERY_ME_CACHE_MS = 3000;

const getDeliveryMeOnce = () => {
  const now = Date.now();
  if (deliveryMeCached && now - deliveryMeCacheTime < DELIVERY_ME_CACHE_MS) {
    return Promise.resolve(deliveryMeCached);
  }
  if (!deliveryMeInFlight) {
    deliveryMeInFlight = authService
      .getMe("delivery")
      .then((res) => {
        deliveryMeCached = res;
        deliveryMeCacheTime = Date.now();
        return res;
      })
      .finally(() => {
        deliveryMeInFlight = null;
      });
  }
  return deliveryMeInFlight;
};

/** Delivery API - OTP login + registration via new backend. */
export const deliveryAPI = {
  sendOTP: (phone, _purpose = "login") => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestDeliveryOtp(phone);
  },
  verifyOTP: (phone, otp, _purpose, _name, fcmToken = null, platform = "web") => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyDeliveryOtp(phone, otp, fcmToken, platform);
  },
  getMe: () => getDeliveryMeOnce(),
  /** Get delivery profile (same as getMe under the hood; maps response to profile shape). */
  getProfile: () =>
    getDeliveryMeOnce().then((res) => ({
      ...res,
      data: {
        ...res.data,
        data: { profile: res.data?.data?.user ?? res.data?.data },
      },
    })),
  getMapContext: () =>
    apiClient.get("/food/delivery/map/context", { contextModule: "delivery" }),
  getReferralStats: () =>
    apiClient.get("/food/delivery/referrals/stats", {
      contextModule: "delivery",
    }),
  logout: (refreshToken) => {
    deliveryMeCached = null;
    deliveryMeCacheTime = 0;
    try {
      localStorage.removeItem("app:isOnline");
    } catch (_) {}
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("delivery_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_delivery") : null;
    return authService.logout(token, fcmToken, "web");
  },
  /** POST /food/delivery/register - multipart FormData (new partner, no token). */
  register: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(
        new Error("FormData with details and document files is required"),
      );
    }
    return apiClient.post("/food/delivery/register", formData);
  },
  validateDocumentsPublic: (data) => apiClient.post("/food/delivery/validate-documents-public", data),
  validateDocuments: (data) => apiClient.post("/food/delivery/validate-documents", data, { contextModule: "delivery" }),
  /** PATCH /food/delivery/profile - complete profile after OTP (Bearer token required). */
  completeProfile: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(
        new Error("FormData with details and document files is required"),
      );
    }
    return apiClient.patch("/food/delivery/profile", formData, {
      contextModule: "delivery",
    });
  },
  /** PATCH /food/delivery/profile/details - JSON updates (vehicle number, etc). */
  updateProfileDetails: (payload) =>
    apiClient.patch("/food/delivery/profile/details", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile - multipart updates for photos/documents (uses same endpoint). */
  updateProfileMultipart: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.patch("/food/delivery/profile", formData, {
      contextModule: "delivery",
    });
  },
  /** POST /food/delivery/profile/photo-base64 - Flutter in-app camera base64 upload. */
  updateProfilePhotoBase64: (payload) =>
    apiClient.post("/food/delivery/profile/photo-base64", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile/bank-details - update bank details + PAN (JSON, Bearer required). */
  updateProfile: (payload) =>
    apiClient.patch("/food/delivery/profile/bank-details", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile/bank-details - multipart updates for bank details + UPI QR (FormData required). */
  updateBankDetailsMultipart: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.patch("/food/delivery/profile/bank-details", formData, {
      contextModule: "delivery",
    });
  },
  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "delivery" },
    );
  },
  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "delivery",
      },
    );
  },
  /** GET /food/delivery/support-tickets - list tickets for logged-in delivery partner. */
  getSupportTickets: () =>
    apiClient.get("/food/delivery/support-tickets", {
      contextModule: "delivery",
    }),
  /** POST /food/delivery/support-tickets - create ticket (body: subject, description, category?, priority?). */
  createSupportTicket: (body) =>
    apiClient.post("/food/delivery/support-tickets", body ?? {}, {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/support-tickets/:id - get one ticket (own only). */
  getSupportTicketById: (id) =>
    apiClient.get(`/food/delivery/support-tickets/${id}`, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/availability - set online/offline (and optional lat/lng). */
  updateOnlineStatus: (() => {
    let statusQueue = Promise.resolve();
    return (isOnline) => {
      const run = () => {
        deliveryMeCached = null;
        deliveryMeCacheTime = 0;
        return apiClient.patch(
          "/food/delivery/availability",
          { status: isOnline ? "online" : "offline" },
          { contextModule: "delivery" },
        );
      };
      statusQueue = statusQueue.then(run, run);
      return statusQueue;
    };
  })(),
  getVehicles: (() => {
    let inFlight = null;
    let cache = null;
    let cacheTime = 0;
    const CACHE_MS = 3000;
    return (options = {}) => {
      if (options.force) {
        cache = null;
        cacheTime = 0;
      }
      const now = Date.now();
      if (cache && now - cacheTime < CACHE_MS) {
        return Promise.resolve(cache);
      }
      if (inFlight) return inFlight;
      inFlight = apiClient
        .get("/food/delivery/vehicles", { contextModule: "delivery" })
        .then((res) => {
          cache = res;
          cacheTime = Date.now();
          return res;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    };
  })(),
  setActiveVehicle: (() => {
    let switchQueue = Promise.resolve();
    const forceServerOffline = () =>
      apiClient.patch(
        "/food/delivery/availability",
        { status: "offline" },
        { contextModule: "delivery" },
      );

    const patchActiveVehicle = (vehicleId) => {
      deliveryMeCached = null;
      deliveryMeCacheTime = 0;
      return apiClient.patch(
        "/food/delivery/vehicles/active",
        { vehicleId },
        { contextModule: "delivery" },
      );
    };

    return (vehicleId) => {
      const run = async () => {
        await forceServerOffline().catch(() => {});
        try {
          return await patchActiveVehicle(vehicleId);
        } catch (err) {
          const msg = String(err?.response?.data?.message || err?.message || "");
          if (!/go offline before switching vehicle/i.test(msg)) throw err;
          await forceServerOffline();
          return patchActiveVehicle(vehicleId);
        }
      };
      switchQueue = switchQueue.then(run, run);
      return switchQueue;
    };
  })(),
  updateLocation: (latitude, longitude, _isOnline, extras = {}) =>
    apiClient.patch(
      "/food/delivery/availability",
      { latitude, longitude, ...extras },
      { contextModule: "delivery" },
    ),
  /** Orders */
  getOrders: (() => {
    // Collapse duplicate list fetches triggered by multiple effects + StrictMode.
    let inFlight = new Map(); // key -> Promise
    let cache = new Map(); // key -> { at, res }
    const CACHE_MS = 2500;

    const stableKey = (p = {}) => {
      const safe = p && typeof p === "object" ? { ...p } : {};
      // Ensure stable ordering + defaults.
      const normalized = { limit: 50, page: 1, ...safe };
      // Remove cache-busters if any.
      delete normalized._ts;
      return JSON.stringify(
        Object.keys(normalized)
          .sort()
          .reduce((acc, k) => {
            acc[k] = normalized[k];
            return acc;
          }, {}),
      );
    };

    return (params = {}) => {
      const key = stableKey(params);
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.at < CACHE_MS)
        return Promise.resolve(cached.res);

      const existing = inFlight.get(key);
      if (existing) return existing;

      const p = apiClient
        .get("/food/delivery/orders/available", {
          params: { limit: 50, page: 1, ...params },
          contextModule: "delivery",
        })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  getOrderDetails: (() => {
    // Collapse duplicate calls coming from multiple effects (and React StrictMode in dev).
    let inFlight = new Map(); // key -> Promise
    let cache = new Map(); // key -> { at, res }
    const CACHE_MS = 1200;

    const isProbablyOrderIdentity = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return false;
      // Mongo ObjectId
      return /^[a-f0-9]{24}$/i.test(raw);
    };

    return (orderId) => {
      const key = String(orderId || "").trim();
      if (!isProbablyOrderIdentity(key)) {
        return Promise.resolve({
          data: { success: false, message: "Invalid order id", data: null },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {},
        });
      }

      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.at < CACHE_MS)
        return Promise.resolve(cached.res);

      const existing = inFlight.get(key);
      if (existing) return existing;

      const p = apiClient
        .get(`/food/delivery/orders/${key}`, { contextModule: "delivery" })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  /** GET /food/delivery/orders/current — in-flight dedupe for sync/recovery overlap. */
  getCurrentDelivery: (() => {
    let inFlight = null;
    return () => {
      if (inFlight) return inFlight;
      inFlight = apiClient
        .get("/food/delivery/orders/current", { contextModule: "delivery" })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    };
  })(),
  acceptOrder: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/accept`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  rejectOrder: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reject`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  /**
   * PATCH /food/delivery/orders/:orderId/reached-pickup
   * Marks "reached pickup" (arrival at restaurant) in backend order deliveryState.
   */
  confirmReachedPickup: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reached-pickup`,
      body ?? {},
      { contextModule: "delivery" },
    ),
  /**
   * Confirm order ID and upload bill image (Picked Up slide).
   * Backend endpoint: PATCH /food/delivery/orders/:id/confirm-pickup
   */
  confirmOrderId: (orderId, confirmedOrderId, location = {}, data = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/confirm-pickup`,
      {
        confirmedOrderId,
        latitude: location.lat,
        longitude: location.lng,
        billImageUrl: data.billImageUrl,
        otp: data.otp,
        customerOtp: data.customerOtp,
        pickupImages: data.pickupImages,
        images: data.pickupImages,
        documentType: data.documentType,
        ...data,
      },
      {
        contextModule: "delivery",
      },
    ),
  confirmReachedDrop: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reached-drop`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  verifyDropOtp: (orderId, otp) =>
    apiClient.post(
      `/food/delivery/orders/${String(orderId)}/verify-drop-otp`,
      { otp: String(otp) },
      {
        contextModule: "delivery",
      },
    ),
  /** POST /food/delivery/orders/:orderId/collect/qr - create Razorpay payment link (COD collection) */
  createCollectQr: (orderId, body = {}) =>
    apiClient.post(
      `/food/delivery/orders/${String(orderId)}/collect/qr`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  /** GET /food/delivery/orders/:orderId/payment-status - check COD/QR payment status */
  getPaymentStatus: (orderId) =>
    apiClient.get(`/food/delivery/orders/${String(orderId)}/payment-status`, {
      contextModule: "delivery",
    }),
  completeDelivery: (orderId, body = {}) => {
    // Backward-compatible: older UI calls completeDelivery(orderId, rating, review)
    // where rating is a number (sent as raw JSON like "3"). Normalize to an object.
    let payload = body ?? {};
    if (
      typeof payload === "number" ||
      typeof payload === "string" ||
      payload == null
    ) {
      payload = { rating: payload == null ? null : Number(payload) };
    }
    return apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/complete`,
      payload,
      {
        contextModule: "delivery",
      },
    );
  },
  updateOrderStatus: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/status`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  /** Registration Re-verification */
  reverify: () =>
    apiClient.post(
      "/food/delivery/reverify",
      {},
      { contextModule: "delivery" },
    ),
  /** GET /food/delivery/wallet - wallet for Pocket/requests page (backend) */
  getWallet: () =>
    apiClient.get("/food/delivery/wallet", { contextModule: "delivery" }),
  getDepositPaymentSettings: () =>
    apiClient.get("/food/delivery/wallet/deposit/settings", { contextModule: "delivery" }),
  /** GET /food/delivery/earnings - earnings summary for Pocket/requests page */
  getEarnings: (params) =>
    apiClient.get("/food/delivery/earnings", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** Earning Addons (Hotspots/Bonus) */
  getActiveEarningAddons: () =>
    apiClient.get("/food/delivery/earning-addons/active", {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/trip-history - completed/cancelled/pending trips for delivery partner */
  getTripHistory: (params) =>
    apiClient.get("/food/delivery/trip-history", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** GET /food/delivery/pocket-details - single-call week details (trips + transactions) */
  getPocketDetails: (params) =>
    apiClient.get("/food/delivery/pocket-details", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** GET /food/delivery/emergency-help - admin-set emergency numbers for delivery partner */
  getEmergencyHelp: () =>
    apiClient.get("/food/delivery/emergency-help", {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/cash-limit - admin-set cash limit for delivery partner */
  getCashLimit: () =>
    apiClient.get("/food/delivery/cash-limit", {
      contextModule: "delivery",
    }),
  createWithdrawalRequest: (body) =>
    apiClient.post("/food/delivery/wallet/withdraw", body ?? {}, {
      contextModule: "delivery"
    }),
  createDepositOrder: (amount) =>
    apiClient.post("/food/delivery/wallet/deposit/order", { amount }, {
      contextModule: "delivery"
    }),
  verifyDepositPayment: (body) =>
    apiClient.post("/food/delivery/wallet/deposit/verify", body ?? {}, {
      contextModule: "delivery"
    }),
  submitManualDeposit: (formData) =>
    apiClient.post("/food/delivery/wallet/deposit/manual", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      contextModule: "delivery"
    }),
  getDepositZones: () =>
    apiClient.get("/food/delivery/wallet/deposit/zones", { contextModule: "delivery" }),
  getDepositZoneHubs: (zoneId) =>
    apiClient.get(`/food/delivery/wallet/deposit/zones/${String(zoneId)}/hubs`, { contextModule: "delivery" }),
  /** Wallet transactions - from wallet response (no separate backend endpoint) */
  getWalletTransactions: (params) =>
    apiClient
      .get("/food/delivery/wallet", {
        params: params ?? {},
        contextModule: "delivery",
      })
      .then((res) => ({
        ...res,
        data: {
          ...res.data,
          data: {
            transactions: res?.data?.data?.wallet?.transactions ?? [],
          },
        },
      })),
  /** Zone discovery */
  getZonesInRadius: (lat, lng, radiusKm = 10) =>
    apiClient.get("/food/zones/nearby", {
      params: { lat, lng, radius: radiusKm },
      contextModule: "delivery",
    }),
  /** DELETE /food/delivery/profile (Bearer DELIVERY_PARTNER) */
  deleteAccount: () =>
    apiClient.delete("/food/delivery/profile", { contextModule: "delivery" }),
};

export const userAPI = {
  /** Get current user profile (Bearer USER). */
  getProfile: () =>
    getUserMeOnce().then((res) => {
      const user =
        res?.data?.data?.user ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data;
      return { ...res, data: { ...res.data, data: { user } } };
    }),
  /** PATCH /food/user/profile (Bearer USER) */
  updateProfile: (body) =>
    apiClient.patch("/food/user/profile", body ?? {}, {
      contextModule: "user",
    }),
  /** Upload and set user profile image (multipart). Field name: file */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/user/profile/profile-image", formData, {
      contextModule: "user",
    });
  },
  /** GET /food/user/wallet (Bearer USER). Deduped + short-cached. */
  getWallet: (() => {
    let inFlight = null;
    let cached = null;
    let cacheTime = 0;
    const CACHE_MS = 3000;
    return () => {
      const now = Date.now();
      if (cached && now - cacheTime < CACHE_MS) return Promise.resolve(cached);
      if (!inFlight) {
        inFlight = apiClient
          .get("/food/user/wallet", { contextModule: "user" })
          .then((res) => {
            cached = res;
            cacheTime = Date.now();
            return res;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    };
  })(),
  /** GET /food/user/referrals/stats (Bearer USER) */
  getReferralStats: () =>
    apiClient.get("/food/user/referrals/stats", { contextModule: "user" }),
  /** GET /food/user/referrals/details (Bearer USER) */
  getReferralDetails: () =>
    apiClient.get("/food/user/referrals/details", { contextModule: "user" }),
  /** POST /food/user/wallet/topup/order (Bearer USER). Body: { amount } */
  createWalletTopupOrder: (amount) =>
    apiClient.post(
      "/food/user/wallet/topup/order",
      { amount: Number(amount) },
      { contextModule: "user" },
    ),
  /** POST /food/user/wallet/topup/verify (Bearer USER) */
  verifyWalletTopupPayment: (body) =>
    apiClient.post("/food/user/wallet/topup/verify", body ?? {}, {
      contextModule: "user",
    }),
  /** GET /food/user/addresses (Bearer USER). Deduped + short-cached. */
  getAddresses: (() => {
    let inFlight = null;
    let cached = null;
    let cacheTime = 0;
    const CACHE_MS = 60 * 1000;
    const fn = () => {
      const now = Date.now();
      if (cached && now - cacheTime < CACHE_MS) return Promise.resolve(cached);
      if (!inFlight) {
        inFlight = apiClient
          .get("/food/user/addresses", { contextModule: "user" })
          .then((res) => {
            cached = res;
            cacheTime = Date.now();
            return res;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    };
    fn.invalidateCache = () => {
      inFlight = null;
      cached = null;
      cacheTime = 0;
    };
    return fn;
  })(),
  /** POST /food/user/addresses (Bearer USER) */
  addAddress: (body) =>
    apiClient.post("/food/user/addresses", body ?? {}, {
      contextModule: "user",
    }).then((res) => {
      userAPI.getAddresses.invalidateCache?.();
      return res;
    }),
  /** PATCH /food/user/addresses/:id (Bearer USER) */
  updateAddress: (id, body) =>
    apiClient.patch(`/food/user/addresses/${String(id)}`, body ?? {}, {
      contextModule: "user",
    }).then((res) => {
      userAPI.getAddresses.invalidateCache?.();
      return res;
    }),
  /** DELETE /food/user/addresses/:id (Bearer USER) */
  deleteAddress: (id) =>
    apiClient.delete(`/food/user/addresses/${String(id)}`, {
      contextModule: "user",
    }).then((res) => {
      userAPI.getAddresses.invalidateCache?.();
      return res;
    }),
  /** PATCH /food/user/addresses/:id/default (Bearer USER) */
  setDefaultAddress: (id) =>
    apiClient.patch(
      `/food/user/addresses/${String(id)}/default`,
      {},
      { contextModule: "user" },
    ).then((res) => {
      userAPI.getAddresses.invalidateCache?.();
      return res;
    }),
  /** POST /food/user/safety-emergency-reports (Bearer USER) */
  createSafetyEmergencyReport: (message) =>
    apiClient.post(
      "/food/user/safety-emergency-reports",
      { message: String(message || "") },
      { contextModule: "user" },
    ),
  /** GET /food/user/safety-emergency-reports (Bearer USER) */
  getMySafetyEmergencyReports: (params) =>
    apiClient.get("/food/user/safety-emergency-reports", {
      params: params ?? {},
      contextModule: "user",
    }),
  /**
   * Resolve the user's default saved address as a location payload.
   * Used by the food user location hook when localStorage is empty.
   */
  getLocation: async () => {
    const res = await userAPI.getAddresses()
    const addresses =
      res?.data?.data?.addresses || res?.data?.addresses || []
    const defaultAddress =
      addresses.find((address) => address?.isDefault === true) || addresses[0]

    if (!defaultAddress) {
      return { data: { success: true, data: { location: null } } }
    }

    const coords = Array.isArray(defaultAddress?.location?.coordinates)
      ? defaultAddress.location.coordinates
      : null
    const latitude = Number(
      coords?.[1] ?? defaultAddress.latitude ?? defaultAddress.lat ?? null,
    )
    const longitude = Number(
      coords?.[0] ?? defaultAddress.longitude ?? defaultAddress.lng ?? null,
    )

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { data: { success: true, data: { location: null } } }
    }

    const formattedAddress =
      defaultAddress.address ||
      defaultAddress.formattedAddress ||
      [
        defaultAddress.street,
        defaultAddress.additionalDetails,
        defaultAddress.city,
        defaultAddress.state,
        defaultAddress.zipCode || defaultAddress.postalCode,
      ]
        .filter(Boolean)
        .join(", ")

    return {
      data: {
        success: true,
        data: {
          location: {
            latitude,
            longitude,
            city: defaultAddress.city || "",
            state: defaultAddress.state || "",
            country: defaultAddress.country || "",
            area:
              defaultAddress.additionalDetails ||
              defaultAddress.area ||
              "",
            address: formattedAddress || "Select location",
            formattedAddress: formattedAddress || "Select location",
            placeId: defaultAddress.placeId || defaultAddress.place_id || "",
          },
        },
      },
    }
  },
  /**
   * Persist live/reverse-geocoded location onto the user's default saved address.
   * Keeps backward compatibility: resolves without throwing when no address exists.
   */
  updateLocation: async (payload = {}) => {
    const latitude = Number(payload?.latitude);
    const longitude = Number(payload?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        data: {
          success: false,
          message: "Invalid coordinates",
          data: null,
          persisted: false,
        },
      };
    }

    const completeAddress = String(
      payload?.formattedAddress || payload?.address || "",
    ).trim();

    if (
      !completeAddress ||
      completeAddress === "Select location" ||
      completeAddress === "Current Location" ||
      /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(completeAddress)
    ) {
      return {
        data: {
          success: true,
          message: "Location skipped (placeholder)",
          data: null,
          persisted: false,
        },
      };
    }

    const res = await userAPI.getAddresses();
    const addresses =
      res?.data?.data?.addresses || res?.data?.addresses || [];
    // Only target the Current Location entry
    const target =
      addresses.find((entry) => entry?.type === "current" || entry?.label === "Current Location");
    const targetId = target?._id || target?.id;

    const resolvedCity = String(payload?.city || target?.city || "").trim();
    const resolvedState =
      String(payload?.state || target?.state || "").trim() || resolvedCity;
    const body = {
      latitude,
      longitude,
      address: completeAddress,
      city: resolvedCity,
      state: resolvedState,
      street:
        String(payload?.street || target?.street || "").trim() ||
        completeAddress.split(",")[0]?.trim() ||
        "Current Location",
      additionalDetails: String(
        payload?.area || payload?.additionalDetails || target?.additionalDetails || "",
      ).trim(),
      zipCode: String(
        payload?.postalCode || payload?.zipCode || target?.zipCode || "",
      ).trim(),
      label: "Current Location",
      type: "current"
    };

    if (!body.city || !body.state) {
      return {
        data: {
          success: true,
          message: "Location skipped (incomplete geocode)",
          data: null,
          persisted: false,
        },
      };
    }

    if (!targetId) {
      // No current location saved yet: create it.
      const created = await userAPI.addAddress(body);
      return {
        ...(created || {}),
        data: {
          ...(created?.data || {}),
          persisted: true,
        },
      };
    }

    const updated = await userAPI.updateAddress(String(targetId), body);
    return {
      ...(updated || {}),
      data: {
        ...(updated?.data || {}),
        persisted: true,
      },
    };
  },
  saveFcmToken: (token, options = {}) => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "user" },
    );
  },
  removeFcmToken: (token, options = {}) => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "user",
      },
    );
  },
  testFcmNotification: (options = {}) => {
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    return apiClient.post("/fcm-tokens/test", { platform }, { contextModule: "user" });
  },
  /** POST /food/user/role-requests (Bearer USER) */
  submitRoleRequest: (role, details) =>
    apiClient.post("/food/user/role-requests", { role, details }, { contextModule: "user" }),
  /** GET /food/user/role-requests (Bearer USER) */
  getMyRoleRequests: () =>
    apiClient.get("/food/user/role-requests", { contextModule: "user" }),
  /** PATCH /food/user/role-requests/:id (Bearer USER) */
  updateRoleRequest: (id, details) =>
    apiClient.patch(`/food/user/role-requests/${id}`, { details }, { contextModule: "user" }),
  /** DELETE /food/user/role-requests/:id (Bearer USER) */
  deleteRoleRequest: (id) =>
    apiClient.delete(`/food/user/role-requests/${id}`, { contextModule: "user" }),
  /** DELETE /food/user/profile (Bearer USER) */
  deleteAccount: () =>
    apiClient.delete("/food/user/profile", { contextModule: "user" }),
};
export const locationAPI = createStubAPI();
export const zoneAPI = {
  /** Public: detect active service zone for a lat/lng point. */
  detectZone: (lat, lng) =>
    apiClient.get("/food/zones/detect", {
      params: { lat, lng },
    }),
  /** Public: list active zones (for onboarding dropdowns). */
  getPublicZones: (params = {}, config = {}) =>
    apiClient.get("/food/zones/public", { params: params ?? {}, ...config }),
};
export const uploadAPI = {
  /**
   * Upload a single image file to the backend (Cloudinary-backed).
   * @param {File|Blob} file
   * @param {{ folder?: string }} options
   */
  uploadMedia: (file, options = {}) => {
    if (!file) {
      return Promise.reject(new Error("File is required for upload"));
    }

    const formData = new FormData();
    formData.append("file", file);
    if (options.folder) {
      formData.append("folder", options.folder);
    }

    return apiClient.post("/uploads/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
/** Order API (user app – Bearer USER token). Minimal calls: single create/verify, list/details cached by caller. */
export const orderAPI = {
  calculateOrder: (payload, config = {}) =>
    apiClient.post("/food/orders/calculate", payload ?? {}, {
      contextModule: "user",
      ...config,
    }),
  createOrder: (payload) =>
    apiClient.post("/food/orders", payload ?? {}, { contextModule: "user" }),
  verifyPayment: (body) =>
    apiClient.post("/food/orders/verify-payment", body ?? {}, {
      contextModule: "user",
    }),
  /** User order list — single-flight + short TTL per query key (Home card / StrictMode). */
  getOrders: (() => {
    let inFlight = null;
    let inFlightKey = "";
    let cache = null;
    let cacheKey = "";
    let cacheAt = 0;
    const CACHE_MS = 2500;
    const DEFAULTS = { limit: 20, page: 1 };

    const buildKey = (p = {}) => JSON.stringify({ ...DEFAULTS, ...p });

    const getOrders = (params = {}) => {
      const key = buildKey(params);
      const now = Date.now();

      if (cache && cacheKey === key && now - cacheAt < CACHE_MS) {
        return Promise.resolve(cache);
      }
      if (inFlight && inFlightKey === key) return inFlight;

      inFlightKey = key;
      inFlight = apiClient
        .get("/food/orders", {
          params: { ...DEFAULTS, ...params },
          contextModule: "user",
        })
        .then((res) => {
          const payload = res?.data?.data;

          // Normalize backend paginated shape:
          // { data: { data: [...], meta: { total, page, limit, totalPages } } }
          // into UI-friendly:
          // { data: { orders: [...], pagination: { total, page, limit, pages } } }
          let normalized = res;
          if (
            payload &&
            typeof payload === "object" &&
            Array.isArray(payload.data) &&
            payload.meta &&
            typeof payload.meta === "object"
          ) {
            const meta = payload.meta;
            normalized = {
              ...res,
              data: {
                ...res.data,
                data: {
                  ...payload,
                  orders: payload.data,
                  pagination: {
                    total: Number(meta.total || 0),
                    page: Number(meta.page || 1),
                    limit: Number(meta.limit || params.limit || DEFAULTS.limit),
                    pages: Number(meta.totalPages || 1),
                  },
                },
              },
            };
          }

          cache = normalized;
          cacheKey = key;
          cacheAt = Date.now();
          return normalized;
        })
        .finally(() => {
          inFlight = null;
          inFlightKey = "";
        });

      return inFlight;
    };

    getOrders.invalidate = () => {
      cache = null;
      cacheKey = "";
      cacheAt = 0;
    };

    return getOrders;
  })(),
  getOrderDetails: (() => {
    const inFlight = new Map();
    const cache = new Map();
    /** Dedupes overlapping calls (StrictMode, poll + socket) without hiding fresh data for long. */
    const CACHE_MS = 800;

    return (orderId, options = {}) => {
      const key = String(orderId ?? "").trim();
      if (!key) {
        return Promise.reject(new Error("orderId required"));
      }

      const force = options.force === true;
      const now = Date.now();
      if (!force) {
        const hit = cache.get(key);
        if (hit && now - hit.at < CACHE_MS) {
          return Promise.resolve(hit.res);
        }
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      const p = apiClient
        .get(`/food/orders/${key}`, {
          contextModule: "user",
          ...(force
            ? { params: { _t: Date.now() }, headers: { "Cache-Control": "no-cache" } }
            : {}),
        })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  cancelOrder: (orderId, body = {}) =>
    apiClient.patch(`/food/orders/${String(orderId)}/cancel`, body ?? {}, {
      contextModule: "user",
    }),
  updateOrderInstructions: (orderId, instructions) =>
    apiClient.patch(`/food/orders/${String(orderId)}/instructions`, { instructions }, {
      contextModule: "user",
    }),
  submitOrderRatings: (orderId, body = {}) =>
    apiClient.patch(`/food/orders/${String(orderId)}/ratings`, body ?? {}, { contextModule: "user" }),
  /** Submit a complaint for an order (user). */
  submitComplaint: (payload) =>
    apiClient.post(
      "/food/user/support/ticket",
      {
        type: "order",
        orderId: payload.orderId,
        issueType: payload.complaintType,
        description: `${payload.subject}: ${payload.description}`,
      },
      { contextModule: "user" }
    ),
};

export const mediaAPI = {
  getSharedMedia: (params = {}) =>
    apiClient.get("/media/shared", { params, contextModule: "restaurant" }),
};
export const heroBannerAPI = createStubAPI();
export const publicAPI = createStubAPI();

export const onboardingFeeAPI = {
  getPublicFees: () => getWithDedupe("/common/onboarding-fees/public"),
  createOrder: (body) => apiClient.post("/common/onboarding-fees/public/create-order", body ?? {}),
  getConfig: () => apiClient.get("/common/onboarding-fees/config", { contextModule: "admin" }),
  updateConfig: (role, body) => apiClient.put(`/common/onboarding-fees/config/${role}`, body ?? {}, { contextModule: "admin" }),
  getPayments: (params = {}) => apiClient.get("/common/onboarding-fees/payments", { params, contextModule: "admin" })
};

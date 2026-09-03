import axiosInstance from "@core/api/axios";
import api from "@core/api/index";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";
import { getQuickSessionId } from "./quickApi";

const withQuickSession = (config = {}) => ({
  ...config,
  params: {
    ...(config.params || {}),
    sessionId: getQuickSessionId(),
  },
  headers: {
    ...(config.headers || {}),
    "x-quick-session": getQuickSessionId(),
  },
});

const quickGetWithDedupe = (url, params = {}, options = {}) =>
  getWithDedupe(url, params, withQuickSession(options));

export const customerApi = {
  verifyOtp: async (data) => {
    const res = await api.auth.verifyUserOtp(data.phone, data.otp);
    const resultData = res?.data?.data || res?.data?.result || res?.data || {};
    const user = resultData.user || resultData.customer || resultData;
    const token = resultData.accessToken || resultData.token || res?.data?.token;
    return {
      ...res,
      data: {
        ...res?.data,
        result: {
          token,
          customer: user,
          user,
          ...resultData,
        },
        data: resultData,
      },
    };
  },
  requestAccountRecovery: (data) => api.auth.requestAccountRecovery(data.phone, data.otp),
  getProfile: () =>
    getWithDedupe("/auth/me", {}, { ttl: 5000, ...withQuickSession() }).then((res) => {
      const user =
        res?.data?.data?.user ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data;
      return {
        ...res,
        data: {
          ...res.data,
          result: user,
          data: user,
        },
      };
    }),

  getCart: () => quickGetWithDedupe("/quick-commerce/cart", {}, { ttl: 5000 }),
  addToCart: (data) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.post("/quick-commerce/cart/add", data, withQuickSession());
  },
  updateCartQuantity: (data) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.put("/quick-commerce/cart/update", data, withQuickSession());
  },
  removeFromCart: (productId) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.delete(`/quick-commerce/cart/remove/${productId}`, withQuickSession());
  },
  clearCart: () => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.delete("/quick-commerce/cart/clear", withQuickSession());
  },

  placeOrder: (data) => axiosInstance.post("/quick-commerce/orders", data, withQuickSession()),
  getOrders: (params) => quickGetWithDedupe("/quick-commerce/orders", params),
  getMyOrders: (params) => quickGetWithDedupe("/quick-commerce/orders", params),
  createOrder: (data) => axiosInstance.post("/quick-commerce/orders", data, withQuickSession()),
  verifyPayment: (data) => axiosInstance.post("/quick-commerce/orders/verify-payment", data, withQuickSession()),
  getOrderDetails: (orderId, options = {}) =>
    quickGetWithDedupe(`/quick-commerce/orders/${orderId}`, {}, {
      ...options,
      forceRefresh: options.forceRefresh ?? options.force ?? false,
    }),
  cancelOrder: (orderId) => axiosInstance.post(`/quick-commerce/orders/${orderId}/cancel`, {}, withQuickSession()),
  createSupportTicket: (data) => axiosInstance.post("/quick-commerce/support/ticket", data, withQuickSession()),
  getSupportTickets: (params = {}) => quickGetWithDedupe("/quick-commerce/support/my-tickets", params),

  getProducts: (params, options = {}) => quickGetWithDedupe("/quick-commerce/products", params, options),
  searchProducts: (params, options = {}) => quickGetWithDedupe("/quick-commerce/products", params, options),
  getCategories: (params = {}) => quickGetWithDedupe("/quick-commerce/categories", params),
  getCategoryDetails: (categoryId, options = {}) =>
    quickGetWithDedupe(`/quick-commerce/categories/${categoryId}`, {}, options),
  getCategoryProducts: (categoryId, params, options = {}) =>
    quickGetWithDedupe("/quick-commerce/products", { categoryId, ...params }, options),
  getProductDetails: (productId) => quickGetWithDedupe(`/quick-commerce/products/${productId}`, {}),

  getAddresses: () => axiosInstance.get("/quick-commerce/addresses", withQuickSession()),
  addAddress: (data) => axiosInstance.post("/quick-commerce/addresses", data, withQuickSession()),
  updateAddress: (id, data) => axiosInstance.put(`/quick-commerce/addresses/${id}`, data, withQuickSession()),
  deleteAddress: (id) => axiosInstance.delete(`/quick-commerce/addresses/${id}`, withQuickSession()),

  reverseGeocode: (lat, lng, options = {}) =>
    quickGetWithDedupe("/quick-commerce/location/reverse-geocode", { lat, lng }, options),
  geocode: (address, options = {}) =>
    quickGetWithDedupe("/quick-commerce/location/geocode", { address }, options),

  getStores: (params) => quickGetWithDedupe("/quick-commerce/stores", params),
  getStoreDetails: (storeId) => quickGetWithDedupe(`/quick-commerce/stores/${storeId}`, {}),
  getShops: (params) => quickGetWithDedupe("/quick-commerce/shops", params),
  getShopById: (shopId) => quickGetWithDedupe(`/quick-commerce/shops/${shopId}`, {}),

  getProductReviews: async (productId) => {
    try {
      return await quickGetWithDedupe(`/quick-commerce/products/${productId}/reviews`, {});
    } catch (error) {
      if (error?.response?.status === 404) {
        return { data: { success: true, results: [] } };
      }
      throw error;
    }
  },
  submitReview: (data) => axiosInstance.post("/quick-commerce/products/reviews", data, withQuickSession()),

  getHomeData: (params = {}) => quickGetWithDedupe("/quick-commerce/home", params),
  getBanners: (params = {}) => quickGetWithDedupe("/quick-commerce/banners/public", params),

  getCoupons: () => quickGetWithDedupe("/quick-commerce/coupons", {}),
  getActiveCoupons: () => quickGetWithDedupe("/quick-commerce/coupons", {}),
  applyCoupon: (data) => axiosInstance.post("/quick-commerce/coupons/apply", data, withQuickSession()),
  validateCoupon: (data) => axiosInstance.post("/quick-commerce/coupons/apply", data, withQuickSession()),
  getOffers: () => quickGetWithDedupe("/quick-commerce/offers", {}),
  getBillingSettings: () => quickGetWithDedupe("/quick-commerce/billing/settings", {}),

  getWalletBalance: () => axiosInstance.get("/quick-commerce/wallet/balance", withQuickSession()),
  getWalletTransactions: (params) => quickGetWithDedupe("/quick-commerce/wallet/transactions", params),
  geocodeAddress: (address) =>
    axiosInstance.get(
      `/quick-commerce/location/geocode?address=${encodeURIComponent(address)}`,
      withQuickSession()
    ),

  getWishlist: (params) => quickGetWithDedupe("/quick-commerce/wishlist", params),
  addToWishlist: (data) => {
    invalidateCache("/quick-commerce/wishlist");
    return axiosInstance.post("/quick-commerce/wishlist/add", data, withQuickSession());
  },
  removeFromWishlist: (productId) => {
    invalidateCache("/quick-commerce/wishlist");
    return axiosInstance.delete(`/quick-commerce/wishlist/remove/${productId}`, withQuickSession());
  },
  toggleWishlist: (data) => {
    invalidateCache("/quick-commerce/wishlist");
    return axiosInstance.post("/quick-commerce/wishlist/toggle", data, withQuickSession());
  },
};

export const prefetchQuickHomeBootstrap = async (location = null) => {
  const hasValidLocation =
    Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  const productParams = { limit: 20 };

  if (hasValidLocation) {
    productParams.lat = location.latitude;
    productParams.lng = location.longitude;
  }

  return Promise.allSettled([
    customerApi.getCategories(),
    hasValidLocation
      ? customerApi.getProducts(productParams)
      : Promise.resolve(null),
    customerApi.getHomeData(),
  ]);
};

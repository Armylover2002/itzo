import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache } from "@core/api/dedupe";
import { getQuickSessionId } from "./quickApi";

const toCoord = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Fallback coords from Food/QC localStorage when caller omitted lat/lng. */
const readStoredDeliveryCoords = () => {
  if (typeof window === "undefined") return null;
  const keys = ["location_v2", "userLocation"];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const lat = toCoord(parsed?.latitude ?? parsed?.lat);
      const lng = toCoord(parsed?.longitude ?? parsed?.lng);
      if (lat !== null && lng !== null) return { lat, lng };
    } catch {
      // ignore
    }
  }
  return null;
};

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

const quickGetWithDedupe = (url, params = {}, options = {}) => {
  const sessionConfig = withQuickSession(options);
  const mergedParams = {
    ...(sessionConfig.params || {}),
    ...(params || {}),
  };
  const { params: _ignored, ...restSessionConfig } = sessionConfig;
  return getWithDedupe(url, mergedParams, restSessionConfig);
};

const mapGeocodeResponse = (res, fallbackPlaceId = "") => {
  const data = res?.data?.data ?? {};
  const lat = Number(data.latitude ?? data.lat);
  const lng = Number(data.longitude ?? data.lng);
  return {
    ...res,
    data: {
      ...res.data,
      result: {
        ...data,
        location:
          Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
        formattedAddress: data.formattedAddress || "",
        placeId: data.placeId || fallbackPlaceId || "",
      },
    },
  };
};

export const customerApi = {
  getProfile: (options = {}) =>
    quickGetWithDedupe("/auth/me", {}, { ttl: 30 * 1000, ...options }).then((res) => {
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

  updateProfile: (body) =>
    axiosInstance.patch("/food/user/profile", body, withQuickSession()),


  getCart: (options = {}) =>
    quickGetWithDedupe("/quick-commerce/cart", {}, { ttl: 5 * 1000, ...options }),
  previewCheckout: (data = {}) =>
    axiosInstance.post("/quick-commerce/checkout/preview", data, withQuickSession()),
  addToCart: (data) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.post("/quick-commerce/cart/add", data, withQuickSession());
  },
  updateCartQuantity: (data) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.put("/quick-commerce/cart/update", data, withQuickSession());
  },
  removeFromCart: (productId, params = {}) => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.delete(`/quick-commerce/cart/remove/${productId}`, withQuickSession({ params }));
  },
  clearCart: () => {
    invalidateCache("/quick-commerce/cart");
    return axiosInstance.delete("/quick-commerce/cart/clear", withQuickSession());
  },

  placeOrder: (data) => axiosInstance.post("/quick-commerce/orders", data, withQuickSession()),
  getOrders: (params) => quickGetWithDedupe("/quick-commerce/orders", params),
  getMyOrders: (params) => quickGetWithDedupe("/quick-commerce/orders", params),
  createOrder: (data) => axiosInstance.post("/quick-commerce/orders", data, withQuickSession()),
  verifyPayment: (orderId, data) => axiosInstance.post(`/quick-commerce/orders/${orderId}/verify-payment`, data, withQuickSession()),
  getOrderDetails: (orderId, options = {}) =>
    quickGetWithDedupe(`/quick-commerce/orders/${orderId}`, {}, {
      ...options,
      forceRefresh: options.forceRefresh ?? options.force ?? false,
    }),
  cancelOrder: (orderId, data = {}) =>
    axiosInstance.post(`/quick-commerce/orders/${orderId}/cancel`, data, withQuickSession()),
  createSupportTicket: (data) => axiosInstance.post("/quick-commerce/support/ticket", data, withQuickSession()),
  getSupportTickets: (params = {}) => quickGetWithDedupe("/quick-commerce/support/my-tickets", params),

  getProducts: (params) => quickGetWithDedupe("/quick-commerce/products", params, { ttl: 2 * 60 * 1000 }),
  searchProducts: (params) => quickGetWithDedupe("/quick-commerce/products", params),
  getCategories: (params = {}) => quickGetWithDedupe("/quick-commerce/categories", params, { ttl: 5 * 60 * 1000 }),
  getCategoryProducts: (categoryId, params) =>
    quickGetWithDedupe("/quick-commerce/products", { categoryId, ...params }),
  getProductDetails: (productId, params = {}) =>
    quickGetWithDedupe(`/quick-commerce/products/${productId}`, params),

  getAddresses: () => axiosInstance.get("/quick-commerce/addresses", withQuickSession()),
  addAddress: (data) => axiosInstance.post("/quick-commerce/addresses", data, withQuickSession()),
  updateAddress: (id, data) => axiosInstance.put(`/quick-commerce/addresses/${id}`, data, withQuickSession()),
  deleteAddress: (id) => axiosInstance.delete(`/quick-commerce/addresses/${id}`, withQuickSession()),

  getStores: (params) => quickGetWithDedupe("/quick-commerce/stores", params, { ttl: 5 * 60 * 1000 }),
  getStoreDetails: (storeId) => quickGetWithDedupe(`/quick-commerce/stores/${storeId}`, {}),

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

  getExperienceSections: (params) => quickGetWithDedupe("/quick-commerce/experience", params),
  getHeroConfig: (params) => quickGetWithDedupe("/quick-commerce/experience/hero", params),
  getOfferSections: (params) => quickGetWithDedupe("/quick-commerce/offer-sections", params),
  getHomeTiles: (params) => quickGetWithDedupe("/quick-commerce/home-tiles", params),
  getHomeData: () => quickGetWithDedupe("/quick-commerce/home", {}),
  // Performance: Single call jo 5 alag calls replace karta hai
  getBootstrap: (params = {}) => {
    const next = { ...(params || {}) };
    const hasLat = Number.isFinite(Number(next.lat));
    const hasLng = Number.isFinite(Number(next.lng));
    if (!hasLat || !hasLng) {
      const stored = readStoredDeliveryCoords();
      if (stored) {
        next.lat = stored.lat;
        next.lng = stored.lng;
      }
    }
    return quickGetWithDedupe("/quick-commerce/bootstrap", next);
  },

  getCoupons: (params = {}, options = {}) =>
    quickGetWithDedupe("/quick-commerce/coupons", params, options),
  getActiveCoupons: (params = {}, options = {}) =>
    quickGetWithDedupe("/quick-commerce/coupons", params, options),
  applyCoupon: (data) => axiosInstance.post("/quick-commerce/coupons/apply", data, withQuickSession()),
  validateCoupon: (data) => axiosInstance.post("/quick-commerce/coupons/apply", data, withQuickSession()),
  getOffers: () => quickGetWithDedupe("/quick-commerce/offers", {}),
  getBillingSettings: () => quickGetWithDedupe("/quick-commerce/billing/settings", {}),

  getWalletBalance: (options = {}) =>
    quickGetWithDedupe("/quick-commerce/wallet/balance", {}, { ttl: 15 * 1000, ...options }),
  getWalletTransactions: (params) => quickGetWithDedupe("/quick-commerce/wallet/transactions", params),
  geocodeAddress: (address) =>
    axiosInstance
      .get(
        `/quick-commerce/location/geocode?address=${encodeURIComponent(address)}`,
        withQuickSession(),
      )
      .then((res) => mapGeocodeResponse(res)),
  reverseGeocode: (lat, lng) =>
    axiosInstance.get(
      `/quick-commerce/location/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      withQuickSession()
    ),
  geocodePlaceId: (placeId) =>
    axiosInstance
      .get(
        `/quick-commerce/location/geocode-place?placeId=${encodeURIComponent(placeId)}`,
        withQuickSession(),
      )
      .then((res) => mapGeocodeResponse(res, placeId)),

  getWishlist: (params) => quickGetWithDedupe("/quick-commerce/wishlist", params),
  addToWishlist: (data) => {
    invalidateCache("/quick-commerce/wishlist");
    return axiosInstance.post("/quick-commerce/wishlist/add", data, withQuickSession());
  },
  removeFromWishlist: (productId, variantMeta = null) => {
    invalidateCache("/quick-commerce/wishlist");
    const params = {};
    if (variantMeta?.variantKey) params.variantKey = variantMeta.variantKey;
    if (variantMeta?.variantName) params.variantName = variantMeta.variantName;
    if (variantMeta?.variantSku) params.variantSku = variantMeta.variantSku;
    return axiosInstance.delete(`/quick-commerce/wishlist/remove/${productId}`, {
      ...withQuickSession(),
      params,
    });
  },
  toggleWishlist: (data) => {
    invalidateCache("/quick-commerce/wishlist");
    return axiosInstance.post("/quick-commerce/wishlist/toggle", data, withQuickSession());
  },
  
  submitOrderRatings: (orderId, data) => 
    axiosInstance.patch(`/quick-commerce/orders/${orderId}/ratings`, data, withQuickSession()),

  createReturnRequest: (orderId, data) => {
    invalidateCache(`/quick-commerce/orders/${orderId}/returns`);
    return axiosInstance.post(`/quick-commerce/orders/${orderId}/returns`, data, withQuickSession());
  },
  getReturnStatus: (orderId, options = {}) =>
    quickGetWithDedupe(`/quick-commerce/orders/${orderId}/returns`, {}, {
      ...options,
      forceRefresh: options.forceRefresh ?? options.force ?? false,
    }),
  getReturnPickupOtp: (orderId, params = {}) =>
    axiosInstance.get(`/quick-commerce/orders/${orderId}/returns/pickup-otp`, withQuickSession({ params })),
  cancelReturnRequest: (orderId, data = {}) => {
    invalidateCache(`/quick-commerce/orders/${orderId}/returns`);
    return axiosInstance.post(`/quick-commerce/orders/${orderId}/returns/cancel`, data, withQuickSession());
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
    customerApi.getExperienceSections({ pageType: "home" }),
    customerApi.getHeroConfig({ pageType: "home" }),
    hasValidLocation
      ? customerApi.getOfferSections({
          lat: location.latitude,
          lng: location.longitude,
        })
      : Promise.resolve(null),
  ]);
};

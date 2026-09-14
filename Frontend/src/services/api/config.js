/**
 * API config.
 * - `axios.js` uses `VITE_API_BASE_URL` for real requests.
 * - `API_BASE_URL` is used by UI (e.g. banners/debug) and should reflect the same value.
 */

export const API_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
    : "";

// Minimal shape so existing API_ENDPOINTS.* references do not break
export const API_ENDPOINTS = {
  AUTH: { SEND_OTP: "", VERIFY_OTP: "", REGISTER: "", LOGIN: "", ME: "", LOGOUT: "", REFRESH_TOKEN: "" },
  USER: { PROFILE: "", ADDRESSES: "", COMPLAINTS: "", COMPLAINT_BY_ID: "" },
  LOCATION: { REVERSE_GEOCODE: "", NEARBY: "" },
  ZONE: { DETECT: "" },
  RESTAURANT: {
    AUTH: { SEND_OTP: "", VERIFY_OTP: "", LOGIN: "", ME: "", LOGOUT: "" },
    PROFILE: "", MENU: "", MENU_BY_RESTAURANT_ID: "", LIST: "", BY_ID: "", ORDERS: "", ORDER_BY_ID: "",
    ADDONS: "", ADDON: "", ADDON_BY_ID: "", ADDONS_BY_RESTAURANT_ID: "", CATEGORIES: "", CATEGORIES_ALL: "",
    CATEGORY_BY_ID: "", OFFERS: "", OFFER_BY_ID: "", COUPONS_BY_ITEM_ID: "", COUPONS_BY_ITEM_ID_PUBLIC: "",
    UNDER_250: "", DISHES_PUBLIC: "", OFFERS_PUBLIC: "", BY_OWNER: "",
  },
  DELIVERY: {
    AUTH: { SEND_OTP: "", VERIFY_OTP: "", ME: "", LOGOUT: "", FCM_TOKEN: "" },
    SIGNUP: { DETAILS: "", DOCUMENTS: "" },
    PROFILE: "", ORDERS: "", ORDER_BY_ID: "", WALLET: "", SUPPORT_TICKETS: "", SUPPORT_TICKET_BY_ID: "",
  },
  ADMIN: {
    AUTH: { LOGIN: "", LOGOUT: "", ME: "", SIGNUP: "", SIGNUP_OTP: "" },
    PROFILE: "", USERS: "", USER_BY_ID: "", USER_STATUS: "",
    RESTAURANTS: "", RESTAURANT_BY_ID: "", RESTAURANT_MENU_BY_ID: "", RESTAURANT_REQUESTS: "",
    RESTAURANT_APPROVE: "", RESTAURANT_REJECT: "", RESTAURANT_DELETE: "", RESTAURANT_STATUS: "",
    DELIVERY: "", DELIVERY_PARTNERS: "", DELIVERY_PARTNERS_REQUESTS: "", DELIVERY_PARTNER_BY_ID: "",
    DELIVERY_PARTNER_APPROVE: "", DELIVERY_PARTNER_REJECT: "", DELIVERY_PARTNER_STATUS: "", DELIVERY_PARTNER_DELETE: "",
    ORDERS: "", ORDERS_SEARCHING_DELIVERYMAN: "", ORDERS_ONGOING: "",
    // CMS pages (admin auth + public)
    TERMS: "/food/admin/pages-social-media/terms",
    TERMS_PUBLIC: "/food/pages/terms",
    PRIVACY: "/food/admin/pages-social-media/privacy",
    PRIVACY_PUBLIC: "/food/pages/privacy",
    SUPPORT: "/food/admin/pages-social-media/support",
    SUPPORT_PUBLIC: "/food/pages/support",
    ABOUT: "/food/admin/pages-social-media/about",
    ABOUT_PUBLIC: "/food/pages/about",
    REFUND: "/food/admin/pages-social-media/refund",
    REFUND_PUBLIC: "/food/pages/refund",
    SHIPPING: "/food/admin/pages-social-media/shipping",
    SHIPPING_PUBLIC: "/food/pages/shipping",
    CANCELLATION: "/food/admin/pages-social-media/cancellation",
    CANCELLATION_PUBLIC: "/food/pages/cancellation",
    FEEDBACK_CREATE: "", FEEDBACK_EXPERIENCE: "/food/admin/feedback-experiences", FEEDBACK_EXPERIENCE_CREATE: "/food/restaurant/feedback-experience", FEEDBACK_EXPERIENCE_BY_ID: "",
    SAFETY_EMERGENCY: "/food/admin/safety-emergency-reports",
    // User creates reports via USER context; kept for legacy imports.
    SAFETY_EMERGENCY_CREATE: "/food/user/safety-emergency-reports",
    REVIEWS: "",
    CATEGORIES: "", CATEGORIES_PUBLIC: "", CATEGORY_BY_ID: "", FEE_SETTINGS: "", FEE_SETTINGS_PUBLIC: "",
    ZONES: "", ZONE_BY_ID: "", RESTAURANT_COMMISSION: "", RESTAURANT_COMMISSION_BY_ID: "",
    FOOD_APPROVALS: "", FOOD_APPROVAL_APPROVE: "", FOOD_APPROVAL_REJECT: "",
    DELIVERY_PARTNER_REVIEWS: "", DELIVERY_EMERGENCY_HELP: "", DELIVERY_SUPPORT_TICKETS: "", DELIVERY_SUPPORT_TICKET_BY_ID: "",
    EARNING_ADDON: "", EARNING_ADDON_BY_ID: "", EARNING_ADDON_HISTORY: "", EARNING_ADDON_HISTORY_BY_ID: "",
    WITHDRAWAL_REQUESTS: "", WITHDRAWAL_APPROVE: "", WITHDRAWAL_REJECT: "", 
    BUSINESS_SETTINGS: "/common/settings", 
    BUSINESS_SETTINGS_PUBLIC: "/common/settings/public",
  },
  ORDER: { CREATE: "", LIST: "", DETAILS: "", CANCEL: "", VERIFY_PAYMENT: "", CALCULATE: "" },
  UPLOAD: { MEDIA: "" },
  HERO_BANNER: { TOP_10_PUBLIC: "", GOURMET_PUBLIC: "" },
};

export default { API_BASE_URL, API_ENDPOINTS };

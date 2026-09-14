import axiosInstance from '@core/api/axios';

const emptyResponse = (result = {}) =>
  Promise.resolve({
    data: {
      success: true,
      result,
      results: Array.isArray(result) ? result : [],
    },
  });

const mapBusinessSettings = (raw = {}) => ({
  appName: raw.companyName || 'Appzeto',
  supportEmail: raw.email || '',
  supportPhone: raw.phone?.number || '',
  currencySymbol: 'Rs',
  currencyCode: 'INR',
  timezone: 'Asia/Kolkata',
  logoUrl: raw.logo?.url || '',
  faviconUrl: raw.favicon?.url || '',
  primaryColor: '#0c831f',
  secondaryColor: '#64748b',
  companyName: raw.companyName || '',
  taxId: '',
  address: raw.address || '',
  facebook: '',
  twitter: '',
  instagram: '',
  linkedin: '',
  youtube: '',
  playStoreLink: '',
  appStoreLink: '',
  metaTitle: raw.companyName || 'Appzeto',
  metaDescription: '',
  metaKeywords: '',
  keywords: [],
});

const buildSettingsPayload = (data = {}) => ({
  companyName: data.companyName || data.appName || 'Appzeto',
  email: data.supportEmail || 'admin@appzeto.com',
  phoneCountryCode: '+91',
  phoneNumber: String(data.supportPhone || '').replace(/\D/g, '') || '9999999999',
  address: data.address || '',
  state: '',
  pincode: '',
  region: 'India',
  logoUrl: data.logoUrl || '',
  faviconUrl: data.faviconUrl || '',
});

const normalizeCategory = (item = {}) => ({
  ...item,
  _id: item._id || item.id,
  id: item.id || item._id,
  image: item.image?.url || item.image || '',
  status: item.status || (item.isActive ? 'active' : 'inactive'),
  type: item.type || 'header',
  children: Array.isArray(item.children)
    ? item.children.map(normalizeCategory)
    : [],
});

const normalizeProduct = (item = {}) => ({
  ...item,
  mainImage: item.mainImage || item.image || '',
  image: item.image || item.mainImage || '',
  status: item.status || (item.isActive ? 'active' : 'inactive'),
  stock: Number(item.stock || 0),
  categoryId: item.categoryId || null,
  subcategoryId: item.subcategoryId || null,
  headerId: item.headerId || null,
  sellerId: item.sellerId || item.seller?._id || null,
  seller: item.seller || null,
  storeName: item.storeName || item.seller?.shopName || item.seller?.name || '',
  restaurantName: item.restaurantName || item.seller?.shopName || item.seller?.name || '',
  pharmacyDetails:
    item.pharmacyDetails && typeof item.pharmacyDetails === 'object'
      ? item.pharmacyDetails
      : {},
  headerBusinessType: item.headerBusinessType || item.headerId?.businessType || '',
  sellerBusinessType:
    item.sellerBusinessType || item.seller?.shopInfo?.businessType || '',
});

export const adminApi = {
  login: async (data) => {
    const response = await axiosInstance.post('/auth/admin/login', data);
    const payload = response.data?.data || {};
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: {
          token: payload.accessToken,
          refreshToken: payload.refreshToken,
          admin: payload.user || {},
        },
      },
    };
  },
  signup: () => Promise.reject(new Error('Admin signup is not available in this project')),

  getStats: (params = {}) => axiosInstance.get('/quick-commerce/admin/stats', { params }),
  getDashboard: (params = {}) => axiosInstance.get('/quick-commerce/admin/stats', { params }),

  getProfile: async () => {
    const response = await axiosInstance.get('/auth/me', { contextModule: 'admin' });
    const user = response.data?.data?.user || response.data?.result || response.data?.data || {};
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: user,
      },
    };
  },

  updateProfile: async (data) => {
    const response = await axiosInstance.patch('/auth/admin/profile', data);
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: response.data?.data?.user || response.data?.result || {},
      },
    };
  },

  updatePassword: (data) => axiosInstance.post('/auth/admin/change-password', data),

  getSettings: async () => {
    const response = await axiosInstance.get('/food/admin/business-settings');
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: mapBusinessSettings(response.data?.data || {}),
      },
    };
  },

  updateSettings: async (data) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(buildSettingsPayload(data)));
    const response = await axiosInstance.patch('/food/admin/business-settings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: mapBusinessSettings(response.data?.data || {}),
      },
    };
  },

  uploadSettingsImage: async (formData, type = 'logo') => {
    const file = formData.get('image') || formData.get('file');
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('folder', `quick-commerce/settings/${type}`);
    const response = await axiosInstance.post('/uploads/image', uploadData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: response.data?.data || {},
      },
    };
  },

  getCategories: async (params) => {
    const response = await axiosInstance.get('/quick-commerce/admin/categories', { params });
    const items = response.data?.result?.items || response.data?.results || [];
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: response.data?.result?.items
          ? {
              ...response.data.result,
              items: items.map(normalizeCategory),
            }
          : response.data?.result,
        results: items.map(normalizeCategory),
      },
    };
  },

  getCategoryTree: async (params = {}) => {
    const response = await axiosInstance.get('/quick-commerce/admin/categories', {
      params: { tree: true, limit: 5000, ...params },
    });
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        results: (response.data?.results || []).map(normalizeCategory),
      },
    };
  },

  getParentUnits: async () => {
    const response = await axiosInstance.get('/quick-commerce/admin/categories', { params: { flat: true, limit: 1000 } });
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        results: (response.data?.results || []).map(normalizeCategory),
      },
    };
  },

  createCategory: (formData) => axiosInstance.post('/quick-commerce/admin/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  updateCategory: (id, formData) => axiosInstance.put(`/quick-commerce/admin/categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  deleteCategory: (id) => axiosInstance.delete(`/quick-commerce/admin/categories/${id}`),

  getProducts: async (params) => {
    const response = await axiosInstance.get('/quick-commerce/admin/products', { params });
    const items = response.data?.result?.items || [];
    return {
      ...response,
      data: {
        ...response.data,
        success: true,
        result: {
          ...(response.data?.result || {}),
          items: items.map(normalizeProduct),
        },
      },
    };
  },

  getProductById: async (id) => {
    const response = await axiosInstance.get(`/quick-commerce/admin/products/${id}`);
    const result = response.data?.result;
    return {
      ...response,
      data: {
        ...response.data,
        success: Boolean(response.data?.success),
        result: result ? normalizeProduct(result) : null,
      },
    };
  },

  createProduct: (formData) => axiosInstance.post('/quick-commerce/admin/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  updateProduct: (id, formData) => axiosInstance.put(`/quick-commerce/admin/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  deleteProduct: (id) => axiosInstance.delete(`/quick-commerce/admin/products/${id}`),

  getOrders: (params) => axiosInstance.get('/quick-commerce/admin/orders', { params }),
  deleteOrder: (orderId) => axiosInstance.delete(`/quick-commerce/admin/orders/${orderId}`),
  getZones: (params) => axiosInstance.get('/quick-commerce/admin/zones', { params }),
  getZoneById: (id) => axiosInstance.get(`/quick-commerce/admin/zones/${id}`),
  createZone: (body) => axiosInstance.post('/quick-commerce/admin/zones', body ?? {}),
  updateZone: (id, body) => axiosInstance.patch(`/quick-commerce/admin/zones/${id}`, body ?? {}),
  deleteZone: (id) => axiosInstance.delete(`/quick-commerce/admin/zones/${id}`),

  getOrderDetails: (orderId) => axiosInstance.get(`/quick-commerce/admin/orders/${orderId}`),
  updateOrderStatus: () => emptyResponse({ updated: false, unsupported: true }),

  getUsers: (params) => axiosInstance.get('/quick-commerce/admin/customers', { params }),
  getUserById: () => emptyResponse({}),
  approveSeller: (sellerId, data = {}) => axiosInstance.put(`/quick-commerce/admin/seller-requests/${sellerId}/approve`, data),
  getAdminWalletData: () => emptyResponse({}),
  getReports: () => emptyResponse([]),
  getFeeSettings: () => axiosInstance.get('/quick-commerce/admin/fee-settings'),
  createOrUpdateFeeSettings: (body) =>
    axiosInstance.put('/quick-commerce/admin/fee-settings', body ?? {}),
  updateFeeSettings: (body) =>
    axiosInstance.put('/quick-commerce/admin/fee-settings', body ?? {}),

  getPlatformSettings: () => axiosInstance.get('/quick-commerce/admin/fee-settings'),
  updatePlatformSettings: (body) =>
    axiosInstance.put('/quick-commerce/admin/fee-settings', body ?? {}),
  getDeliveryFinanceSettings: () => axiosInstance.get('/quick-commerce/admin/fee-settings'),
  updateDeliveryFinanceSettings: (body) =>
    axiosInstance.put('/quick-commerce/admin/fee-settings', body ?? {}),
  getFinanceSummary: () => axiosInstance.get('/quick-commerce/admin/finance/summary'),
  getFinanceLedger: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/finance/ledger', { params }),
  getFinancePayouts: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/finance/payouts', { params }),
  processFinancePayouts: () => emptyResponse({}),
  exportFinanceStatement: () => emptyResponse({}),
  getSellers: async () => {
    const response = await axiosInstance.get('/quick-commerce/admin/seller-requests', {
      params: { status: 'approved', limit: 100 },
    });
    return response;
  },
  /** Lightweight approved-seller list for product filters / dropdowns. */
  getSellerOptions: async () => {
    const response = await axiosInstance.get('/quick-commerce/admin/seller-requests', {
      params: { status: 'approved', limit: 100 },
    });
    return response;
  },
  getSellerRequests: (params) => axiosInstance.get('/quick-commerce/admin/seller-requests', { params }),
  rejectSeller: (sellerId, data = {}) => axiosInstance.put(`/quick-commerce/admin/seller-requests/${sellerId}/reject`, data),
  getTickets: (params = {}) => axiosInstance.get('/quick-commerce/admin/support-tickets', { params }),
  updateTicketStatus: (id, status) =>
    axiosInstance.patch(`/quick-commerce/admin/support-tickets/${id}`, { status }),
  replyTicket: (id, adminResponse) =>
    axiosInstance.patch(`/quick-commerce/admin/support-tickets/${id}`, { adminResponse }),
  getPendingReviews: () => emptyResponse({ items: [], total: 0 }),
  updateReviewStatus: () => emptyResponse({}),
  getSellerWithdrawals: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/withdrawals/sellers', { params }),
  getExpiredSellerLicenses: () =>
    axiosInstance.get('/quick-commerce/admin/notifications/license-expired'),
  getDeliveryWithdrawals: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/withdrawals/delivery', { params }),
  getSellerTransactions: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/seller-transactions', { params }),
  updateWithdrawalStatus: (id, body = {}) =>
    axiosInstance.patch(`/quick-commerce/admin/withdrawals/${String(id)}`, body),
  getDeliveryCashBalances: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/cash-collection/balances', { params }),
  getRiderCashDetails: (riderId, params = {}) =>
    axiosInstance.get(`/quick-commerce/admin/cash-collection/riders/${String(riderId)}`, { params }),
  settleRiderCash: (body = {}) =>
    axiosInstance.post('/quick-commerce/admin/cash-collection/settle', body),
  getCashSettlementHistory: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/cash-collection/history', { params }),
  getFAQs: (params) => axiosInstance.get('/quick-commerce/admin/faqs', { params }),
  createFAQ: (data) => axiosInstance.post('/quick-commerce/admin/faqs', data),
  updateFAQ: (id, data) => axiosInstance.put(`/quick-commerce/admin/faqs/${id}`, data),
  deleteFAQ: (id) => axiosInstance.delete(`/quick-commerce/admin/faqs/${id}`),
  getFaqCategories: () => axiosInstance.get('/quick-commerce/admin/faq-categories'),
  createFaqCategory: (data) => axiosInstance.post('/quick-commerce/admin/faq-categories', data),
  deleteFaqCategory: (id) => axiosInstance.delete(`/quick-commerce/admin/faq-categories/${id}`),
  getPublicFAQs: (params) => axiosInstance.get('/quick-commerce/public/faqs', { params }),
  getExperienceSections: (params) => axiosInstance.get('/quick-commerce/admin/experience/sections', { params }),
  createExperienceSection: (payload) => axiosInstance.post('/quick-commerce/admin/experience/sections', payload),
  updateExperienceSection: (id, payload) => axiosInstance.put(`/quick-commerce/admin/experience/sections/${id}`, payload),
  deleteExperienceSection: (id) => axiosInstance.delete(`/quick-commerce/admin/experience/sections/${id}`),
  reorderExperienceSections: (items) => axiosInstance.post('/quick-commerce/admin/experience/sections/reorder', items),
  uploadExperienceBanner: (formData) => adminApi.uploadSettingsImage(formData, 'experience'),
  getHeroConfig: (params) => axiosInstance.get('/quick-commerce/admin/experience/hero', { params }),
  setHeroConfig: (payload) => axiosInstance.post('/quick-commerce/admin/experience/hero', payload),
  getOffers: () => axiosInstance.get('/quick-commerce/offers'),
  createOffer: (payload) => axiosInstance.post('/quick-commerce/admin/offers', payload),
  updateOffer: (id, payload) => axiosInstance.put(`/quick-commerce/admin/offers/${id}`, payload),
  deleteOffer: (id) => axiosInstance.delete(`/quick-commerce/admin/offers/${id}`),
  reorderOffers: (items) => axiosInstance.post('/quick-commerce/admin/offers/reorder', items),
  getOfferSections: () => axiosInstance.get('/quick-commerce/admin/offer-sections'),
  createOfferSection: (payload) => axiosInstance.post('/quick-commerce/admin/offer-sections', payload),
  updateOfferSection: (id, payload) => axiosInstance.put(`/quick-commerce/admin/offer-sections/${id}`, payload),
  deleteOfferSection: (id) => axiosInstance.delete(`/quick-commerce/admin/offer-sections/${id}`),
  reorderOfferSections: (items) => axiosInstance.post('/quick-commerce/admin/offer-sections/reorder', items),
  getHomeTiles: () => axiosInstance.get('/quick-commerce/admin/home-tiles'),
  createHomeTile: (payload) =>
    axiosInstance.post('/quick-commerce/admin/home-tiles', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateHomeTile: (id, payload) =>
    axiosInstance.put(`/quick-commerce/admin/home-tiles/${id}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteHomeTile: (id) => axiosInstance.delete(`/quick-commerce/admin/home-tiles/${id}`),
  reorderHomeTiles: (items) => axiosInstance.post('/quick-commerce/admin/home-tiles/reorder', items),
  updateHomeHeadings: (payload) => axiosInstance.put('/quick-commerce/admin/home-headings', payload),
  getSellerCouponRequests: () => axiosInstance.get('/quick-commerce/admin/seller-coupon-requests'),
  updateSellerCouponRequestStatus: (id, status) =>
    axiosInstance.patch(`/quick-commerce/admin/seller-coupon-requests/${id}/status`, { status }),

  getCoupons: (params) => axiosInstance.get('/quick-commerce/admin/coupons', { params }),
  createCoupon: (payload) => axiosInstance.post('/quick-commerce/admin/coupons', payload),
  updateCoupon: (id, payload) => axiosInstance.put(`/quick-commerce/admin/coupons/${id}`, payload),
  deleteCoupon: (id) => axiosInstance.delete(`/quick-commerce/admin/coupons/${id}`),
  toggleCouponStatus: (id) => axiosInstance.patch(`/quick-commerce/admin/coupons/${id}/toggle-status`),

  getQuickZoneSellers: (zoneId) => axiosInstance.get(`/quick-commerce/admin/quick-zone-hubs/sellers/${zoneId}`),
  assignQuickZoneHubs: (body) => axiosInstance.post('/quick-commerce/admin/quick-zone-hubs', body),
  getSellerCODVerifications: () => axiosInstance.get('/quick-commerce/admin/sellers/cod-verification'),
  settleSellerCODVerification: (id, body) => axiosInstance.post(`/quick-commerce/admin/sellers/cod-verification/${id}/action`, body),
  
  createBroadcastNotification: (body = {}) => axiosInstance.post('/quick-commerce/admin/notifications/broadcast', body),
  getBroadcastNotifications: (params = {}) => axiosInstance.get('/quick-commerce/admin/notifications/broadcast', { params }),
  deleteBroadcastNotification: (id) => axiosInstance.delete(`/quick-commerce/admin/notifications/broadcast/${id}`),

  getCustomers: (params) => axiosInstance.get('/quick-commerce/admin/customers', { params }),
  getUserById: (id) => axiosInstance.get(`/quick-commerce/admin/customers/${id}`),

  getReturns: (params = {}) => axiosInstance.get('/quick-commerce/admin/returns', { params }),
  getReturnById: (returnId) => axiosInstance.get(`/quick-commerce/admin/returns/${returnId}`),
  processReturnRefund: (returnId, body = {}) =>
    axiosInstance.post(`/quick-commerce/admin/returns/${returnId}/refund`, body),
  passReturnQualityCheck: (returnId, body = {}) =>
    axiosInstance.post(`/quick-commerce/admin/returns/${returnId}/quality-pass`, body),
  confirmReturnPayout: (returnId, body = {}) =>
    axiosInstance.post(`/quick-commerce/admin/returns/${returnId}/confirm-payout`, body),
  getReturnFinanceReport: () => axiosInstance.get('/quick-commerce/admin/finance/returns/report'),
  getSellerFinanceLedger: (sellerId, params = {}) =>
    axiosInstance.get(`/quick-commerce/admin/finance/sellers/${sellerId}/ledger`, { params }),
};

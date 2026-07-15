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
  returnDeliveryCommission: 0,
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
  image: item.image?.url || item.image || '',
  status: item.status || (item.isActive ? 'active' : 'inactive'),
  type: item.type || 'header',
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
});

async function getQuickStatsPayload() {
  const [statsRes, categoriesRes, productsRes, ordersRes] = await Promise.all([
    axiosInstance.get('/quick-commerce/admin/stats'),
    axiosInstance.get('/quick-commerce/admin/categories', { params: { limit: 100, flat: true } }),
    axiosInstance.get('/quick-commerce/admin/products', { params: { limit: 100 } }),
    axiosInstance.get('/quick-commerce/admin/orders', { params: { limit: 20 } }),
  ]);

  const stats = statsRes.data?.result || {};
  const categories = categoriesRes.data?.results || categoriesRes.data?.result?.items || [];
  const products = productsRes.data?.result?.items || [];
  const orders = ordersRes.data?.result?.items || [];

  const revenueHistory = [...Array(6)].map((_, index) => ({
    name: `M${index + 1}`,
    revenue: index === 5 ? Number(stats.revenue || 0) : 0,
  }));

  const categoryData = categories.slice(0, 5).map((category, index) => ({
    name: category.name,
    value: index + 1,
    color: category.headerColor || category.accentColor || ['#0c831f', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'][index % 5],
  }));

  const recentOrders = orders.slice(0, 5).map((order) => ({
    id: order.orderNumber || order.id,
    customer: order.sessionId || 'Guest',
    status: order.status,
    statusText: String(order.status || 'pending').replace(/-/g, ' '),
    amount: `Rs${Number(order.total || 0).toFixed(0)}`,
    time: new Date(order.createdAt).toLocaleString(),
  }));

  const topProducts = products.slice(0, 5).map((product) => ({
    name: product.name,
    cat: product.categoryId?.name || 'Quick Commerce',
    rev: `Rs${Number(product.price || 0).toFixed(0)}`,
    trend: product.badge || 'Live',
    icon: '•',
    color: 'bg-emerald-50 text-emerald-700',
  }));

  return {
    overview: {
      totalUsers: Number(stats.users || 0),
      activeSellers: Number(stats.sellers || 0),
      totalOrders: Number(stats.orders || 0),
      totalRevenue: Number(stats.revenue || 0),
      prevTotalOrders: 0,
      prevTotalUsers: 0,
      prevActiveSellers: 0,
    },
    revenueHistory,
    categoryData,
    recentOrders,
    topProducts,
  };
}

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

  getStats: async () => ({
    data: {
      success: true,
      result: await getQuickStatsPayload(),
    },
  }),

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
      params: { tree: true, limit: 100, ...params },
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
  getDeliveryCommissionRules: () =>
    axiosInstance.get('/quick-commerce/admin/delivery/commission-rules'),
  createDeliveryCommissionRule: (body) =>
    axiosInstance.post('/quick-commerce/admin/delivery/commission-rules', body ?? {}),
  updateDeliveryCommissionRule: (id, body) =>
    axiosInstance.patch(`/quick-commerce/admin/delivery/commission-rules/${String(id)}`, body ?? {}),
  deleteDeliveryCommissionRule: (id) =>
    axiosInstance.delete(`/quick-commerce/admin/delivery/commission-rules/${String(id)}`),
  toggleDeliveryCommissionRuleStatus: (id, status) =>
    axiosInstance.patch(
      `/quick-commerce/admin/delivery/commission-rules/${String(id)}/status`,
      { status: Boolean(status) },
    ),
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
  getSellerRequests: (params) => axiosInstance.get('/quick-commerce/admin/seller-requests', { params }),
  rejectSeller: (sellerId, data = {}) => axiosInstance.put(`/quick-commerce/admin/seller-requests/${sellerId}/reject`, data),
  getTickets: (params = {}) => axiosInstance.get('/quick-commerce/admin/support-tickets', { params }),
  updateTicketStatus: (id, status) =>
    axiosInstance.patch(`/quick-commerce/admin/support-tickets/${id}`, { status }),
  replyTicket: (id, adminResponse) =>
    axiosInstance.patch(`/quick-commerce/admin/support-tickets/${id}`, { adminResponse }),
  getPendingReviews: () => emptyResponse({ items: [], total: 0 }),
  updateReviewStatus: () => emptyResponse({}),
  getDeliveryPartners: () => emptyResponse({ items: [], total: 0 }),
  approveDeliveryPartner: () => emptyResponse({}),
  rejectDeliveryPartner: () => emptyResponse({}),
  getActiveFleet: () => emptyResponse({ items: [], total: 0 }),
  getDeliveryTransactions: () => emptyResponse({ items: [], total: 0 }),
  settleTransaction: () => emptyResponse({}),
  bulkSettleDelivery: () => emptyResponse({}),
  getSellerWithdrawals: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/withdrawals/sellers', { params }),
  getDeliveryWithdrawals: (params = {}) =>
    axiosInstance.get('/quick-commerce/admin/withdrawals/delivery', { params }),
  getSellerTransactions: () => emptyResponse({ items: [], total: 0 }),
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
  getFAQs: () => emptyResponse({ items: [], total: 0 }),
  createFAQ: () => emptyResponse({}),
  updateFAQ: () => emptyResponse({}),
  deleteFAQ: () => emptyResponse({}),
  getPublicFAQs: () => emptyResponse({ items: [] }),
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
  getCoupons: () => emptyResponse([]),
  createCoupon: () => emptyResponse({}),
  updateCoupon: () => emptyResponse({}),
  deleteCoupon: () => emptyResponse({}),

  // Seller Commission Management
  getSellerCommissionBootstrap: () => axiosInstance.get('/quick-commerce/admin/seller-commissions/bootstrap'),
  getSellerCommissions: (params) => axiosInstance.get('/quick-commerce/admin/seller-commissions', { params }),
  getSellerCommissionById: (id) => axiosInstance.get(`/quick-commerce/admin/seller-commissions/${id}`),
  createSellerCommission: (payload) => axiosInstance.post('/quick-commerce/admin/seller-commissions', payload),
  updateSellerCommission: (id, payload) => axiosInstance.put(`/quick-commerce/admin/seller-commissions/${id}`, payload),
  deleteSellerCommission: (id) => axiosInstance.delete(`/quick-commerce/admin/seller-commissions/${id}`),
  toggleSellerCommissionStatus: (id) => axiosInstance.patch(`/quick-commerce/admin/seller-commissions/${id}/toggle-status`),

  // Returns Management
  getReturns: (params) => axiosInstance.get('/quick-commerce/returns/admin', { params }),
  getReturnDetails: (returnRequestId) => axiosInstance.get(`/quick-commerce/returns/admin/${returnRequestId}`),
  approveReturn: (returnRequestId, approvals) => axiosInstance.post(`/quick-commerce/returns/admin/${returnRequestId}/approve`, { approvals }),
  cancelReturn: (returnRequestId, reason) => axiosInstance.post(`/quick-commerce/returns/admin/${returnRequestId}/cancel`, { reason }),
  refundReturnLeg: (sellerReturnId) => axiosInstance.post(`/quick-commerce/returns/admin/legs/${sellerReturnId}/refund`),
  triggerAutoAssign: (sellerReturnId) => axiosInstance.post(`/quick-commerce/returns/admin/legs/${sellerReturnId}/auto-assign`),
};

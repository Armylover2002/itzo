import apiClient from '@/services/api/axios';

const SESSION_KEY = 'quick_commerce_session_id';

export function getQuickSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `qc_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

const withSession = (config = {}) => {
  const sessionId = getQuickSessionId();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'x-quick-session': sessionId,
    },
  };
};

const unwrap = (response) => response?.data?.result;

const quickApi = {
  getHome: async (params = {}) =>
    unwrap(
      await apiClient.get(
        '/quick-commerce/home',
        withSession({ params })
      )
    ),
  getCategories: async (params = {}) => {
    const res = await apiClient.get(
      '/quick-commerce/categories',
      withSession({ params })
    );
    return res?.data?.results || [];
  },
  getProducts: async (params = {}) =>
    unwrap(
      await apiClient.get(
        '/quick-commerce/products',
        withSession({ params: { ...params } })
      )
    ),
  getCart: async () => unwrap(await apiClient.get('/quick-commerce/cart', withSession())),
  addToCart: async (productId, quantity = 1) => unwrap(await apiClient.post('/quick-commerce/cart/add', { productId, quantity }, withSession())),
  updateCart: async (productId, quantity) => unwrap(await apiClient.put('/quick-commerce/cart/update', { productId, quantity }, withSession())),
  removeFromCart: async (productId) => unwrap(await apiClient.delete(`/quick-commerce/cart/remove/${productId}`, withSession())),
  clearCart: async () => unwrap(await apiClient.delete('/quick-commerce/cart/clear', withSession())),
  placeOrder: async () => unwrap(await apiClient.post('/quick-commerce/orders', {}, withSession())),
  getOrders: async () => unwrap(await apiClient.get('/quick-commerce/orders', withSession())),
};

export default quickApi;

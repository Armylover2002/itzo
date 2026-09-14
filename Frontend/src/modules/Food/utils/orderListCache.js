const ORDER_LIST_CACHE_TTL_MS = 30 * 1000;

let cache = {
  orders: [],
  fingerprint: "",
  fetchedAt: 0,
};

export const ordersFingerprint = (list = []) =>
  JSON.stringify(
    (Array.isArray(list) ? list : []).map((o) =>
      String(o?._id || o?.id || o?.orderId || o?.orderNumber || ""),
    ),
  );

export const isOrderListCacheFresh = (ttlMs = ORDER_LIST_CACHE_TTL_MS) =>
  cache.fetchedAt > 0 && Date.now() - cache.fetchedAt < Number(ttlMs || ORDER_LIST_CACHE_TTL_MS);

export const getOrderListCache = () => ({
  orders: cache.orders,
  fingerprint: cache.fingerprint,
});

export const setOrderListCache = (orders, fingerprint = ordersFingerprint(orders)) => {
  cache = {
    orders: Array.isArray(orders) ? orders : [],
    fingerprint,
    fetchedAt: Date.now(),
  };
};

export const invalidateOrderListCache = () => {
  cache = { orders: [], fingerprint: "", fetchedAt: 0 };
};

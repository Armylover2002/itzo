import { create } from 'zustand';

const getOrderKey = (orderLike = {}) => {
  // Keep this consistent everywhere; queue operations depend on it.
  const orderMongoId =
    orderLike?.orderMongoId ||
    orderLike?.order_mongo_id ||
    orderLike?._id ||
    orderLike?.mongoId ||
    orderLike?.mongo_id;

  const orderId =
    orderLike?.orderId ||
    orderLike?.order_id ||
    orderLike?.order_id_str ||
    orderLike?.id;

  const key = orderMongoId || orderId;
  return key == null ? '' : String(key).trim();
};

const getOrderCandidateKeys = (orderLike = {}) => {
  const candidates = [
    orderLike?.orderMongoId,
    orderLike?.order_mongo_id,
    orderLike?._id,
    orderLike?.mongoId,
    orderLike?.mongo_id,
    orderLike?.orderId,
    orderLike?.order_id,
    orderLike?.order_id_str,
    orderLike?.id,
  ];

  return candidates
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
};

/**
 * Incoming Orders Queue (restaurant panel)
 *
 * - Single centralized store (module singleton)
 * - Dedupes by order key
 * - Tracks "ringing" per order so ringtone stops only when appropriate
 */
export const useIncomingOrderQueueStore = create((set, get) => ({
  // Each entry is { key, order, ringing }
  orders: [],
  ringPulseCounter: 0,
  // When true, restaurant can use Live Orders behind; queue timers keep running.
  panelMinimized: false,

  getOrderKey,

  setPanelMinimized: (minimized) =>
    set({ panelMinimized: Boolean(minimized) }),

  enqueueIncomingOrder: (orderLike = {}, { ringOnNew = false } = {}) => {
    const key = getOrderKey(orderLike);
    if (!key) return { added: false, key: '' };

    const incomingKeySet = new Set(getOrderCandidateKeys(orderLike));
    const state = get();
    const exists = state.orders.some((o) => {
      if (!o?.order) return incomingKeySet.has(o?.key);
      const existingKeySet = new Set(getOrderCandidateKeys(o.order));
      for (const k of existingKeySet) {
        if (incomingKeySet.has(k)) return true;
      }
      return false;
    });
    if (exists) return { added: false, key };

    const wasEmpty = state.orders.length === 0;

    set((s) => ({
      orders: [
        ...s.orders,
        {
          key,
          order: orderLike,
          ringing: Boolean(ringOnNew),
        },
      ],
      ringPulseCounter: ringOnNew ? s.ringPulseCounter + 1 : s.ringPulseCounter,
      // Only force-open when queue was empty. If staff minimized to work Live Orders,
      // a new arrival must not yank them back onto the popup layer.
      panelMinimized: wasEmpty ? false : s.panelMinimized,
    }));

    return { added: true, key };
  },

  stopRinging: (orderLikeOrKey) => {
    const incomingKeys =
      typeof orderLikeOrKey === 'string'
        ? [String(orderLikeOrKey).trim()].filter(Boolean)
        : getOrderCandidateKeys(orderLikeOrKey);
    if (!incomingKeys.length) return;

    set((s) => ({
      orders: s.orders.map((o) => {
        const existingKeys = getOrderCandidateKeys(o.order);
        const match = existingKeys.some((k) => incomingKeys.includes(k));
        return match ? { ...o, ringing: false } : o;
      }),
    }));
  },

  removeIncomingOrder: (orderLikeOrKey) => {
    const incomingKeys =
      typeof orderLikeOrKey === 'string'
        ? [String(orderLikeOrKey).trim()].filter(Boolean)
        : getOrderCandidateKeys(orderLikeOrKey);
    if (!incomingKeys.length) return;

    set((s) => {
      const nextOrders = s.orders.filter((o) => {
        const existingKeys = getOrderCandidateKeys(o.order);
        return !existingKeys.some((k) => incomingKeys.includes(k));
      });
      return {
        orders: nextOrders,
        panelMinimized: nextOrders.length === 0 ? false : s.panelMinimized,
      };
    });
  },

  clearQueue: () =>
    set({ orders: [], ringPulseCounter: 0, panelMinimized: false }),
}));


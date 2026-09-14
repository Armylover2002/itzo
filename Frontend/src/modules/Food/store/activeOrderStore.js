import { create } from "zustand";
import {
  computeEtaMinutes,
  getOrderKey,
  isTerminalOrder,
  orderKeysMatch,
  shouldShowActiveOrderBanner,
} from "../utils/activeOrderUtils";

/**
 * Single source of truth for the User Active Order Banner.
 * Side effects (socket, polling, API) live in useActiveOrderManager.
 */
export const useActiveOrderStore = create((set, get) => ({
  activeOrder: null,
  dismissedKey: null,
  etaMinutes: null,
  isSyncing: false,
  lastSyncedAt: 0,
  socketConnected: false,
  /** Keys proven 404/400 — same role as old OrderTrackingCard.invalidOrderIds */
  invalidOrderIds: {},

  setSocketConnected: (connected) => set({ socketConnected: Boolean(connected) }),

  setDismissedKey: (key) => set({ dismissedKey: key || null }),

  dismissCurrent: () => {
    const key = getOrderKey(get().activeOrder);
    if (key) set({ dismissedKey: key });
  },

  markInvalidOrderId: (orderKey) => {
    const key = String(orderKey || "").trim();
    if (!key) return;
    set((state) => ({
      invalidOrderIds: { ...state.invalidOrderIds, [key]: true },
    }));
  },

  clearActiveOrder: () => set({ activeOrder: null, etaMinutes: null }),

  /** Full wipe on logout — prevents stale Zustand across sessions. */
  reset: () =>
    set({
      activeOrder: null,
      dismissedKey: null,
      etaMinutes: null,
      isSyncing: false,
      lastSyncedAt: 0,
      socketConnected: false,
      invalidOrderIds: {},
    }),

  setActiveOrder: (order) => {
    if (!order || isTerminalOrder(order)) {
      set({ activeOrder: null, etaMinutes: null });
      return;
    }
    const key = getOrderKey(order);
    if (key && get().invalidOrderIds[key]) {
      set({ activeOrder: null, etaMinutes: null });
      return;
    }
    set({
      activeOrder: order,
      etaMinutes: computeEtaMinutes(order),
      lastSyncedAt: Date.now(),
    });
  },

  mergeActiveOrder: (patch = {}) => {
    const current = get().activeOrder;
    if (!current) return;

    const dispatchPatch = patch.dispatch
      ? { ...(current.dispatch || {}), ...patch.dispatch }
      : current.dispatch;

    // Socket payloads often send flat dispatchStatus — map into dispatch.status.
    const flatDispatchStatus =
      patch.dispatchStatus != null
        ? String(patch.dispatchStatus).trim()
        : patch.dispatch_status != null
          ? String(patch.dispatch_status).trim()
          : "";
    const nextDispatch = flatDispatchStatus
      ? { ...(dispatchPatch || {}), status: flatDispatchStatus }
      : dispatchPatch;

    const merged = {
      ...current,
      ...patch,
      dispatch: nextDispatch,
      deliveryState: patch.deliveryState
        ? { ...(current.deliveryState || {}), ...patch.deliveryState }
        : current.deliveryState,
    };

    // Avoid leaving raw socket-only keys as order fields of record.
    delete merged.dispatchStatus;
    delete merged.dispatch_status;

    if (isTerminalOrder(merged)) {
      set({ activeOrder: null, etaMinutes: null });
      return;
    }

    set({
      activeOrder: merged,
      etaMinutes: computeEtaMinutes(merged),
    });
  },

  removeIfMatches: (orderKey) => {
    const currentKey = getOrderKey(get().activeOrder);
    if (!currentKey || !orderKeysMatch(currentKey, orderKey)) return;
    set({ activeOrder: null, etaMinutes: null });
  },

  tickEta: () => {
    const { activeOrder } = get();
    if (!activeOrder) {
      set({ etaMinutes: null });
      return;
    }
    if (isTerminalOrder(activeOrder)) {
      set({ activeOrder: null, etaMinutes: null });
      return;
    }
    set({ etaMinutes: computeEtaMinutes(activeOrder) });
  },

  setSyncing: (isSyncing) => set({ isSyncing }),

  getBannerOrder: () => {
    const { activeOrder, dismissedKey } = get();
    return shouldShowActiveOrderBanner(activeOrder, dismissedKey) ? activeOrder : null;
  },
}));

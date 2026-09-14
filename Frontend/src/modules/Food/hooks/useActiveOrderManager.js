import { useEffect, useRef, useCallback } from "react";
import { useOrders } from "@food/context/OrdersContext";
import { orderAPI } from "@food/api";
import { customerApi } from "@/modules/quickCommerce/user/services/customerApi";
import { useActiveOrderStore } from "@food/store/activeOrderStore";
import {
  activeOrdersFingerprint,
  extractOrderFromDetailResponse,
  getCustomerToken,
  getOrderKey,
  getOrderStatus,
  isTerminalOrder,
  isTerminalStatus,
  mergeUniqueOrders,
  parseOrdersListResponse,
  pickActiveOrderFromList,
} from "@food/utils/activeOrderUtils";
import {
  getOrderListCache,
  invalidateOrderListCache,
  isOrderListCacheFresh,
  setOrderListCache,
} from "@food/utils/orderListCache";

/** Poll while an in-flight order exists. */
const POLL_ACTIVE_CONNECTED_MS = 45_000;
const POLL_ACTIVE_DISCONNECTED_MS = 20_000;
const POLL_TICK_MS = 5_000;
const ETA_TICK_MS = 10_000;
const SOCKET_DEBOUNCE_MS = 300;
/** Enough recent rows to find an in-flight order without heavy history payload. */
const ACTIVE_PROBE_LIMIT = 5;

/**
 * Module-level guards — survive StrictMode remounts / accidental double bridges
 * so we never stampede GET /food/orders?scope=active.
 */
let globalInFlight = null;
let globalLastNetworkAt = 0;
let globalSubscriberCount = 0;

/**
 * Owns active-order lifecycle: socket-driven refresh, polling fallback, cache invalidation,
 * and detail hydration (etaPromise.endsAt). Mount only where the banner is shown (Food Home).
 */
export function useActiveOrderManager() {
  const { orders: contextOrders } = useOrders();
  const contextOrdersRef = useRef(contextOrders);
  contextOrdersRef.current = contextOrders;

  const refreshGenRef = useRef(0);
  const lastPollAtRef = useRef(0);
  const socketDebounceRef = useRef(null);
  const hasFetchedApiRef = useRef(false);
  const bootstrapStartedRef = useRef(false);
  const hasActiveOrderRef = useRef(false);
  const resolveRef = useRef(async () => {});

  const setActiveOrder = useActiveOrderStore((s) => s.setActiveOrder);
  const mergeActiveOrder = useActiveOrderStore((s) => s.mergeActiveOrder);
  const removeIfMatches = useActiveOrderStore((s) => s.removeIfMatches);
  const resetStore = useActiveOrderStore((s) => s.reset);
  const markInvalidOrderId = useActiveOrderStore((s) => s.markInvalidOrderId);
  const tickEta = useActiveOrderStore((s) => s.tickEta);
  const setSyncing = useActiveOrderStore((s) => s.setSyncing);
  const setSocketConnected = useActiveOrderStore((s) => s.setSocketConnected);

  const resolveActiveFromSources = useCallback(
    async ({ force = false, preferDetailKey = null } = {}) => {
      const token = getCustomerToken();
      if (!token) {
        resetStore();
        hasActiveOrderRef.current = false;
        return;
      }

      // Global single-flight: overlapping callers share one network pass.
      if (globalInFlight) {
        return globalInFlight;
      }

      const gen = ++refreshGenRef.current;
      setSyncing(true);

      const run = (async () => {
        try {
          let apiOrders = [];
          let fetchedThisPass = false;

          // Idle sessions keep cache longer; force only on socket/auth events.
          const cacheTtlOk =
            !force &&
            isOrderListCacheFresh(hasActiveOrderRef.current ? 30_000 : 90_000);

          if (cacheTtlOk) {
            apiOrders = getOrderListCache().orders;
            if (apiOrders.length > 0 || hasFetchedApiRef.current) {
              hasFetchedApiRef.current = true;
            }
          } else {
            // Soft floor between real HTTP probes (blocks spammy socket/auth storms).
            const minGapMs = force ? 2_000 : 5_000;
            const now = Date.now();
            const withinGap =
              globalLastNetworkAt > 0 && now - globalLastNetworkAt < minGapMs;
            const cachedOrders = getOrderListCache().orders;

            if (
              withinGap &&
              (hasFetchedApiRef.current || isOrderListCacheFresh(90_000))
            ) {
              apiOrders = cachedOrders;
              hasFetchedApiRef.current = true;
            } else {
              if (force) {
                orderAPI.getOrders.invalidate?.();
                invalidateOrderListCache();
              }

              globalLastNetworkAt = now;
              // scope=active skips cancelled/delivered history → much smaller payload.
              const response = await orderAPI.getOrders({
                limit: ACTIVE_PROBE_LIMIT,
                page: 1,
                scope: "active",
              });
              if (gen !== refreshGenRef.current) return;

              apiOrders = parseOrdersListResponse(response);
              setOrderListCache(apiOrders, activeOrdersFingerprint(apiOrders));
              hasFetchedApiRef.current = true;
              fetchedThisPass = true;
            }
          }

          const invalidOrderIds = useActiveOrderStore.getState().invalidOrderIds;
          const merged = mergeUniqueOrders(apiOrders, contextOrdersRef.current, {
            hasFetchedApi: hasFetchedApiRef.current || fetchedThisPass,
            invalidOrderIds,
          });
          let candidate = pickActiveOrderFromList(merged);

          if (preferDetailKey) {
            const preferKey = String(preferDetailKey).trim();
            const preferred = merged.find((order) => getOrderKey(order) === preferKey);
            if (preferred && !isTerminalOrder(preferred)) {
              candidate = preferred;
            } else if (preferred && isTerminalStatus(getOrderStatus(preferred))) {
              removeIfMatches(preferKey);
              candidate = pickActiveOrderFromList(
                merged.filter((o) => getOrderKey(o) !== preferKey),
              );
            }
          }

          if (!candidate) {
            hasActiveOrderRef.current = false;
            setActiveOrder(null);
            return;
          }

          const detailKey = getOrderKey(candidate);
          if (!detailKey) {
            hasActiveOrderRef.current = false;
            setActiveOrder(null);
            return;
          }

          hasActiveOrderRef.current = true;

          // Preserve old card behavior: show list/context candidate immediately,
          // then hydrate detail (endsAt) without blanking the banner.
          if (!isTerminalOrder(candidate)) {
            setActiveOrder(candidate);
          }

          try {
            const isQuickCandidate =
              String(candidate?.orderType || "").toLowerCase() === "quick" ||
              /^QC/i.test(String(candidate?.orderId || candidate?.id || ""));
            const detailRes = isQuickCandidate
              ? await customerApi.getOrderDetails(detailKey, {
                  force: force || Boolean(preferDetailKey),
                })
              : await orderAPI.getOrderDetails(detailKey, {
                  force: force || Boolean(preferDetailKey),
                });
            if (gen !== refreshGenRef.current) return;

            const detail = extractOrderFromDetailResponse(detailRes);
            if (detail && !isTerminalOrder(detail)) {
              setActiveOrder({ ...candidate, ...detail });
              hasActiveOrderRef.current = true;
            } else if (detail && isTerminalOrder(detail)) {
              hasActiveOrderRef.current = false;
              setActiveOrder(null);
            }
            // If detail payload unusable, keep list candidate already set.
          } catch (error) {
            if (gen !== refreshGenRef.current) return;

            if (error?.response?.status === 404 || error?.response?.status === 400) {
              markInvalidOrderId(detailKey);
              removeIfMatches(detailKey);
              const fallback = pickActiveOrderFromList(
                merged.filter((order) => getOrderKey(order) !== detailKey),
              );
              if (fallback) {
                hasActiveOrderRef.current = true;
                setActiveOrder(fallback);
              } else {
                hasActiveOrderRef.current = false;
                setActiveOrder(null);
              }
            }
            // Non-404: keep optimistic/list candidate already set.
          }
        } finally {
          if (gen === refreshGenRef.current) {
            setSyncing(false);
          }
        }
      })();

      globalInFlight = run.finally(() => {
        if (globalInFlight === run) globalInFlight = null;
      });
      return globalInFlight;
    },
    [
      markInvalidOrderId,
      removeIfMatches,
      resetStore,
      setActiveOrder,
      setSyncing,
    ],
  );

  resolveRef.current = resolveActiveFromSources;

  // Bootstrap once per mount; ref + global gap prevent StrictMode double-hit spam.
  useEffect(() => {
    if (!getCustomerToken()) {
      resetStore();
      hasActiveOrderRef.current = false;
      bootstrapStartedRef.current = false;
      return undefined;
    }
    if (!bootstrapStartedRef.current) {
      bootstrapStartedRef.current = true;
      lastPollAtRef.current = Date.now();
      void resolveRef.current();
    }
    return undefined;
    // Intentionally mount-only — resolve via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll only while an active order exists. Idle = socket / order-placed / visibility only.
  useEffect(() => {
    if (!getCustomerToken()) return undefined;

    globalSubscriberCount += 1;

    const runPollIfDue = () => {
      const connected =
        typeof window !== "undefined" && window.orderSocketConnected === true;
      setSocketConnected(connected);

      const hasActive = hasActiveOrderRef.current;
      // No in-flight order → do not HTTP-poll (banner idle).
      if (!hasActive) return;

      const pollInterval = connected
        ? POLL_ACTIVE_CONNECTED_MS
        : POLL_ACTIVE_DISCONNECTED_MS;

      const now = Date.now();
      if (now - lastPollAtRef.current < pollInterval) return;
      if (now - globalLastNetworkAt < pollInterval) return;

      lastPollAtRef.current = now;
      // Prefer cache when socket is healthy; force only when disconnected.
      void resolveRef.current({ force: !connected });
    };

    const id = setInterval(runPollIfDue, POLL_TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!hasActiveOrderRef.current) return;
      lastPollAtRef.current = 0;
      void resolveRef.current({ force: true });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      globalSubscriberCount = Math.max(0, globalSubscriberCount - 1);
    };
    // Intentionally stable — resolve via ref; avoid interval churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!getCustomerToken()) return undefined;
    const id = setInterval(() => tickEta(), ETA_TICK_MS);
    return () => clearInterval(id);
  }, [tickEta]);

  useEffect(() => {
    if (!getCustomerToken()) return undefined;

    const invalidateCaches = () => {
      invalidateOrderListCache();
      orderAPI.getOrders.invalidate?.();
    };

    const handleOrderStatusNotification = (event) => {
      const detail = event?.detail || {};
      const incomingKey = String(detail.orderMongoId || detail.orderId || "").trim();
      const status = detail.orderStatus || detail.status;

      if (incomingKey && isTerminalStatus(status)) {
        removeIfMatches(incomingKey);
        hasActiveOrderRef.current = false;
      }

      const currentKey = getOrderKey(useActiveOrderStore.getState().activeOrder);
      if (incomingKey && currentKey && incomingKey === currentKey) {
        mergeActiveOrder({
          orderStatus: detail.orderStatus,
          status: detail.status || detail.orderStatus,
          deliveryState: detail.deliveryState,
          dispatchStatus: detail.dispatchStatus,
          dispatch: detail.dispatch,
        });
        if (isTerminalStatus(status)) {
          invalidateCaches();
          return;
        }
      }

      invalidateCaches();

      if (socketDebounceRef.current) {
        clearTimeout(socketDebounceRef.current);
      }
      socketDebounceRef.current = setTimeout(() => {
        lastPollAtRef.current = 0;
        void resolveRef.current({
          force: true,
          preferDetailKey: incomingKey || undefined,
        });
      }, SOCKET_DEBOUNCE_MS);
    };

    const handleOrderPlaced = (event) => {
      const placed = event?.detail?.order || null;
      // Immediate banner — same intent as old card merging context + fast refetch.
      if (placed && !isTerminalOrder(placed)) {
        hasActiveOrderRef.current = true;
        setActiveOrder(placed);
      }
      invalidateCaches();
      lastPollAtRef.current = 0;
      void resolveRef.current({
        force: true,
        preferDetailKey: getOrderKey(placed) || undefined,
      });
    };

    const handleAuthChange = () => {
      if (!getCustomerToken()) {
        resetStore();
        hasFetchedApiRef.current = false;
        bootstrapStartedRef.current = false;
        hasActiveOrderRef.current = false;
        return;
      }
      lastPollAtRef.current = 0;
      void resolveRef.current({ force: true });
    };

    window.addEventListener("orderStatusNotification", handleOrderStatusNotification);
    window.addEventListener("order-placed", handleOrderPlaced);
    window.addEventListener("userAuthChanged", handleAuthChange);

    return () => {
      window.removeEventListener("orderStatusNotification", handleOrderStatusNotification);
      window.removeEventListener("order-placed", handleOrderPlaced);
      window.removeEventListener("userAuthChanged", handleAuthChange);
      if (socketDebounceRef.current) {
        clearTimeout(socketDebounceRef.current);
      }
    };
  }, [mergeActiveOrder, removeIfMatches, resetStore, setActiveOrder]);

  return null;
}

/** Mount beside OrderTrackingCard on Food Home only (not all UserLayout routes). */
export function ActiveOrderManagerBridge() {
  useActiveOrderManager();
  return null;
}

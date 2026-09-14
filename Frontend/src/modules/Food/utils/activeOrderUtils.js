/**
 * Active Order Banner — pure helpers (no side effects).
 */

export const TERMINAL_STATUSES = new Set([
  "completed",
  "delivered",
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_restaurant",
  "cancelled_by_admin",
  "cancelled_by_system",
  "payment_failed",
  "expired",
  "failed",
]);

export const getCustomerToken = () =>
  localStorage.getItem("auth_customer") ||
  localStorage.getItem("user_accessToken") ||
  localStorage.getItem("accessToken") ||
  null;

export const getOrderKey = (order) => {
  const key =
    order?.orderMongoId ||
    order?._id ||
    order?.id ||
    order?.orderId ||
    null;
  return key == null ? "" : String(key).trim();
};

export const orderKeysMatch = (a, b) => {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  return left === right;
};

export const getOrderStatus = (order) =>
  String(
    order?.orderStatus || order?.status || order?.deliveryState?.status || "",
  ).toLowerCase();

export const getOrderPhase = (order) =>
  String(order?.deliveryState?.currentPhase || "").toLowerCase();

const pickMediaUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && typeof value.url === "string") {
    return value.url.trim();
  }
  return "";
};

const firstPickup = (order) =>
  (Array.isArray(order?.pickupPoints) && order.pickupPoints[0]) ||
  (Array.isArray(order?.pickupSources) && order.pickupSources[0]) ||
  null;

/** Restaurant / store image for the home active-order banner. */
export const getActiveOrderVenueImageUrl = (order, { isQuickOrder = false } = {}) => {
  if (!order) return "";
  const pickup = firstPickup(order);
  const candidates = isQuickOrder
    ? [
        order.storeImage,
        order.storeLogo,
        order.sellerImage,
        order.storeProfileImage,
        order.restaurantImage,
        order.seller?.shopImage,
        order.seller?.image,
        order.seller?.shopInfo?.shopImage,
        pickup?.image,
        pickup?.shopImage,
        order.restaurant?.profileImage,
        order.restaurantId?.profileImage,
        order.restaurantId?.shopImage,
        order.restaurantId?.image,
      ]
    : [
        order.restaurantImage,
        order.restaurantProfileImage,
        order.restaurant?.profileImage,
        order.restaurant?.image,
        order.restaurantId?.profileImage,
        order.restaurantId?.image,
      ];

  for (const candidate of candidates) {
    const url = pickMediaUrl(candidate);
    if (url) return url;
  }
  return "";
};

export const getActiveOrderVenueName = (order, { isQuickOrder = false } = {}) => {
  if (!order) return isQuickOrder ? "Store" : "Restaurant";
  const pickup = firstPickup(order);
  const name = String(
    order.storeName ||
      order.sellerName ||
      order.seller?.shopName ||
      order.seller?.name ||
      pickup?.sourceName ||
      pickup?.name ||
      pickup?.shopName ||
      order.restaurant ||
      order.restaurantName ||
      order.restaurantId?.restaurantName ||
      order.restaurantId?.shopName ||
      order.restaurantId?.name ||
      order.items?.[0]?.sourceName ||
      "",
  ).trim();
  return name || (isQuickOrder ? "Store" : "Restaurant");
};

/** Sparse socket/list payloads may omit status but still send a live phase. */
export const ACTIVE_PHASES = new Set([
  "created",
  "confirmed",
  "preparing",
  "accepted",
  "ready",
  "ready_for_pickup",
  "reached_pickup",
  "picked_up",
  "out_for_delivery",
  "en_route_to_delivery",
  "at_pickup",
  "at_drop",
]);

export const isTerminalStatus = (statusLike) => {
  const status = String(statusLike || "").toLowerCase();
  if (!status) return false;
  if (TERMINAL_STATUSES.has(status)) return true;
  if (status.includes("cancel")) return true;
  return false;
};

export const isTerminalOrder = (order) => {
  if (!order) return true;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  if (isTerminalStatus(status)) return true;
  if (phase === "completed" || phase === "delivered") return true;
  return false;
};

export const isActiveOrderCandidate = (order) => {
  if (!order || isTerminalOrder(order)) return false;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  // Preserve old OrderTrackingCard: phase-only payloads stay visible when phase is in-flight.
  if (!status && phase) return ACTIVE_PHASES.has(phase);
  if (!status) return false;
  if (status === "scheduled") return false;
  return true;
};

/**
 * ETA priority:
 * 1. etaPromise.endsAt / eta.endsAt (absolute backend clock)
 * 2. startsAt + max minutes
 * 3. elapsed from createdAt vs backend minute window (max / mid / estimatedDeliveryTime)
 * 4. Soft display fallback (35 min from createdAt) so home banner never shows blank STATUS
 */
export const computeEtaMinutes = (order, now = Date.now()) => {
  if (!order) return null;

  const endsAtRaw = order?.etaPromise?.endsAt || order?.eta?.endsAt;
  if (endsAtRaw) {
    const endsAtMs = new Date(endsAtRaw).getTime();
    if (Number.isFinite(endsAtMs)) {
      return Math.max(0, Math.floor((endsAtMs - now) / 60000));
    }
  }

  const startsAtRaw = order?.etaPromise?.startsAt || order?.eta?.startsAt;
  const maxFromPromise = Number(
    order?.etaPromise?.max ?? order?.eta?.max ?? order?.etaPromise?.mid ?? order?.eta?.mid,
  );
  if (startsAtRaw && Number.isFinite(maxFromPromise) && maxFromPromise > 0) {
    const startsAtMs = new Date(startsAtRaw).getTime();
    if (Number.isFinite(startsAtMs)) {
      const endsAtMs = startsAtMs + maxFromPromise * 60000;
      return Math.max(0, Math.floor((endsAtMs - now) / 60000));
    }
  }

  const maxMinutesRaw =
    order?.etaPromise?.max ??
    order?.eta?.max ??
    order?.etaPromise?.mid ??
    order?.eta?.mid ??
    order?.estimatedDeliveryTime ??
    order?.estimatedTime ??
    order?.estimated_delivery_time ??
    null;

  let maxMinutes = Number(maxMinutesRaw);
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) {
    // Parse strings like "25-30 mins" / "30 min"
    const parsed = String(
      order?.estimatedDeliveryTime ||
        order?.estimatedTime ||
        order?.restaurant?.estimatedDeliveryTime ||
        order?.restaurantId?.estimatedDeliveryTime ||
        "",
    ).match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (parsed) {
      const low = Number(parsed[1]);
      const high = Number(parsed[2] || parsed[1]);
      if (Number.isFinite(low) && Number.isFinite(high)) {
        maxMinutes = Math.round((low + high) / 2);
      }
    }
  }

  const createdRaw =
    order?.createdAt || order?.orderDate || order?.created_at || order?.date;
  const createdMs = createdRaw ? new Date(createdRaw).getTime() : NaN;

  if (Number.isFinite(maxMinutes) && maxMinutes > 0 && Number.isFinite(createdMs)) {
    const elapsedMinutes = Math.floor((now - createdMs) / 60000);
    return Math.max(0, maxMinutes - elapsedMinutes);
  }

  // Soft banner fallback for in-flight orders that predate ETA persistence.
  if (Number.isFinite(createdMs)) {
    const DEFAULT_DISPLAY_WINDOW_MIN = 35;
    const elapsedMinutes = Math.floor((now - createdMs) / 60000);
    return Math.max(0, DEFAULT_DISPLAY_WINDOW_MIN - elapsedMinutes);
  }

  return null;
};

export const shouldShowActiveOrderBanner = (order, dismissedKey) => {
  if (!order || !getCustomerToken()) return false;
  if (isTerminalOrder(order)) return false;
  if (getOrderStatus(order) === "scheduled") return false;
  const key = getOrderKey(order);
  if (!key) return false;
  if (dismissedKey && orderKeysMatch(dismissedKey, key)) return false;
  return true;
};

/**
 * Banner visibility with optional lifecycle projection (Phase 1 SSOT).
 * When life.hideBanner is true, banner is hidden.
 */
export const shouldShowActiveOrderBannerWithLifecycle = (
  order,
  dismissedKey,
  lifecycle = null,
) => {
  if (!shouldShowActiveOrderBanner(order, dismissedKey)) return false;
  if (lifecycle?.hideBanner) return false;
  return true;
};

export const pickActiveOrderFromList = (orders = []) => {
  if (!Array.isArray(orders)) return null;
  return orders.find((order) => isActiveOrderCandidate(order)) || null;
};

export const parseOrdersListResponse = (response) => {
  if (response?.data?.success && response?.data?.data?.orders) {
    return response.data.data.orders;
  }
  if (response?.data?.orders) {
    return response.data.orders;
  }
  if (response?.data?.data?.data && Array.isArray(response.data.data.data)) {
    return response.data.data.data;
  }
  if (response?.data?.data?.docs && Array.isArray(response.data.data.docs)) {
    return response.data.data.docs;
  }
  if (response?.data?.data && Array.isArray(response.data.data)) {
    return response.data.data;
  }
  return [];
};

export const extractOrderFromDetailResponse = (response) =>
  response?.data?.data?.order ||
  response?.data?.order ||
  response?.data?.result ||
  response?.data?.data ||
  null;

/** Fingerprint includes status + ETA fields so list sync picks up ETA changes. */
export const activeOrdersFingerprint = (orders = []) => {
  if (!Array.isArray(orders) || orders.length === 0) return "";
  return orders
    .map((o) => {
      const key = getOrderKey(o);
      const status = getOrderStatus(o);
      const endsAt = o?.etaPromise?.endsAt || o?.eta?.endsAt || "";
      const max =
        o?.etaPromise?.max ??
        o?.eta?.max ??
        o?.estimatedDeliveryTime ??
        "";
      return `${key}:${status}:${endsAt}:${max}`;
    })
    .join("|");
};

/**
 * Merge API + OrdersContext lists.
 * After a successful API fetch (even empty), drop stale Mongo-like context ids
 * that are absent server-side — same rule as the pre-refactor OrderTrackingCard.
 */
export const mergeUniqueOrders = (
  apiOrders = [],
  contextOrders = [],
  { hasFetchedApi = false, invalidOrderIds = null } = {},
) => {
  const isMongoObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
  const serverKeys = new Set(
    apiOrders.map((o) => String(getOrderKey(o) || "")).filter(Boolean),
  );
  const seen = new Set();
  const invalid =
    invalidOrderIds instanceof Set
      ? invalidOrderIds
      : invalidOrderIds && typeof invalidOrderIds === "object"
        ? new Set(Object.keys(invalidOrderIds).filter((k) => invalidOrderIds[k]))
        : null;

  return [...apiOrders, ...contextOrders].filter((order) => {
    const key = getOrderKey(order);
    if (!key || seen.has(key)) return false;
    if (invalid?.has(key)) return false;
    if (
      hasFetchedApi &&
      isMongoObjectId(key) &&
      !serverKeys.has(String(key))
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

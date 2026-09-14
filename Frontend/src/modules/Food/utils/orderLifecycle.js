/**
 * Food order lifecycle — SINGLE SOURCE OF TRUTH (pure).
 *
 * Rules:
 * - No network, storage, React, or global client state access.
 * - Input: order-like object only.
 * - Unknown orderStatus → warn + stage "unknown" (never silently "preparing").
 *
 * Backend enums mirrored from:
 * Backend/src/modules/food/orders/models/order.model.js
 */

/** @typedef {'user'|'restaurant'|'delivery'|'admin'} LifecycleAudience */

/**
 * Canonical orderStatus values from FoodOrder schema enum.
 * If the backend enum changes, update this list and re-run regression.
 */
export const BACKEND_ORDER_STATUS_ENUM = Object.freeze([
  "placed",
  "created",
  "scheduled",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "delivered",
  "cancelled_by_user",
  "cancelled_by_restaurant",
  "cancelled_by_admin",
  "cancelled_by_system",
]);

/** dispatch.status enum from schema */
export const BACKEND_DISPATCH_STATUS_ENUM = Object.freeze([
  "unassigned",
  "assigned",
  "accepted",
  "rejected",
  "cancelled",
]);

/** deliveryState.currentPhase enum from schema */
export const BACKEND_DELIVERY_PHASE_ENUM = Object.freeze([
  "waiting_activation",
  "en_route_to_pickup",
  "at_pickup",
  "en_route_to_delivery",
  "at_drop",
  "delivered",
  "completed",
  "cancelled",
]);

/**
 * Client/legacy aliases seen in FE payloads but NOT in FoodOrder.orderStatus enum.
 * Mapped explicitly so they never fall through to preparing.
 */
export const CLIENT_STATUS_ALIASES = Object.freeze([
  "pending",
  "ready",
  "completed",
  "cancelled",
  "failed",
  "payment_failed",
  "expired",
  "out_for_delivery",
]);

/** Known deliveryState.status strings written by services (free-form field). */
export const KNOWN_DELIVERY_STATE_STATUS = Object.freeze([
  "waiting_activation",
  "reached_pickup",
  "picked_up",
  "reached_drop",
  "delivered",
  "cancelled",
]);

export const LIFECYCLE_STAGES = Object.freeze([
  "scheduled",
  "awaiting_restaurant",
  "restaurant_accepted",
  "preparing",
  "awaiting_rider",
  "rider_assigned",
  "heading_to_restaurant",
  "at_restaurant",
  "on_the_way",
  "arriving",
  "delivered",
  "cancelled",
  "unknown",
]);

const USER_COPY = Object.freeze({
  scheduled: {
    title: "Order Scheduled",
    subtitle: "Your order is scheduled",
    timelineLabel: "Scheduled",
  },
  awaiting_restaurant: {
    title: "Order Placed",
    subtitle: "Waiting for restaurant confirmation",
    timelineLabel: "Placed",
  },
  restaurant_accepted: {
    title: "Restaurant accepted",
    subtitle: "Restaurant accepted",
    timelineLabel: "Accepted",
  },
  preparing: {
    title: "Preparing your order",
    subtitle: "Preparing your order",
    timelineLabel: "Preparing",
  },
  awaiting_rider: {
    title: "Ready for pickup",
    subtitle: "Waiting for delivery partner",
    timelineLabel: "Ready for pickup",
  },
  rider_assigned: {
    title: "Delivery partner assigned",
    subtitle: "Delivery partner assigned",
    timelineLabel: "Partner assigned",
  },
  heading_to_restaurant: {
    title: "Heading to restaurant",
    subtitle: "Heading to restaurant",
    timelineLabel: "Partner en route to restaurant",
  },
  at_restaurant: {
    title: "At restaurant",
    subtitle: "Delivery partner reached restaurant",
    timelineLabel: "Reached restaurant",
  },
  on_the_way: {
    title: "On the way",
    subtitle: "On the way",
    timelineLabel: "On the way",
  },
  arriving: {
    title: "Arriving",
    subtitle: "Arriving",
    timelineLabel: "Arrived near you",
  },
  delivered: {
    title: "Delivered",
    subtitle: "Delivered",
    timelineLabel: "Delivered",
  },
  cancelled: {
    title: "Cancelled",
    subtitle: "Cancelled",
    timelineLabel: "Cancelled",
  },
  unknown: {
    title: "Order update",
    subtitle: "Order status updated",
    timelineLabel: "Updated",
  },
});

const QUICK_USER_OVERRIDES = Object.freeze({
  awaiting_restaurant: {
    title: "Order Placed",
    subtitle: "Waiting for store confirmation",
    timelineLabel: "Placed",
  },
  restaurant_accepted: {
    title: "Store accepted",
    subtitle: "Store accepted",
    timelineLabel: "Accepted",
  },
  preparing: {
    title: "Packing your items",
    subtitle: "Packing your items",
    timelineLabel: "Packing",
  },
  at_restaurant: {
    title: "At store",
    subtitle: "Delivery partner reached store",
    timelineLabel: "Reached store",
  },
});

/** Admin list/detail vocabulary (same stages, admin labels). */
const ADMIN_COPY = Object.freeze({
  scheduled: { title: "Scheduled", subtitle: "Scheduled", timelineLabel: "Scheduled" },
  awaiting_restaurant: { title: "Pending", subtitle: "Pending", timelineLabel: "Pending" },
  restaurant_accepted: { title: "Accepted", subtitle: "Accepted", timelineLabel: "Accepted" },
  preparing: { title: "Processing", subtitle: "Processing", timelineLabel: "Processing" },
  awaiting_rider: { title: "Processing", subtitle: "Ready for pickup", timelineLabel: "Processing" },
  rider_assigned: { title: "Processing", subtitle: "Partner assigned", timelineLabel: "Processing" },
  heading_to_restaurant: { title: "Processing", subtitle: "Heading to restaurant", timelineLabel: "Processing" },
  at_restaurant: { title: "Processing", subtitle: "At restaurant", timelineLabel: "Processing" },
  on_the_way: { title: "Food On The Way", subtitle: "Food On The Way", timelineLabel: "Food On The Way" },
  arriving: { title: "Food On The Way", subtitle: "Arriving", timelineLabel: "Food On The Way" },
  delivered: { title: "Delivered", subtitle: "Delivered", timelineLabel: "Delivered" },
  cancelled: { title: "Cancelled", subtitle: "Cancelled", timelineLabel: "Cancelled" },
  unknown: { title: "Unknown", subtitle: "Unknown", timelineLabel: "Unknown" },
});

/** Restaurant inbox / timeline short labels. */
const RESTAURANT_COPY = Object.freeze({
  scheduled: { title: "Scheduled", subtitle: "Scheduled order", timelineLabel: "Scheduled" },
  awaiting_restaurant: { title: "New order", subtitle: "Waiting for your confirmation", timelineLabel: "New" },
  restaurant_accepted: { title: "Accepted", subtitle: "Order accepted", timelineLabel: "Accepted" },
  preparing: { title: "Preparing", subtitle: "Order is preparing", timelineLabel: "Preparing" },
  awaiting_rider: { title: "Ready", subtitle: "Order is ready for pickup", timelineLabel: "Ready" },
  rider_assigned: { title: "Partner assigned", subtitle: "Delivery partner assigned", timelineLabel: "Assigned" },
  heading_to_restaurant: { title: "Partner en route", subtitle: "Partner heading to restaurant", timelineLabel: "En route" },
  at_restaurant: { title: "Partner arrived", subtitle: "Delivery partner reached restaurant", timelineLabel: "At restaurant" },
  on_the_way: { title: "Out for delivery", subtitle: "Order out for delivery", timelineLabel: "Out for delivery" },
  arriving: { title: "Near customer", subtitle: "Arriving at customer", timelineLabel: "Arriving" },
  delivered: { title: "Delivered", subtitle: "Order delivered", timelineLabel: "Delivered" },
  cancelled: { title: "Cancelled", subtitle: "Order cancelled", timelineLabel: "Cancelled" },
  unknown: { title: "Order update", subtitle: "Order update", timelineLabel: "Updated" },
});

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function isQuickOrder(order) {
  const type = lower(order?.orderType || order?.module);
  return type === "quick" || type === "mixed";
}

function hasBackendEta(order) {
  if (order?.etaPromise?.endsAt || order?.eta?.endsAt) return true;
  if (order?.etaPromise?.startsAt && (order?.etaPromise?.max || order?.etaPromise?.mid)) {
    return true;
  }
  const max =
    order?.etaPromise?.max ??
    order?.eta?.max ??
    order?.etaPromise?.mid ??
    order?.eta?.mid ??
    order?.estimatedDeliveryTime ??
    order?.estimatedTime ??
    order?.estimated_delivery_time;
  const n = Number(max);
  if (Number.isFinite(n) && n > 0) return true;
  const parsed = String(max || "").match(/(\d+)/);
  return Boolean(parsed && Number(parsed[1]) > 0);
}

function getOrderStatusRaw(order) {
  return lower(
    order?.orderStatus || order?.status || order?.deliveryState?.status || "",
  );
}

function getPhase(order) {
  return lower(order?.deliveryState?.currentPhase || "");
}

function getDeliveryStateStatus(order) {
  return lower(order?.deliveryState?.status || "");
}

function getDispatchStatus(order) {
  return lower(order?.dispatch?.status || "");
}

function isCancelLike(status) {
  if (!status) return false;
  if (
    status === "cancelled" ||
    status === "cancelled_by_user" ||
    status === "cancelled_by_restaurant" ||
    status === "cancelled_by_admin" ||
    status === "cancelled_by_system" ||
    status === "failed" ||
    status === "payment_failed" ||
    status === "expired"
  ) {
    return true;
  }
  return status.includes("cancel");
}

function warnUnknown(status, order) {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn("[orderLifecycle] Unknown orderStatus — not mapped to preparing:", {
      orderStatus: status,
      orderId: order?.orderId || order?._id || order?.id || null,
    });
  }
}

/**
 * Resolve canonical lifecycle stage from an order-like object.
 * Pure. Priority: terminal → delivery progress → dispatch → kitchen → placed.
 */
export function resolveLifecycleStage(order) {
  if (!order || typeof order !== "object") {
    // No order yet (e.g. OrderTrackingCard renders before the active-order store has
    // hydrated) is an expected, common state — not a data anomaly, so don't warn here.
    // warnUnknown() still fires below for a real order object with an unrecognized
    // status, which is the actual signal this warning exists to catch.
    return "unknown";
  }

  const status = getOrderStatusRaw(order);
  const phase = getPhase(order);
  const deliveryStatus = getDeliveryStateStatus(order);
  const dispatchStatus = getDispatchStatus(order);

  if (isCancelLike(status) || phase === "cancelled" || deliveryStatus === "cancelled") {
    return "cancelled";
  }

  if (
    status === "delivered" ||
    status === "completed" ||
    phase === "delivered" ||
    phase === "completed" ||
    deliveryStatus === "delivered"
  ) {
    return "delivered";
  }

  // Only explicit scheduled status — waiting_activation is also Instant idle default.
  if (status === "scheduled") {
    return "scheduled";
  }

  // Rider progress (phase / deliveryState.status) beats kitchen status —
  // but en_route_to_pickup alone is NOT authoritative (schema/default noise).
  if (
    status === "reached_drop" ||
    deliveryStatus === "reached_drop" ||
    phase === "at_drop"
  ) {
    return "arriving";
  }

  if (
    status === "picked_up" ||
    status === "out_for_delivery" ||
    deliveryStatus === "picked_up" ||
    phase === "en_route_to_delivery"
  ) {
    return "on_the_way";
  }

  if (
    status === "reached_pickup" ||
    deliveryStatus === "reached_pickup" ||
    phase === "at_pickup"
  ) {
    return "at_restaurant";
  }

  // Only real rider acceptance enters heading_to_restaurant.
  // Do NOT use phase === "en_route_to_pickup" here.
  if (dispatchStatus === "accepted") {
    return "heading_to_restaurant";
  }

  if (dispatchStatus === "assigned") {
    return "rider_assigned";
  }

  if (status === "ready_for_pickup" || status === "ready") {
    return "awaiting_rider";
  }

  if (status === "preparing") {
    return "preparing";
  }

  if (status === "confirmed") {
    return "restaurant_accepted";
  }

  if (status === "created" || status === "placed" || status === "pending") {
    return "awaiting_restaurant";
  }

  // Empty status with an in-flight phase already handled above.
  if (!status) {
    warnUnknown("(empty)", order);
    return "unknown";
  }

  // Known enums exhausted — never default to preparing.
  if (
    !BACKEND_ORDER_STATUS_ENUM.includes(status) &&
    !CLIENT_STATUS_ALIASES.includes(status)
  ) {
    warnUnknown(status, order);
    return "unknown";
  }

  // Alias that somehow slipped past (should be rare).
  warnUnknown(status, order);
  return "unknown";
}

function copyForStage(stage, order, audience = "user") {
  if (audience === "admin") {
    return { ...(ADMIN_COPY[stage] || ADMIN_COPY.unknown) };
  }
  if (audience === "restaurant") {
    return { ...(RESTAURANT_COPY[stage] || RESTAURANT_COPY.unknown) };
  }
  // delivery: reuse user copy for Phase 1 display labels
  const base = USER_COPY[stage] || USER_COPY.unknown;
  if (!isQuickOrder(order)) return { ...base };
  const override = QUICK_USER_OVERRIDES[stage];
  return override ? { ...base, ...override } : { ...base };
}

function computeShowEta(stage, order) {
  if (stage === "delivered" || stage === "cancelled" || stage === "scheduled") {
    return false;
  }
  if (stage === "unknown") return false;

  // Prefer real backend ETA; still show chrome for in-flight stages so banner
  // can use computeEtaMinutes soft fallback instead of a blank "STATUS" chip.
  if (hasBackendEta(order)) return true;

  return (
    stage === "awaiting_restaurant" ||
    stage === "restaurant_accepted" ||
    stage === "preparing" ||
    stage === "awaiting_rider" ||
    stage === "rider_assigned" ||
    stage === "heading_to_restaurant" ||
    stage === "at_restaurant" ||
    stage === "on_the_way" ||
    stage === "arriving"
  );
}

function computeHideBanner(stage) {
  return (
    stage === "delivered" ||
    stage === "cancelled" ||
    stage === "scheduled"
  );
}

/**
 * Pure lifecycle projection for UI surfaces.
 *
 * @param {object} order
 * @param {{ audience?: LifecycleAudience }} [options]
 * @returns {{
 *   stage: string,
 *   title: string,
 *   subtitle: string,
 *   timelineLabel: string,
 *   showETA: boolean,
 *   hideBanner: boolean,
 * }}
 */
export function resolveOrderLifecycle(order, options = {}) {
  const audience = options.audience || "user";
  const stage = resolveLifecycleStage(order);
  const copy = copyForStage(stage, order, audience);

  return {
    stage,
    title: copy.title,
    subtitle: copy.subtitle,
    timelineLabel: copy.timelineLabel,
    showETA: computeShowEta(stage, order),
    hideBanner: computeHideBanner(stage),
  };
}

/**
 * Assert every backend orderStatus enum is handled by the resolver
 * (no silent preparing fallback). Returns { ok, missing, samples }.
 */
export function verifyBackendEnumCoverage() {
  const missing = [];
  const samples = [];

  for (const status of BACKEND_ORDER_STATUS_ENUM) {
    const order = { orderStatus: status, dispatch: { status: "unassigned" } };
    const { stage, subtitle } = resolveOrderLifecycle(order);
    samples.push({ status, stage, subtitle });

    if (stage === "unknown") {
      missing.push(status);
      continue;
    }
    // created/placed must NEVER read as preparing copy
    if (
      (status === "created" || status === "placed") &&
      /preparing/i.test(subtitle)
    ) {
      missing.push(`${status}→preparing-copy`);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    samples,
    enumCount: BACKEND_ORDER_STATUS_ENUM.length,
  };
}

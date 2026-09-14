/**
 * Shared cancellation display labels for Food module UIs.
 * Distinguishes acceptance timeout from active restaurant reject.
 */

const TIMEOUT_REASON_RE =
  /restaurant not accept|did not respond|not accepted within|timed?\s*out|auto[- ]?reject/i;

const WATCHDOG_REASON_RE =
  /watchdog|stuck in transient|auto-recovery|auto recover/i;

const STUCK_REASON_FROM_STATUS = {
  placed: "Restaurant not accept",
  created: "Restaurant not accept",
  confirmed: "Order was not completed in time",
  preparing: "Order was not completed in time",
  ready_for_pickup: "Order was not picked up in time",
  ready: "Order was not picked up in time",
  picked_up: "Delivery was not completed in time",
};

function inferStatusBeforeCancellation(order = {}) {
  const history = order.statusHistory;
  if (!Array.isArray(history) || history.length === 0) return "";
  const cancelEntry = [...history]
    .reverse()
    .find((entry) => String(entry?.to || "").toLowerCase().includes("cancel"));
  return String(cancelEntry?.from || "").trim().toLowerCase();
}

/**
 * User-facing cancellation reason (never show internal watchdog copy).
 */
export function getCancellationDisplayReason(order = {}) {
  const raw = String(
    order.cancellationReason || order.reason || order.cancelReason || "",
  ).trim();
  if (!raw) return "";

  if (WATCHDOG_REASON_RE.test(raw)) {
    const fromStatus = inferStatusBeforeCancellation(order);
    if (fromStatus && STUCK_REASON_FROM_STATUS[fromStatus]) {
      return STUCK_REASON_FROM_STATUS[fromStatus];
    }
    return "Order expired due to inactivity";
  }

  return raw;
}

export function isRestaurantAcceptanceTimeout(order = {}) {
  const reason = String(
    getCancellationDisplayReason(order) ||
      order.cancellationReason ||
      order.reason ||
      order.cancelReason ||
      "",
  ).trim();
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  if (!status.includes("cancel")) return false;
  if (TIMEOUT_REASON_RE.test(reason)) return true;
  return Boolean(order.isAcceptanceTimeout);
}

/**
 * @returns {string} User-facing cancellation label
 */
export function getCancellationDisplayLabel(order = {}) {
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  const by = String(order.cancelledBy || "").toLowerCase();

  if (isRestaurantAcceptanceTimeout(order)) {
    return "Restaurant did not accept";
  }

  if (
    status === "cancelled_by_restaurant" ||
    by === "restaurant" ||
    status.includes("restaurant")
  ) {
    return "Cancelled by Restaurant";
  }

  if (status === "cancelled_by_admin" || by === "admin") {
    return "Cancelled by Admin";
  }

  if (
    status === "cancelled_by_user" ||
    by === "user" ||
    by === "customer"
  ) {
    return "Cancelled by Customer";
  }

  if (status === "cancelled_by_system" || by === "system") {
    const reason = getCancellationDisplayReason(order).toLowerCase();
    if (/not completed|not picked up|delivery was not|expired due to inactivity/.test(reason)) {
      return "Cancelled automatically";
    }
    return "Cancelled automatically";
  }

  if (status.includes("cancel")) {
    return "Cancelled";
  }

  return "";
}

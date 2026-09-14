/**
 * Flagged entry for UI consumers.
 * When SSOT flag is OFF → returns null (caller must use legacy maps).
 * When ON → pure resolveOrderLifecycle only (no duplicate status switches).
 */
import { isOrderLifecycleSsotEnabled } from "./orderLifecycle.flag";
import { resolveOrderLifecycle } from "./orderLifecycle";

/**
 * @param {object} order
 * @param {{ audience?: 'user'|'restaurant'|'delivery'|'admin' }} [options]
 * @returns {null | {
 *   stage: string,
 *   title: string,
 *   subtitle: string,
 *   timelineLabel: string,
 *   showETA: boolean,
 *   hideBanner: boolean,
 * }}
 */
export function getLifecycleDisplay(order, options = {}) {
  if (!isOrderLifecycleSsotEnabled()) return null;
  return resolveOrderLifecycle(order, options);
}

/**
 * Map lifecycle stage → OrderTracking page UI key (layout/icons only).
 * Copy still comes from getLifecycleDisplay / resolveOrderLifecycle.
 */
export const LIFECYCLE_STAGE_TO_TRACKING_UI = Object.freeze({
  scheduled: "scheduled",
  awaiting_restaurant: "placed",
  restaurant_accepted: "confirmed",
  preparing: "preparing",
  awaiting_rider: "ready",
  rider_assigned: "assigned",
  heading_to_restaurant: "assigned",
  at_restaurant: "at_pickup",
  on_the_way: "on_way",
  arriving: "at_drop",
  delivered: "delivered",
  cancelled: "cancelled",
  unknown: "placed",
});

export function lifecycleStageToTrackingUi(stage) {
  return LIFECYCLE_STAGE_TO_TRACKING_UI[stage] || "placed";
}

/**

 * Food Quick Delivery helpers (customer / restaurant / admin UI).

 * Distinct from Quick Commerce orderType:"quick".

 */



import { toast } from "sonner";



const QUICK_DELIVERY_TOAST_ID = "food-quick-delivery";



export function isFoodQuickOrder(order) {

  return String(order?.deliveryMode || "").toLowerCase() === "quick";

}



export function formatQuickEtaWindow(etaPromise) {

  if (!etaPromise) return "";

  const min = Number(etaPromise.min);

  const max = Number(etaPromise.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return "";

  return `${min}–${max} min`;

}



export function formatQuickCharge(amount) {

  const n = Number(amount);

  if (!Number.isFinite(n) || n <= 0) return "";

  return `₹${Math.round(n)}`;

}



/** Gates for showing Quick toggle (Global ∧ Restaurant ∧ Zone). */

export function areQuickGatesOpen(quickDeliveryMeta) {

  const g = quickDeliveryMeta?.gates;

  if (!g) return false;

  return g.globalEnabled === true && g.restaurantEnabled === true && g.zoneEnabled === true;

}



/**

 * Map backend Quick Delivery reason codes to user-facing copy.

 * Never expose raw codes (max_eta, zone_disabled, …) in the UI.

 */

const QUICK_DELIVERY_REASON_MESSAGES = {

  max_eta:

    "Quick Delivery is unavailable because the estimated delivery time exceeds the Quick limit.",

  max_distance:

    "This address is outside the Quick Delivery service area.",

  min_order_value:

    "Add a few more items to unlock Quick Delivery for this order.",

  global_disabled:

    "Quick Delivery is temporarily unavailable across the platform.",

  restaurant_disabled:

    "This restaurant has not enabled Quick Delivery.",

  zone_disabled:

    "Quick Delivery is not available in this delivery zone.",

  schedule_conflict:

    "Quick Delivery cannot be combined with a scheduled order.",

  not_eligible: "Quick Delivery is not available for this order.",

  "food quick delivery is only available for restaurant food orders":

    "Quick Delivery is only available for restaurant food orders.",

  "quick delivery cannot be combined with schedule order":

    "Quick Delivery cannot be combined with a scheduled order.",

};



export function mapQuickDeliveryReason(reason) {

  if (reason == null || reason === "") return "";

  const raw = String(reason).trim();

  if (!raw) return "";



  const code = raw.toLowerCase().replace(/\s+/g, "_");

  if (QUICK_DELIVERY_REASON_MESSAGES[code]) {

    return QUICK_DELIVERY_REASON_MESSAGES[code];

  }



  const proseKey = raw.toLowerCase();

  if (QUICK_DELIVERY_REASON_MESSAGES[proseKey]) {

    return QUICK_DELIVERY_REASON_MESSAGES[proseKey];

  }



  // Already human-readable sentences from the API.

  if (/\s/.test(raw) && !/^[a-z0-9_]+$/i.test(raw)) {

    return raw;

  }



  return "Quick Delivery is currently unavailable for this order.";

}



export function clearQuickDeliveryToast() {

  toast.dismiss(QUICK_DELIVERY_TOAST_ID);

}



export function showQuickDeliveryUnavailableToast(reason) {

  const message = mapQuickDeliveryReason(reason);

  if (!message) return;

  toast.message(message, {

    id: QUICK_DELIVERY_TOAST_ID,

    duration: 5000,

  });

}



/**

 * Soft-fallback to Basic is allowed only when this request asked for Quick

 * and the latest response says Quick is not eligible.

 * Do NOT use pricing.deliveryMode — basic quotes intentionally keep

 * deliveryMode="basic" while quickDelivery.eligible can still be true.

 */

export function shouldSoftFallbackQuickSelection({

  requestedDeliveryMode,

  pricing,

}) {

  if (String(requestedDeliveryMode || "").toLowerCase() !== "quick") {

    return false;

  }

  const meta = pricing?.quickDelivery;

  if (!meta || typeof meta !== "object") return false;

  return meta.eligible === false;

}



export function isQuickDeliveryEligible(pricing) {

  return pricing?.quickDelivery?.eligible === true;

}



export function getQuickDeliveryReason(pricing) {

  const reason = pricing?.quickDelivery?.reason;

  if (reason) return String(reason);

  const reasons = pricing?.quickDelivery?.reasons;

  if (Array.isArray(reasons) && reasons.length > 0) return String(reasons[0]);

  return "";

}



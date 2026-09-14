/**
 * Sequenced cart calculateOrder controller.
 * Guarantees only the latest request may update React pricing state.
 * Uses monotonic requestId + AbortController + payload fingerprint coalescing.
 */

import { orderAPI } from "@food/api";
import {
  clearQuickDeliveryToast,
  getQuickDeliveryReason,
  isQuickDeliveryEligible,
  mapQuickDeliveryReason,
  shouldSoftFallbackQuickSelection,
  showQuickDeliveryUnavailableToast,
} from "@food/utils/quickDelivery";

function stableFingerprint(payload = {}) {
  try {
    const items = Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          id: String(item?.menuItemId || item?.itemId || item?.id || item?._id || ""),
          qty: Number(item?.quantity) || 1,
          type: String(item?.type || item?.orderType || "food"),
          sourceId: String(item?.sourceId || item?.restaurantId || item?.storeId || ""),
          price: Number(item?.price) || 0,
          variantId: String(item?.variantId || item?.variationId || ""),
        }))
      : [];
    const address = payload.address || {};
    const coords = address?.location?.coordinates;
    return JSON.stringify({
      orderType: payload.orderType || "food",
      restaurantId: String(payload.restaurantId || ""),
      deliveryAddressId: String(payload.deliveryAddressId || ""),
      couponCode: String(payload.couponCode || "").toUpperCase(),
      deliveryMode: String(payload.deliveryMode || "basic").toLowerCase(),
      deliveryFleet: String(payload.deliveryFleet || ""),
      scheduledAt: payload.scheduledAt ? String(payload.scheduledAt) : "",
      addressCoords: Array.isArray(coords) ? coords.map(Number) : null,
      addressText: String(
        address.formattedAddress || address.address || address.street || "",
      ),
      items,
    });
  } catch {
    return `fallback:${Date.now()}:${Math.random()}`;
  }
}

export function createCartPricingRequestController() {
  let latestRequestId = 0;
  /** @type {AbortController | null} */
  let abortController = null;
  /** @type {string | null} */
  let inFlightFingerprint = null;
  /** @type {Promise<object> | null} */
  let inFlightPromise = null;
  /** @type {string | null} */
  let lastCompletedFingerprint = null;
  /** @type {object | null} */
  let lastCompletedResult = null;

  const begin = () => {
    latestRequestId += 1;
    const requestId = latestRequestId;
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        // ignore
      }
    }
    abortController = new AbortController();
    return { requestId, signal: abortController.signal };
  };

  const isLatest = (requestId) => requestId === latestRequestId;

  const isAbortError = (error) =>
    error?.name === "CanceledError" ||
    error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message === "canceled";

  /** Abort any in-flight calculate (effect cleanup / unmount). */
  const abort = () => {
    latestRequestId += 1;
    inFlightFingerprint = null;
    inFlightPromise = null;
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        // ignore
      }
      abortController = null;
    }
  };

  /**
   * @param {object} payload - calculateOrder body
   * @param {{ force?: boolean }} [options]
   */
  const calculate = async (payload = {}, options = {}) => {
    const force = options.force === true;
    const fingerprint = stableFingerprint(payload);
    const requestedDeliveryMode =
      String(payload.deliveryMode || "basic").toLowerCase() === "quick"
        ? "quick"
        : "basic";

    // Coalesce identical in-flight requests (StrictMode remount / cascading deps).
    if (
      !force &&
      inFlightFingerprint === fingerprint &&
      inFlightPromise
    ) {
      const shared = await inFlightPromise;
      return {
        ...shared,
        requestedDeliveryMode:
          shared.requestedDeliveryMode || requestedDeliveryMode,
        coalesced: true,
      };
    }

    // Skip network when the exact same quote just completed successfully.
    if (
      !force &&
      lastCompletedFingerprint === fingerprint &&
      lastCompletedResult?.pricing
    ) {
      return {
        ...lastCompletedResult,
        stale: false,
        requestedDeliveryMode,
        reused: true,
      };
    }

    const { requestId, signal } = begin();

    const run = (async () => {
      try {
        const response = await orderAPI.calculateOrder(payload, { signal });
        if (!isLatest(requestId)) {
          return {
            stale: true,
            requestId,
            requestedDeliveryMode,
            pricing: null,
            response: null,
            fingerprint,
          };
        }
        const pricing = response?.data?.data?.pricing || null;
        const result = {
          stale: false,
          requestId,
          requestedDeliveryMode,
          pricing,
          response,
          fingerprint,
        };
        lastCompletedFingerprint = fingerprint;
        lastCompletedResult = result;
        return result;
      } catch (error) {
        if (isAbortError(error) || !isLatest(requestId)) {
          return {
            stale: true,
            aborted: true,
            requestId,
            requestedDeliveryMode,
            pricing: null,
            response: null,
            error,
            fingerprint,
          };
        }
        throw error;
      } finally {
        if (inFlightFingerprint === fingerprint) {
          inFlightFingerprint = null;
          inFlightPromise = null;
        }
      }
    })();

    inFlightFingerprint = fingerprint;
    inFlightPromise = run;
    return run;
  };

  return { begin, isLatest, calculate, abort, stableFingerprint };
}

/**
 * Apply a non-stale calculateOrder result to cart Quick Delivery state.
 * Soft-fallback uses eligible === false only (never deliveryMode).
 */
export function applyCartPricingResult({
  result,
  setPricing,
  setDeliveryType,
  setQuickFallbackNotice,
  onSoftFallback,
}) {
  if (!result || result.stale) return { applied: false, softFallback: false };
  const { pricing, requestedDeliveryMode } = result;
  if (!pricing) return { applied: false, softFallback: false };

  const softFallback = shouldSoftFallbackQuickSelection({
    requestedDeliveryMode,
    pricing,
  });

  if (softFallback) {
    // Pricing already reflects Basic fees — skip the follow-up effect recalc.
    onSoftFallback?.();
    setDeliveryType?.("standard");
    const reason = getQuickDeliveryReason(pricing);
    const message =
      mapQuickDeliveryReason(reason) ||
      "Quick Delivery unavailable — continuing as Basic";
    setQuickFallbackNotice?.(message);
    showQuickDeliveryUnavailableToast(reason || message);
  } else if (
    requestedDeliveryMode === "quick" &&
    (isQuickDeliveryEligible(pricing) || !getQuickDeliveryReason(pricing))
  ) {
    // Latest Quick request confirmed available — drop any prior failure toast.
    clearQuickDeliveryToast();
    setQuickFallbackNotice?.(null);
  }
  // Basic quotes may include eligible=true (gate metadata). Do not clear
  // an active soft-fallback toast from those responses.

  setPricing?.(pricing);
  return { applied: true, softFallback };
}

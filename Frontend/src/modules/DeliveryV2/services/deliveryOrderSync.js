/**
 * Single global sync owner for Delivery Partner order HTTP traffic.
 * Socket remains primary; this module coordinates cold-start, recovery,
 * and sparse available-order polling. Backend APIs stay unchanged.
 *
 * Ownership:
 * - Active/current HTTP: coldStart, recovery (reconnect/manual/trip), refreshActiveTrip
 * - Available HTTP: available poller ONLY (recovery never fetches available)
 */
import { deliveryAPI } from '@food/api';

const AVAILABLE_POLL_MS_SOCKET_UP = 60_000;
const AVAILABLE_POLL_MS_SOCKET_DOWN = 45_000;
const RECOVER_DEBOUNCE_MS = 2_500;
const RECOVERY_TTL_MS = 15_000;

/**
 * Soft triggers — never run recovery (poller + sockets cover idle).
 * Focus / visibility / initial connect must not hit active/current.
 */
const SKIP_RECOVERY_REASONS = new Set([
  'focus',
  'visibility',
  'connect',
  'socket-or-focus',
]);

/** Reasons that bypass TTL when recovery is allowed to run. */
const FORCE_RECOVERY_REASONS = new Set([
  'reconnect',
  'socket-reconnect',
  'logout',
  'login',
  'accept',
  'cancel',
  'complete',
  'manual',
  'manual-refresh',
  'order-status',
  'active-trip-change',
  'auth',
  'coldStart',
]);

const policy = {
  isOnline: false,
  isFeedTab: false,
  hasActiveTrip: false,
  isVisible: typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  isSocketConnected: false,
  isAuthenticated: true,
};

const recoveryCache = {
  lastRecoveryAt: 0,
  lastActiveFetchAt: 0,
  lastAvailableFetchAt: 0,
};

/** Set on disconnect / logout / trip or order-status change so next recovery is allowed. */
let recoveryGateInvalidated = false;

let pollTimer = null;
let recoverTimer = null;
let recoverInFlight = null;
let activeTripInFlight = null;
let availableInFlight = null;
let coldStartPromise = null;
let coldStartDone = false;
let visibilityBound = false;

const availableListeners = new Set();
const activeTripListeners = new Set();

const canPollAvailable = () =>
  policy.isAuthenticated &&
  policy.isOnline &&
  policy.isFeedTab &&
  !policy.hasActiveTrip &&
  policy.isVisible;

const pollIntervalMs = () =>
  policy.isSocketConnected ? AVAILABLE_POLL_MS_SOCKET_UP : AVAILABLE_POLL_MS_SOCKET_DOWN;

function notifyAvailable(payload) {
  availableListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.warn('[deliveryOrderSync] available listener error:', err);
    }
  });
}

function notifyActiveTrip(payload) {
  activeTripListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.warn('[deliveryOrderSync] activeTrip listener error:', err);
    }
  });
}

function stopAvailablePoller() {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function isAvailablePollerRunning() {
  return pollTimer != null;
}

async function runAvailablePollTick() {
  if (!canPollAvailable()) return;
  try {
    const payload = await fetchAvailableOffers();
    recoveryCache.lastAvailableFetchAt = Date.now();
    notifyAvailable({ ...payload, source: 'poll' });
  } catch (err) {
    console.warn('[deliveryOrderSync] available poll failed:', err?.message || err);
  }
}

/**
 * Start the available poller only when it is not already running.
 * @param {{ immediate?: boolean }} opts
 */
function restartAvailablePoller({ immediate = true } = {}) {
  if (isAvailablePollerRunning()) return;
  if (!canPollAvailable()) return;

  if (immediate) {
    void runAvailablePollTick();
  }
  pollTimer = setInterval(() => {
    if (!canPollAvailable()) {
      stopAvailablePoller();
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) return;
    void runAvailablePollTick();
  }, pollIntervalMs());
}

/** Ensure poller owns available fetches after recovery leaves the partner idle. */
function ensureAvailablePollerAfterRecovery() {
  if (!canPollAvailable()) return;
  if (isAvailablePollerRunning()) return;
  restartAvailablePoller({ immediate: true });
}

function ensureVisibilityBinding() {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState !== 'hidden';
    // Policy only — do NOT requestRecovery on visibility (poller resumes via updateSyncPolicy).
    updateSyncPolicy({ isVisible: visible });
  });
}

/** Call after disconnect, logout, active-trip change, or order status change. */
export function invalidateRecoveryCache(_reason = 'invalidate') {
  recoveryGateInvalidated = true;
}

/** GET food current (deduped). Not used on available poll ticks. */
export async function fetchActiveTripBundle({ bustCache = false } = {}) {
  if (activeTripInFlight) return activeTripInFlight;

  activeTripInFlight = (async () => {
    try {
      const currentResponse = await deliveryAPI.getCurrentDelivery().catch(() => null);

      recoveryCache.lastActiveFetchAt = Date.now();

      const rawData =
        currentResponse?.data?.data?.activeOrder ||
        currentResponse?.data?.data ||
        null;
      const foodCurrent =
        rawData && (rawData._id || rawData.orderId) ? rawData : null;

      return {
        foodCurrent,
      };
    } finally {
      activeTripInFlight = null;
    }
  })();

  return activeTripInFlight;
}

/** GET food available (deduped). Owned by the poller. */
export async function fetchAvailableOffers() {
  if (availableInFlight) return availableInFlight;

  availableInFlight = (async () => {
    try {
      const availableResponse = await deliveryAPI.getOrders({ limit: 20, page: 1 }).catch(() => null);

      recoveryCache.lastAvailableFetchAt = Date.now();

      const availablePayload =
        availableResponse?.data?.data ||
        availableResponse?.data ||
        {};
      const foodOrders = Array.isArray(availablePayload?.docs)
        ? availablePayload.docs
        : Array.isArray(availablePayload?.items)
          ? availablePayload.items
          : Array.isArray(availablePayload)
            ? availablePayload
            : [];

      return { foodOrders };
    } finally {
      availableInFlight = null;
    }
  })();

  return availableInFlight;
}

function shouldForceRecovery(reason, options = {}) {
  if (options.force) return true;
  if (recoveryGateInvalidated) return true;
  if (FORCE_RECOVERY_REASONS.has(String(reason || ''))) return true;
  return false;
}

/**
 * Active-trip recovery only (no available fetch — poller owns that).
 * Skips focus/visibility/initial-connect. Debounced + single-flight + TTL.
 */
export function requestRecovery(reason = 'recover', options = {}) {
  ensureVisibilityBinding();

  const reasonKey = String(reason || '');

  // Soft triggers never run recovery (even if gate invalidated).
  if (SKIP_RECOVERY_REASONS.has(reasonKey) && !options.force) {
    return Promise.resolve({ type: 'skipped', reason: 'soft-trigger', skippedReason: reasonKey });
  }

  const force = shouldForceRecovery(reasonKey, options);
  const now = Date.now();
  if (
    !force &&
    recoveryCache.lastRecoveryAt > 0 &&
    now - recoveryCache.lastRecoveryAt < RECOVERY_TTL_MS
  ) {
    return Promise.resolve({ type: 'skipped', reason: 'ttl', skippedReason: reasonKey });
  }

  if (recoverTimer) clearTimeout(recoverTimer);

  return new Promise((resolve) => {
    recoverTimer = setTimeout(async () => {
      recoverTimer = null;

      const forceNow = shouldForceRecovery(reasonKey, options);
      const t = Date.now();
      if (
        !forceNow &&
        recoveryCache.lastRecoveryAt > 0 &&
        t - recoveryCache.lastRecoveryAt < RECOVERY_TTL_MS
      ) {
        resolve({ type: 'skipped', reason: 'ttl', skippedReason: reasonKey });
        return;
      }

      if (recoverInFlight) {
        resolve(await recoverInFlight);
        return;
      }

      recoverInFlight = (async () => {
        try {
          const active = await fetchActiveTripBundle();
          recoveryCache.lastRecoveryAt = Date.now();
          recoveryGateInvalidated = false;

          if (active.foodCurrent) {
            const payload = { type: 'active', reason: reasonKey, ...active };
            notifyActiveTrip(payload);
            stopAvailablePoller();
            return payload;
          }

          const payload = {
            type: 'idle',
            reason: reasonKey,
            foodCurrent: null,
          };
          notifyActiveTrip(payload);
          // Available offers: poller only — never fetch here alongside recovery.
          ensureAvailablePollerAfterRecovery();
          return payload;
        } catch (err) {
          console.warn('[deliveryOrderSync] recovery failed:', err?.message || err);
          return { type: 'error', reason: reasonKey, error: err };
        } finally {
          recoverInFlight = null;
        }
      })();

      resolve(await recoverInFlight);
    }, RECOVER_DEBOUNCE_MS);
  });
}

/** Cold start / crash restore — once per session (StrictMode-safe). Active trip only. */
export function requestColdStart() {
  ensureVisibilityBinding();
  if (coldStartDone && !activeTripInFlight) {
    return Promise.resolve({ type: 'skipped' });
  }
  if (coldStartPromise) return coldStartPromise;

  coldStartPromise = (async () => {
    try {
      const active = await fetchActiveTripBundle();
      coldStartDone = true;
      recoveryCache.lastRecoveryAt = Date.now();
      recoveryGateInvalidated = false;
      const payload = {
        type: active.foodCurrent ? 'active' : 'idle',
        reason: 'coldStart',
        ...active,
      };
      notifyActiveTrip(payload);
      if (!active.foodCurrent) {
        ensureAvailablePollerAfterRecovery();
      }
      return payload;
    } finally {
      coldStartPromise = null;
    }
  })();

  return coldStartPromise;
}

/** After accept / complete / cancel / manual refresh — active trip only. */
export async function refreshActiveTrip(reason = 'manual') {
  invalidateRecoveryCache(reason);
  const bustCache = reason === 'cancel' || reason === 'complete';
  const active = await fetchActiveTripBundle({ bustCache });
  recoveryCache.lastRecoveryAt = Date.now();
  recoveryGateInvalidated = false;
  const payload = {
    type: active.foodCurrent ? 'active' : 'idle',
    reason,
    ...active,
  };
  notifyActiveTrip(payload);
  if (!active.foodCurrent) {
    ensureAvailablePollerAfterRecovery();
  } else {
    stopAvailablePoller();
  }
  return payload;
}

export function updateSyncPolicy(partial = {}) {
  ensureVisibilityBinding();
  const prev = { ...policy };
  Object.assign(policy, partial);

  if (prev.hasActiveTrip !== policy.hasActiveTrip) {
    invalidateRecoveryCache('active-trip-change');
  }

  const canPoll = canPollAvailable();
  if (!canPoll) {
    stopAvailablePoller();
    return;
  }

  const wentOnline = !prev.isOnline && policy.isOnline;
  const tripEnded = prev.hasActiveTrip && !policy.hasActiveTrip;
  const enteredFeed = !prev.isFeedTab && policy.isFeedTab;
  const becameVisible = !prev.isVisible && policy.isVisible;
  const pollerWasStopped = !isAvailablePollerRunning();

  // Restart only when online→true, active trip ends, enter Feed, became visible, or poller was stopped.
  // Never restart solely because socket connected/disconnected while poller runs.
  if (wentOnline || tripEnded || enteredFeed || becameVisible || pollerWasStopped) {
    const fromSocketOnly =
      pollerWasStopped &&
      !wentOnline &&
      !tripEnded &&
      !enteredFeed &&
      !becameVisible &&
      prev.isSocketConnected !== policy.isSocketConnected;

    restartAvailablePoller({
      immediate: !fromSocketOnly,
    });
  }
}

export function subscribeAvailableOffers(listener) {
  availableListeners.add(listener);
  return () => availableListeners.delete(listener);
}

export function subscribeActiveTrip(listener) {
  activeTripListeners.add(listener);
  return () => activeTripListeners.delete(listener);
}

/**
 * Apply slim active-trip payload from socket resync (`active_order`).
 * Avoids an immediate HTTP current-trip round-trip when reconnect restores state.
 */
export function applySocketActiveOrder(order, reason = 'socket-resync') {
  if (!order) {
    notifyActiveTrip({ type: 'idle', reason, foodCurrent: null });
    return;
  }
  stopAvailablePoller();
  notifyActiveTrip({
    type: 'active',
    reason,
    foodCurrent: order,
    source: 'socket',
  });
}

export function stopAllSync() {
  stopAvailablePoller();
  if (recoverTimer) {
    clearTimeout(recoverTimer);
    recoverTimer = null;
  }
  coldStartDone = false;
  recoveryCache.lastRecoveryAt = 0;
  recoveryCache.lastActiveFetchAt = 0;
  recoveryCache.lastAvailableFetchAt = 0;
  invalidateRecoveryCache('logout');
  updateSyncPolicy({
    isOnline: false,
    isFeedTab: false,
    hasActiveTrip: false,
    isAuthenticated: false,
  });
}

export function getSyncPolicy() {
  return { ...policy };
}

export function getRecoveryCache() {
  return { ...recoveryCache, recoveryGateInvalidated };
}

const deliveryOrderSync = {
  updateSyncPolicy,
  requestColdStart,
  requestRecovery,
  refreshActiveTrip,
  fetchActiveTripBundle,
  fetchAvailableOffers,
  subscribeAvailableOffers,
  subscribeActiveTrip,
  applySocketActiveOrder,
  stopAllSync,
  invalidateRecoveryCache,
  getSyncPolicy,
  getRecoveryCache,
};

export default deliveryOrderSync;

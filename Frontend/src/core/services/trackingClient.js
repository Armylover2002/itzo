import { onValue, ref } from "firebase/database";
import { getRealtimeDb } from "../firebase/client";

/**
 * Live rider position: prefers the freshest/most precise snapshot from
 * `deliveryLocations/{orderId}/{deliveryBoyId}` (v2), falls back to
 * `orders/{orderId}/rider`.
 */
export const subscribeToOrderLocation = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; location subscription is disabled.",
    );
    return () => {};
  }

  console.log(`[tracking] Subscribing to location for order ${orderId}`);
  console.log(`[tracking] Path 1: /deliveryLocations/${orderId}`);
  console.log(`[tracking] Path 2: /orders/${orderId}/rider`);

  const state = { best: null };

  const parseTime = (value) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const normalizeLocation = (raw, source) => {
    if (!raw || typeof raw !== "object") return null;

    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const accuracy = Number(raw.accuracy);
    const heading = Number(raw.heading);
    const speed = Number(raw.speed);

    return {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      heading: Number.isFinite(heading) ? heading : null,
      speed: Number.isFinite(speed) ? speed : null,
      lastUpdatedAt:
        raw.lastUpdatedAt ||
        raw.timestamp ||
        raw.updatedAt ||
        new Date().toISOString(),
      source,
    };
  };

  const scoreLocation = (loc) => {
    const freshness = parseTime(loc?.lastUpdatedAt);
    const precision = Number.isFinite(loc?.accuracy)
      ? Math.max(0, 1000 - loc.accuracy)
      : 0;
    return freshness * 1000 + precision;
  };

  const publishIfBetter = (candidate) => {
    if (!candidate) return;
    if (!state.best || scoreLocation(candidate) > scoreLocation(state.best)) {
      state.best = candidate;
      handler(candidate);
    }
  };

  const r1 = ref(db, `/deliveryLocations/${orderId}`);
  const off1 = onValue(r1, (snap) => {
    const val = snap.val();
    console.log(`[tracking] deliveryLocations snapshot for ${orderId}:`, val);
    if (!val || typeof val !== "object") {
      console.log(`[tracking] No valid data at /deliveryLocations/${orderId}`);
      return;
    }

    let bestCandidate = null;
    for (const k of Object.keys(val)) {
      const candidate = normalizeLocation(val[k], "deliveryLocations");
      console.log(`[tracking] Checking delivery location key ${k}:`, candidate);
      if (!candidate) continue;
      if (!bestCandidate || scoreLocation(candidate) > scoreLocation(bestCandidate)) {
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      console.log(`[tracking] ✓ Best delivery location selected:`, bestCandidate);
      publishIfBetter(bestCandidate);
      return;
    }

    console.log(`[tracking] No valid location coordinates found in deliveryLocations`);
  });

  const r2 = ref(db, `/orders/${orderId}/rider`);
  const off2 = onValue(r2, (snap) => {
    const val = snap.val();
    console.log(`[tracking] orders/rider snapshot for ${orderId}:`, val);
    const candidate = normalizeLocation(val, "orders/rider");
    if (candidate) {
      console.log(`[tracking] ✓ Location from orders/rider:`, candidate);
      publishIfBetter(candidate);
    } else {
      console.log(`[tracking] No data at /orders/${orderId}/rider`);
    }
  });

  return () => {
    console.log(`[tracking] Unsubscribing from location for order ${orderId}`);
    off1();
    off2();
  };
};

export const subscribeToOrderTrail = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; trail subscription is disabled.",
    );
    return () => {};
  }

  const r = ref(db, `/orders/${orderId}/trail`);
  const off = onValue(r, (snap) => {
    const raw = snap.val() || {};
    const points = Object.values(raw);
    handler(points);
  });

  return () => off();
};

export const subscribeToOrderRoute = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; route subscription is disabled.",
    );
    return () => {};
  }

  console.log(
    `[tracking] Subscribing to route for order ${orderId} at path /orders/${orderId}/route`,
  );
  const r = ref(db, `/orders/${orderId}/route`);
  const off = onValue(r, (snap) => {
    const routeData = snap.val();
    if (routeData && routeData.polyline) {
      console.log(`[tracking] ✓ Route data received for order ${orderId}:`, {
        polylineLength: routeData.polyline?.length,
        distance: routeData.distance,
        duration: routeData.duration,
        cachedAt: routeData.cachedAt,
      });
      handler(routeData);
    } else {
      console.log(`[tracking] No route data available for order ${orderId}`);
    }
  });

  return () => {
    console.log(`[tracking] Unsubscribing from route for order ${orderId}`);
    off();
  };
};

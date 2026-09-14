import {
  coordsKey,
  DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
  DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
  hasMovedSignificantly,
  toMapCoords,
} from './mapGeocode';

/**
 * Attach debounced reverse-geocode behavior to a Google Map instance.
 * Fires only after the map becomes idle and the center has moved meaningfully.
 * Cancels stale in-flight requests when a newer interaction occurs.
 */
export function attachDebouncedMapGeocode(map, options = {}) {
  const {
    onGeocode,
    onCenterChange,
    onInteractingChange,
    debounceMs = DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
    minDistanceM = DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
    skipRef = null,
    requireUserInteraction = false,
  } = options;

  let debounceTimer = null;
  let abortController = null;
  let lastGeocoded = null;
  let pendingCoordsKey = null;
  let userInteracted = false;
  const listeners = [];

  const isSkipped = () => Boolean(skipRef?.current);

  const cancelPending = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingCoordsKey = null;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const getCenterCoords = () => {
    const center = map?.getCenter?.();
    if (!center) return null;
    return toMapCoords(center.lat(), center.lng());
  };

  const shouldProcessCoords = (coords, force = false) => {
    if (!coords) return false;
    if (force) return true;
    if (lastGeocoded && !hasMovedSignificantly(lastGeocoded, coords, minDistanceM)) return false;
    return true;
  };

  const runGeocode = async (coords, { force = false } = {}) => {
    if (!coords || !onGeocode) return false;
    if (!shouldProcessCoords(coords, force)) return false;

    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    const controller = new AbortController();
    abortController = controller;

    try {
      await onGeocode(coords.lat, coords.lng, { signal: controller.signal, coords });
      if (!controller.signal.aborted) {
        lastGeocoded = coords;
      }
      return true;
    } catch (error) {
      if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return false;
      throw error;
    } finally {
      pendingCoordsKey = null;
      if (abortController === controller) {
        abortController = null;
      }
    }
  };

  const scheduleGeocode = () => {
    if (isSkipped()) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (isSkipped()) return;

      const coords = getCenterCoords();
      if (!coords) return;

      if (requireUserInteraction) {
        if (!userInteracted) return;
        userInteracted = false;
      }

      if (!shouldProcessCoords(coords)) return;

      const nextKey = coordsKey(coords);
      if (pendingCoordsKey === nextKey) return;
      pendingCoordsKey = nextKey;

      onCenterChange?.(coords.lat, coords.lng);
      runGeocode(coords);
    }, debounceMs);
  };

  listeners.push(
    map.addListener('dragstart', () => {
      userInteracted = true;
      onInteractingChange?.(true);
      cancelPending();
    }),
  );

  listeners.push(
    map.addListener('zoom_changed', () => {
      cancelPending();
    }),
  );

  listeners.push(
    map.addListener('idle', () => {
      onInteractingChange?.(false);
      if (isSkipped()) return;
      scheduleGeocode();
    }),
  );

  return {
    cancelPending,
    forceGeocode: (lat, lng) => {
      const coords = toMapCoords(lat, lng);
      onCenterChange?.(coords.lat, coords.lng);
      return runGeocode(coords, { force: true });
    },
    setLastGeocoded: (coords) => {
      if (!coords) {
        lastGeocoded = null;
        pendingCoordsKey = null;
        return;
      }
      lastGeocoded = toMapCoords(coords.lat, coords.lng);
      pendingCoordsKey = coordsKey(lastGeocoded);
    },
    getLastGeocoded: () => lastGeocoded,
    detach: () => {
      cancelPending();
      listeners.forEach((listener) => {
        window.google?.maps?.event?.removeListener(listener);
      });
      listeners.length = 0;
    },
  };
}

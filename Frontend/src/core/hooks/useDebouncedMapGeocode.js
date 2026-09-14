import { useCallback, useEffect, useRef } from 'react';
import { attachDebouncedMapGeocode } from '@core/utils/debouncedMapGeocode';

/**
 * React hook wrapper around attachDebouncedMapGeocode.
 * Keeps callbacks fresh without rebinding listeners on every render.
 */
export function useDebouncedMapGeocode(options = {}) {
  const controllerRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const detachMap = useCallback(() => {
    controllerRef.current?.detach();
    controllerRef.current = null;
  }, []);

  const bindMap = useCallback((map) => {
    detachMap();
    if (!map) return null;

    const {
      debounceMs,
      minDistanceM,
      skipRef,
      requireUserInteraction = false,
    } = optionsRef.current;

    controllerRef.current = attachDebouncedMapGeocode(map, {
      debounceMs,
      minDistanceM,
      skipRef,
      requireUserInteraction,
      onGeocode: (...args) => optionsRef.current.onGeocode?.(...args),
      onCenterChange: (...args) => optionsRef.current.onCenterChange?.(...args),
      onInteractingChange: (...args) => optionsRef.current.onInteractingChange?.(...args),
    });

    return controllerRef.current;
  }, [detachMap]);

  useEffect(() => () => detachMap(), [detachMap]);

  return {
    bindMap,
    detachMap,
    cancelPending: () => controllerRef.current?.cancelPending(),
    forceGeocode: (...args) => controllerRef.current?.forceGeocode(...args),
    setLastGeocoded: (...args) => controllerRef.current?.setLastGeocoded(...args),
    getLastGeocoded: () => controllerRef.current?.getLastGeocoded() ?? null,
  };
}

export default useDebouncedMapGeocode;

import { useMemo } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { calculateDistance } from '@/modules/DeliveryV2/hooks/proximity.utils';
import {
  normalizeLocationPoint,
  getPrimaryPickupLocation,
  getReturnDropLocation,
  isReturnPickupTrip,
} from '@/modules/DeliveryV2/utils/orderRouting';

const NEAR_M = 300;

function resolveCustomerPoint(order) {
  if (!order) return null;
  const deliveryAddress = order.deliveryAddress || {};
  return (
    normalizeLocationPoint(order.customerLocation) ||
    normalizeLocationPoint(order.dropLocation) ||
    normalizeLocationPoint(order.delivery) ||
    normalizeLocationPoint(order.customer_location) ||
    normalizeLocationPoint(deliveryAddress?.location) ||
    null
  );
}

/**
 * useProximityCheck - Professional hook for dynamic range monitoring.
 * Ensures rider can only advance based on Admin-defined ranges.
 *
 * @returns {Object} { distanceToTarget, isWithinRange, actionLimit }
 */
export const useProximityCheck = () => {
  const riderLocation = useDeliveryStore((state) => state.riderLocation);
  const activeOrder = useDeliveryStore((state) => state.activeOrder);
  const tripStatus = useDeliveryStore((state) => state.tripStatus);
  const settings = useDeliveryStore((state) => state.settings);

  // Determine current target based on trip state
  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;

    if (['PICKING_UP', 'REACHED_PICKUP'].includes(tripStatus)) {
      return (
        normalizeLocationPoint(activeOrder.restaurantLocation) ||
        normalizeLocationPoint(activeOrder.pickupLocation) ||
        normalizeLocationPoint(activeOrder.pickup) ||
        getPrimaryPickupLocation(activeOrder) ||
        normalizeLocationPoint(activeOrder.restaurant_location)
      );
    }

    if (['PICKED_UP', 'REACHED_DROP'].includes(tripStatus)) {
      if (isReturnPickupTrip(activeOrder)) {
        return getReturnDropLocation(activeOrder) || normalizeLocationPoint(activeOrder.dropPoint);
      }
      return resolveCustomerPoint(activeOrder);
    }

    return null;
  }, [activeOrder, tripStatus]);

  // Determine current range limit from admin settings
  const actionLimit = useMemo(() => {
    if (tripStatus === 'PICKING_UP') return settings.pickupRangeLimit || 500;
    if (tripStatus === 'PICKED_UP') return settings.deliveryRangeLimit || 500;
    return 500;
  }, [tripStatus, settings]);

  // Calculate real-time distance (meters)
  const distanceToTarget = useMemo(() => {
    const rider = normalizeLocationPoint(riderLocation);
    if (!rider || !targetLocation) return Infinity;

    const liveM = calculateDistance(
      rider.lat,
      rider.lng,
      targetLocation.lat,
      targetLocation.lng,
    );

    // Going to restaurant: if rider is already at customer drop, show
    // restaurant→customer road distance so PICKUP matches DROP (~6.6 km).
    if (['PICKING_UP', 'REACHED_PICKUP'].includes(tripStatus) && activeOrder) {
      const customer = resolveCustomerPoint(activeOrder);
      if (customer) {
        const toCustomerM = calculateDistance(
          rider.lat,
          rider.lng,
          customer.lat,
          customer.lng,
        );
        if (Number.isFinite(toCustomerM) && toCustomerM <= NEAR_M) {
          const dropKm = Number(
            activeOrder.deliveryDistanceKm ??
              activeOrder.pricing?.deliveryDistanceKm ??
              activeOrder.distanceKm,
          );
          if (Number.isFinite(dropKm) && dropKm >= 0) {
            return dropKm * 1000;
          }
          // Fallback: straight-line customer → restaurant
          const customerToRestM = calculateDistance(
            customer.lat,
            customer.lng,
            targetLocation.lat,
            targetLocation.lng,
          );
          if (Number.isFinite(customerToRestM) && customerToRestM !== Infinity) {
            return customerToRestM;
          }
        }
      }

      // Already at restaurant — snap GPS noise to ~0 for UI.
      if (Number.isFinite(liveM) && liveM <= NEAR_M) {
        return liveM;
      }
    }

    return liveM;
  }, [riderLocation, targetLocation, tripStatus, activeOrder]);

  // Dev mode bypass
  const isDevMode = import.meta.env.VITE_APP_MODE === 'developer' ||
                    import.meta.env.VITE_ENABLE_RANGE_BYPASS === 'true' ||
                    import.meta.env.DEV;

  const isWithinRange = isDevMode ? true : (distanceToTarget <= actionLimit);

  const displayDistanceToTarget = distanceToTarget;

  return {
    distanceToTarget,
    displayDistanceToTarget,
    isWithinRange,
    actionLimit,
  };
};

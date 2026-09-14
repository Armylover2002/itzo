import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { getHaversineDistance } from '@/modules/DeliveryV2/utils/geo';
import { normalizePickupPoints, normalizeLocationPoint, isMixedOrder, isReturnPickupTrip, getReturnPickupStopLabels, formatDeliveryAddressText } from '@/modules/DeliveryV2/utils/orderRouting';
import { RenderNewOrder } from './renderers/NewOrderRenderers';

/**
 * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
 * Matches the Zomato/Swiggy style Green Header + White Card.
 */
export const NewOrderModal = ({ order, onAccept, onReject, onMinimize }) => {
  const { riderLocation, setRiderLocation } = useDeliveryStore();
  const isFoodQuick =
    order?.isFoodQuickDelivery === true ||
    String(order?.deliveryMode || '').toLowerCase() === 'quick';
  const offerWindowSec = Math.max(
    15,
    Number(order?.offerTimeoutSec || (isFoodQuick ? 45 : 30)) || (isFoodQuick ? 45 : 30),
  );
  const [timeLeft, setTimeLeft] = useState(offerWindowSec);
  const pickupPoints = normalizePickupPoints(order);
  const primaryPickup = pickupPoints[0] || null;
  const mixedOrder = isMixedOrder(order);

  useEffect(() => {
    setTimeLeft(offerWindowSec);
  }, [order?.orderMongoId, order?.orderId, offerWindowSec]);

  // Refresh high-accuracy GPS when offer opens so PICKUP uses live rider position.
  useEffect(() => {
    if (!order || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setRiderLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading || 0,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
    return () => {
      cancelled = true;
    };
  }, [order?.orderMongoId, order?.orderId, setRiderLocation]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [order?.orderMongoId, order?.orderId]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onReject();
    }
  }, [timeLeft, onReject]);

  const { distanceKm, etaMins } = useMemo(() => {
    if (!order) return { distanceKm: null, etaMins: null };

    const rawEta = order.estimatedTime || order.duration || order.eta || order.route?.durationMin;
    const formatKm = (km) => Number(km).toFixed(1);
    const etaFromKm = (km) =>
      rawEta && Number(rawEta) > 0
        ? Math.ceil(Number(rawEta))
        : Math.ceil((Number(km) * 1000) / 416) + (order.prepTime || 5);

    const NEAR_M = 300; // treat as "at this stop"

    // Restaurant / pickup — prefer payload latitude/longitude (same source as pricing origin).
    const restaurantPoint =
      normalizeLocationPoint(order.restaurantLocation) ||
      normalizeLocationPoint(primaryPickup?.location) ||
      normalizeLocationPoint(order.pickupLocation) ||
      normalizeLocationPoint(order.pickup) ||
      normalizeLocationPoint(order.dispatchLeg?.location) ||
      normalizeLocationPoint(order.restaurantId?.location) ||
      null;

    const resLat = Number(
      order.restaurant_lat ?? order.restaurantLat ?? restaurantPoint?.lat,
    );
    const resLng = Number(
      order.restaurant_lng ?? order.restaurantLng ?? restaurantPoint?.lng,
    );
    const hasRestaurant =
      Number.isFinite(resLat) && Number.isFinite(resLng);

    // Customer drop (for "rider is with customer" case).
    const deliveryAddress = order.deliveryAddress || {};
    const customerPoint =
      normalizeLocationPoint(order.customerLocation) ||
      normalizeLocationPoint(order.deliveryLocation) ||
      normalizeLocationPoint(deliveryAddress?.location) ||
      (Array.isArray(deliveryAddress?.location?.coordinates) &&
      deliveryAddress.location.coordinates.length >= 2
        ? {
            lng: Number(deliveryAddress.location.coordinates[0]),
            lat: Number(deliveryAddress.location.coordinates[1]),
          }
        : null);

    const dropKmRaw = Number(
      order.deliveryDistanceKm ?? order.pricing?.deliveryDistanceKm,
    );
    const hasDropKm = Number.isFinite(dropKmRaw) && dropKmRaw >= 0;

    const riderLat = Number(riderLocation?.lat);
    const riderLng = Number(riderLocation?.lng);
    const hasRider = Number.isFinite(riderLat) && Number.isFinite(riderLng);

    // PICKUP must be rider → restaurant only.
    // Never use order.distanceKm as a blind fallback (that is restaurant→customer).
    if (hasRider) {
      // Rider already at customer drop → pickup distance ≈ restaurant→customer (same as DROP).
      if (
        customerPoint &&
        Number.isFinite(Number(customerPoint.lat)) &&
        Number.isFinite(Number(customerPoint.lng))
      ) {
        const toCustomerM = getHaversineDistance(
          riderLat,
          riderLng,
          Number(customerPoint.lat),
          Number(customerPoint.lng),
        );
        if (Number.isFinite(toCustomerM) && toCustomerM <= NEAR_M) {
          if (hasDropKm) {
            return { distanceKm: formatKm(dropKmRaw), etaMins: etaFromKm(dropKmRaw) };
          }
          if (hasRestaurant) {
            const toRestFromCustomerM = getHaversineDistance(
              Number(customerPoint.lat),
              Number(customerPoint.lng),
              resLat,
              resLng,
            );
            if (Number.isFinite(toRestFromCustomerM) && toRestFromCustomerM >= 0) {
              const km = toRestFromCustomerM / 1000;
              return { distanceKm: formatKm(km), etaMins: etaFromKm(km) };
            }
          }
        }
      }

      // Rider → restaurant (live GPS).
      if (hasRestaurant) {
        const toRestM = getHaversineDistance(riderLat, riderLng, resLat, resLng);
        if (Number.isFinite(toRestM) && toRestM >= 0) {
          // Snap tiny GPS noise to 0 when already at restaurant.
          const km = toRestM <= NEAR_M ? 0 : toRestM / 1000;
          return { distanceKm: formatKm(km), etaMins: etaFromKm(km || 0.1) };
        }
      }
    }

    // Fallback: dispatch-time rider→pickup (allows 0).
    const pickupFromServer = Number(order.pickupDistanceKm);
    if (Number.isFinite(pickupFromServer) && pickupFromServer >= 0) {
      return {
        distanceKm: formatKm(pickupFromServer),
        etaMins: etaFromKm(pickupFromServer),
      };
    }

    return { distanceKm: '??', etaMins: order.prepTime || 15 };
  }, [order, primaryPickup, riderLocation]);

  if (!order) return null;

  const isReturnPickup = isReturnPickupTrip(order);
  const returnLabels = getReturnPickupStopLabels();
  const dropPoint = order?.dropPoint || null;
  const earnings = order.earnings || order.riderEarning || order.tripEarning || order.walletEarning || 0;
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName =
    order?.dispatchLeg?.sourceName ||
    (isQuickOrder
      ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
      : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant');
  const restaurantAddress =
    (isQuickOrder
      ? order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || order?.seller?.location?.formattedAddress
      : order?.restaurantAddress || order?.restaurant_address || order?.restaurantId?.location?.address) ||
    'Address not available';
  const deliveryAddress = order?.deliveryAddress || {};

  const geoCoords =
    Array.isArray(deliveryAddress?.location?.coordinates) &&
      deliveryAddress.location.coordinates.length >= 2
      ? {
        lng: deliveryAddress.location.coordinates[0],
        lat: deliveryAddress.location.coordinates[1],
      }
      : null;

  const customerLocation = order.customerLocation || order.deliveryLocation || geoCoords || null;

  const customerAddress =
    formatDeliveryAddressText(deliveryAddress, order.customerAddress || order.customer_address || '') ||
    'Location not available';

  const mapsLink =
    customerLocation?.lat != null && customerLocation?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(
        `${customerLocation.lat},${customerLocation.lng}`,
      )}`
      : null;

  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
      {
        id: order?.dispatchLeg?.legId || 'food:primary',
        pickupType: order?.dispatchLeg?.pickupType === 'quick' || isQuickOrder ? 'quick' : 'food',
        sourceName: order?.dispatchLeg?.sourceName || restaurantName,
        address: order?.dispatchLeg?.address || restaurantAddress,
      },
    ];

  const dropDistanceKm = (() => {
    if (order?.deliveryDistanceKm != null) return Number(order.deliveryDistanceKm).toFixed(1);
    if (order?.distanceKm != null) return Number(order.distanceKm).toFixed(1);
    return '??';
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center p-0"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col pt-2"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-1 pt-1 bg-white relative z-10 rounded-t-[2rem] -mb-[2px]">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
            <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3px]" />
          </button>
        </div>

        <RenderNewOrder 
          order={order} 
          distanceKm={distanceKm}
          dropDistanceKm={dropDistanceKm}
          etaMins={etaMins} 
          timeLeft={timeLeft} 
        />

        {/* Action Area (Shared Shell Bottom) */}
        <div className="p-5 pb-8 space-y-4">
          <ActionSlider
            label="Slide to Accept"
            onConfirm={() => onAccept(order)}
            color="bg-black"
            successLabel="Order Accepted ✓"
            timeProgress={(timeLeft / offerWindowSec) * 100}
          />

          <button
            onClick={onReject}
            className="w-full text-gray-400 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors py-1 active:scale-95"
          >
            Pass this task
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { getPrimaryPickupLocation, normalizeLocationPoint, normalizePickupPoints, isReturnPickupTrip, getDeliveryDocumentId, getReturnDropLocation, enrichReturnDeliveryOrder } from '@/modules/DeliveryV2/utils/orderRouting';
import { refreshActiveTrip } from '@/modules/DeliveryV2/services/deliveryOrderSync';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const {
    activeOrder, tripStatus, updateTripStatus, clearActiveOrder, setActiveOrder, riderLocation
  } = useDeliveryStore();

  const acceptOrder = async (order) => {
    const orderId = getDeliveryDocumentId(order);
    if (!orderId) {
      toast.error('Invalid order data');
      return;
    }

    const acceptBody = isReturnPickupTrip(order)
      ? { documentType: 'seller_return' }
      : order?.dispatchLeg?.legId
        ? { legId: order.dispatchLeg.legId }
        : {};

    try {
      const response = await deliveryAPI.acceptOrder(orderId, acceptBody);

      if (response?.data?.success) {
        const fullOrder = response.data.data?.order || order;

        // Robustly determine locations from multiple possible formats (Populated API vs Socket)
        const getLoc = (ref, keysLat, keysLng) => {
          if (!ref) return null;
          // Handle nested populated objects
          if (ref.location) {
            // Handle GeoJSON format: location: { type: 'Point', coordinates: [lng, lat] }
            if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
              return {
                lat: ref.location.coordinates[1], // Latitude is second in GeoJSON [lng, lat]
                lng: ref.location.coordinates[0]  // Longitude is first
              };
            }
            // Handle standard object format: location: { latitude: 12.3, longitude: 45.6 }
            return {
              lat: ref.location.latitude || ref.location.lat,
              lng: ref.location.longitude || ref.location.lng
            };
          }
          // Handle flat objects or direct lat/lng keys
          for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
          return null;
        };

        console.log('[OrderManager] Raw Full Order Data:', fullOrder);

        const resLoc = getLoc(fullOrder.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) ||
                       getLoc(fullOrder, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);

        const cusLoc = getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) ||
                       getLoc(fullOrder, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);
        const pickupPoints = normalizePickupPoints(fullOrder);
        const primaryPickupLocation =
          getPrimaryPickupLocation(fullOrder) ||
          normalizeLocationPoint(resLoc);
        const dropLocation = isReturnPickupTrip(fullOrder)
          ? getReturnDropLocation(fullOrder)
          : cusLoc;

        console.log('[OrderManager] Locations Mapped Result:', { resLoc, cusLoc, dropLocation });

        const mergedOrder = {
          ...order,
          ...fullOrder,
          orderId: fullOrder.orderId || order.orderId || orderId,
          returnId: fullOrder.returnId || (isReturnPickupTrip(fullOrder) ? orderId : undefined),
          documentType: fullOrder.documentType || (isReturnPickupTrip(fullOrder) ? 'seller_return' : undefined),
          tripType: fullOrder.tripType || (isReturnPickupTrip(fullOrder) ? 'return_pickup' : undefined),
          pickupPoints,
          restaurantLocation: primaryPickupLocation || resLoc,
          customerLocation: cusLoc,
          sellerDropLocation: dropLocation,
        };

        setActiveOrder(enrichReturnDeliveryOrder(mergedOrder));

        updateTripStatus('PICKING_UP');
        void refreshActiveTrip('accept');
        // toast.success('Order Accepted! Opening Map...');
      } else {
        toast.error(response?.data?.message || 'Order already taken or unavailable');
        throw new Error('Accept failed');
      }
    } catch (error) {
      console.error('Accept Order Error:', error);
      const status = Number(error?.response?.status || 0);
      const message = String(error?.response?.data?.message || '').toLowerCase();

      if (
        status === 403 &&
        (
          message.includes('already claimed') ||
          message.includes('someone else') ||
          message.includes('not available for this rider')
        )
      ) {
        toast.error('Order was accepted by someone else');
      } else {
        toast.error(error?.response?.data?.message || 'Network error. Please try again.');
      }
      throw error;
    }
  };

  /**
   * Mark "Reached Pickup" (Arrival at restaurant)
   */
  const reachPickup = async () => {
    const orderId = getDeliveryDocumentId(activeOrder);
    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId, {
        documentType: isReturnPickupTrip(activeOrder) ? 'seller_return' : undefined,
      });
      if (response?.data?.success) {
        updateTripStatus('REACHED_PICKUP');
        // toast.info('Arrived at Restaurant');
      } else {
        throw new Error('Confirm pickup failed');
      }
    } catch (error) {
      toast.error('Failed to update status');
      throw error;
    }
  };

  /**
   * Mark "Picked Up" (Confirm order ID & start delivery)
   */
  const pickUpOrder = async (billImageUrl, extra = {}) => {
    const orderId = getDeliveryDocumentId(activeOrder);
    try {
      const payload = isReturnPickupTrip(activeOrder)
        ? {
            documentType: 'seller_return',
            otp: extra?.otp || extra?.customerOtp,
            customerOtp: extra?.otp || extra?.customerOtp,
            pickupImages: extra?.pickupImages || (billImageUrl ? [billImageUrl] : []),
            billImageUrl,
          }
        : { billImageUrl };

      const response = await deliveryAPI.confirmOrderId(
        orderId,
        activeOrder.displayOrderId || orderId,
        riderLocation || {},
        payload,
      );

      if (response?.data?.success) {
        const updatedOrder = enrichReturnDeliveryOrder(
          response.data.data?.order || response.data?.order || activeOrder,
        );
        if (updatedOrder) setActiveOrder(updatedOrder);
        updateTripStatus('PICKED_UP');
        // toast.success('Order Collected! Heading to Drop-off');
      } else {
        throw new Error('Confirm order ID failed');
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      toast.error(message || 'Error confirming pickup');
      throw error;
    }
  };

  /**
   * Mark "Reached Drop" (Arrival at customer)
   */
  const reachDrop = async () => {
    const orderId = getDeliveryDocumentId(activeOrder);
    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId, {
        documentType: isReturnPickupTrip(activeOrder) ? 'seller_return' : undefined,
      });
      if (response?.data?.success) {
        updateTripStatus('REACHED_DROP');
        // toast.info('Arrived at Customer Location');
      } else {
        throw new Error('Confirm drop failed');
      }
    } catch (error) {
      toast.error('Failed to notify arrival');
      throw error;
    }
  };

  /**
   * Finalize Delivery with OTP Check
   */
  const completeDelivery = async (otp, options = {}) => {
    const { paymentMode } = options;
    const orderId = getDeliveryDocumentId(activeOrder);
    const isReturn = isReturnPickupTrip(activeOrder);

    try {
      if (isReturn) {
        const completeRes = await deliveryAPI.completeDelivery(orderId, {
          otp,
          sellerOtp: otp,
          documentType: 'seller_return',
        });
        if (completeRes?.data?.success) {
          const finalOrder = completeRes.data?.data?.order || activeOrder;
          if (finalOrder) setActiveOrder(finalOrder);
          updateTripStatus('COMPLETED');
        } else {
          throw new Error('Complete failed');
        }
        return;
      }

      // 1. Verify OTP first
      const verifyRes = await deliveryAPI.verifyDropOtp(orderId, otp);

      if (verifyRes?.data?.success) {
        let finalOrder = verifyRes.data?.data?.order || activeOrder;

        try {
          // 2. Mark as complete
          const completeRes = await deliveryAPI.completeDelivery(orderId, {
            otp,
            rating: 5,
            paymentMode
          });
          if (completeRes.data?.success && completeRes.data?.data?.order) {
            finalOrder = completeRes.data.data.order;
          }
        } catch (completeErr) {
          console.warn('Complete call failed, but OTP was verified.', completeErr);
          // If already completed, we proceed to show the summary with whatever we have
        }

        // Update local order state so Summary Modal shows 'delivered' status
        if (finalOrder) setActiveOrder(finalOrder);

        updateTripStatus('COMPLETED');
        // toast.success('Delivery Success!');
      } else {
        toast.error('Invalid OTP. Please check with customer.');
        throw new Error('Invalid OTP');
      }
    } catch (error) {
      console.error('Completion Error:', error);
      toast.error(error?.response?.data?.message || 'Verification failed');
      throw error;
    }
  };

  const resetTrip = () => {
    clearActiveOrder();
    void refreshActiveTrip('complete');
  };

  return {
    acceptOrder,
    reachPickup,
    pickUpOrder,
    reachDrop,
    completeDelivery,
    resetTrip,
  };
};

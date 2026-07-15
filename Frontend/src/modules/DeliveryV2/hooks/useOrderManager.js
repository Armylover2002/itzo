import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { getPrimaryPickupLocation, normalizeLocationPoint, normalizePickupPoints } from '@/modules/DeliveryV2/utils/orderRouting';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const { 
    activeOrder, tripStatus, updateTripStatus, clearActiveOrder, setActiveOrder, riderLocation 
  } = useDeliveryStore();

  const acceptOrder = async (order) => {
    const orderId = order?.orderId || order?._id || order?.id;
    if (!orderId) {
      toast.error('Invalid order data');
      return;
    }

    try {
      let response;
      
      if (order?.isReturn) {
        // Return Workflow
        const legId = order.orderId || order._id || order.id;
        response = await deliveryAPI.acceptReturnAssignment(legId);
      } else {
        // Normal Order Workflow
        response = await deliveryAPI.acceptOrder(
          orderId,
          order?.dispatchLeg?.legId ? { legId: order.dispatchLeg.legId } : {},
        );
      }
      
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
                       getLoc(fullOrder, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']) ||
                       getLoc(fullOrder.pickupAddress, ['latitude', 'lat'], ['longitude', 'lng']);
                       
        const cusLoc = getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) || 
                       getLoc(fullOrder, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']) ||
                       getLoc(fullOrder.dropoffAddress, ['latitude', 'lat'], ['longitude', 'lng']);
        const pickupPoints = normalizePickupPoints(fullOrder);
        const primaryPickupLocation =
          getPrimaryPickupLocation(fullOrder) ||
          normalizeLocationPoint(resLoc);

        console.log('[OrderManager] Locations Mapped Result:', { resLoc, cusLoc });

        setActiveOrder({
          ...fullOrder,
          orderId: orderId,
          pickupPoints,
          restaurantLocation: primaryPickupLocation || resLoc,
          customerLocation: cusLoc
        });

        updateTripStatus('PICKING_UP');
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
    const orderId = activeOrder?.orderId;
    try {
      const response = activeOrder?.isReturn 
        ? await deliveryAPI.markReturnReachedUser(orderId)
        : await deliveryAPI.confirmReachedPickup(orderId);
        
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
  const pickUpOrder = async (billImageUrlOrOtp) => {
    const orderId = activeOrder?.orderId;
    try {
      let response;
      if (activeOrder?.isReturn) {
        response = await deliveryAPI.verifyReturnPickupOtp(orderId, {
          otp: billImageUrlOrOtp.otp,
          pickupProofImages: billImageUrlOrOtp.pickupProofImages
        });
        // Once verified, we should logically also mark it as heading to seller
        // but backend might do that or we can do it after pickUpOrder.
      } else {
        response = await deliveryAPI.confirmOrderId(
          orderId, 
          activeOrder.displayOrderId || orderId, 
          riderLocation || {},
          { billImageUrl: billImageUrlOrOtp }
        );
      }
      
      if (response?.data?.success) {
        updateTripStatus('PICKED_UP');
        // toast.success('Order Collected! Heading to Drop-off');
      } else {
        throw new Error('Confirm order ID failed');
      }
    } catch (error) {
      toast.error('Error confirming pickup');
      throw error;
    }
  };

  /**
   * Mark "Reached Drop" (Arrival at customer)
   */
  const reachDrop = async () => {
    const orderId = activeOrder?.orderId;
    try {
      // For returns, we first notify that we're heading to seller (usually done when picked up, but can be done here as a safeguard)
      // then we mark reached seller.
      if (activeOrder?.isReturn) {
        await deliveryAPI.markReturnHeadingToSeller(orderId).catch(() => {});
      }
      
      const response = activeOrder?.isReturn
        ? await deliveryAPI.markReturnReachedSeller(orderId)
        : await deliveryAPI.confirmReachedDrop(orderId);
        
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
    const orderId = activeOrder?.orderId;
    try {
      // 1. Verify OTP first
      const verifyRes = activeOrder?.isReturn
        ? await deliveryAPI.verifyReturnSellerOtp(orderId, otp)
        : await deliveryAPI.verifyDropOtp(orderId, otp);
      
      if (verifyRes?.data?.success) {
        let finalOrder = verifyRes.data?.data?.order || verifyRes.data?.data?.sellerReturn || activeOrder;
        
        if (!activeOrder?.isReturn) {
          try {
            // 2. Mark as complete (Only for normal orders, Return OTP verification completes it on backend)
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
          }
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

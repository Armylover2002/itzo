import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, MapPin, Phone, 
  ChevronDown, ChevronUp, Package, 
  Navigation, UserRound, Clock
} from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { uploadAPI } from '@food/api';
import { toast } from 'sonner';
import { openCamera } from "@food/utils/imageUploadUtils";
import { isMixedOrder, isReturnPickupTrip, normalizePickupPoints, getReturnPickupStopLabels, resolveRestaurantLogoForDelivery, resolveDeliveryCustomerName } from '@/modules/DeliveryV2/utils/orderRouting';
import { RenderPickupVerification } from './renderers/PickupActionRenderers';

/**
 * PickupActionModal - Unified White/Green Theme with Slider Actions.
 * Includes Bill Upload feature prior to pickup.
 */
export const PickupActionModal = ({ 
  order, 
  status, 
  isWithinRange, 
  distanceToTarget,
  eta,
  onReachedPickup, 
  onPickedUp,
  onMinimize
}) => {
  const [showItems, setShowItems] = useState(false);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [billImageUploaded, setBillImageUploaded] = useState(false);
  const [billImageUrl, setBillImageUrl] = useState(null);
  const [customerOtpDigits, setCustomerOtpDigits] = useState(['', '', '', '']);
  const [pickupLogoError, setPickupLogoError] = useState(false);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    setPickupLogoError(false);
  }, [order?.orderId, order?._id, order?.restaurantImage]);

  const customerOtp = customerOtpDigits.join('');

  if (!order) return null;

  const isReturnPickup = isReturnPickupTrip(order);
  const returnLabels = getReturnPickupStopLabels();

  const handleBillImageSelect = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setIsUploadingBill(true);
    try {
      const res = await uploadAPI.uploadMedia(file, { folder: 'appzeto/delivery/bills' });
      if (res?.data?.success && res?.data?.data) {
        setBillImageUrl(res.data.data.url || res.data.data.secure_url);
        setBillImageUploaded(true);
        // toast.success('Bill image uploaded!');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      toast.error('Failed to upload bill image');
      setBillImageUploaded(false);
      setBillImageUrl(null);
    } finally {
      setIsUploadingBill(false);
    }
  };

  const handleTakeCameraPhoto = () => {
    openCamera({
      onSelectFile: (file) => handleBillImageSelect(file),
      fileNamePrefix: `bill-${order.orderId || order._id}`
    })
  }

  const handlePickFromGallery = () => {
    cameraInputRef.current?.click()
  }

  const isAtPickup = status === 'REACHED_PICKUP';
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName = isReturnPickup
    ? resolveDeliveryCustomerName(order)
    : isQuickOrder
    ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
    : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant';
  const restaurantAddress = isReturnPickup
    ? order?.customerAddress || order?.deliveryAddress?.formattedAddress || 'Customer address'
    : isQuickOrder
    ? order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || order?.seller?.location?.formattedAddress || 'Address not available'
    : order?.restaurantAddress || order?.restaurant_address || order?.restaurantLocation?.address || 'Address not available';
  const restaurantPhone = isQuickOrder
    ? order?.storePhone || order?.sellerPhone || order?.seller?.phone || ''
    : order?.restaurantPhone || order?.restaurant_phone || order?.restaurantId?.phone || order?.restaurant?.phone || '';
  const items = order.items || [];
  const restaurantLogo = isQuickOrder
    ? order?.storeImage || order?.seller?.logo || order?.seller?.image || order?.seller?.profileImage || ''
    : resolveRestaurantLogoForDelivery(order);
  const pickupPoints = normalizePickupPoints(order);
  const mixedOrder = isMixedOrder(order);
  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
        {
          id: 'food:primary',
          pickupType: isQuickOrder ? 'quick' : 'food',
          sourceName: restaurantName,
          address: restaurantAddress,
          phone: restaurantPhone,
        },
      ];
  const primaryStop = pickupStops[0] || null;
  const primaryPickupType = primaryStop?.pickupType === 'quick' ? 'quick' : 'food';
  const primaryName = primaryStop?.sourceName || restaurantName;
  const primaryAddress = primaryStop?.address || restaurantAddress;
  const primaryPhone = primaryStop?.phone || restaurantPhone;
  const primaryDestinationLabel = isReturnPickup
    ? resolveDeliveryCustomerName(order)
    : primaryPickupType === 'quick'
      ? 'Store'
      : 'Restaurant';

  const displayName = isReturnPickup
    ? resolveDeliveryCustomerName(order, primaryName)
    : primaryName;
  const displayAddress = primaryAddress;
  const displayPhone = primaryPhone;
  const displayLogo = isQuickOrder && !restaurantLogo
    ? 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png'
    : restaurantLogo || resolveRestaurantLogoForDelivery(order);
  const pickupPointLabel = isReturnPickup
    ? returnLabels.pickupLabel
    : primaryPickupType === 'quick'
      ? 'Store Pickup'
      : 'Restaurant Pickup';

  const canConfirmPickup = isReturnPickup
    ? billImageUploaded && customerOtp.length >= 4
    : billImageUploaded;

  const returnPickupLockedLabel = !billImageUploaded && customerOtp.length < 4
    ? 'Upload photo & enter OTP'
    : !billImageUploaded
      ? 'Upload return item photo'
      : 'Enter customer OTP';

  const compactReturnReached = isReturnPickup && isAtPickup;
  const showPickupStops = !compactReturnReached;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[110] p-0 flex items-end justify-center max-h-full">
      {/* Background Dim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-x-0 top-0 bottom-0 bg-black/40 -z-10"
      />

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className={`w-full max-w-lg bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.2)] overflow-y-auto overscroll-y-contain ${
          compactReturnReached
            ? 'rounded-t-[1.25rem] p-3 pb-4 max-h-[min(72vh,560px)]'
            : 'rounded-t-[2rem] p-4 pb-8 max-h-[min(82vh,680px)]'
        }`}
      >
        {/* Handle / Minimize */}
        <div className={`w-full flex justify-center ${compactReturnReached ? 'pb-2 pt-0' : 'pb-4 pt-1'}`}>
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
             <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3]" />
          </button>
        </div>

        {/* Pickup Header */}
        <div className={`flex items-start justify-between border-b border-gray-100 ${
          compactReturnReached ? 'mb-4 pb-3' : 'mb-5 pb-5'
        }`}>
          <div className="flex gap-4 min-w-0 flex-1">
            {!compactReturnReached && (
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden border border-gray-100 shrink-0">
                <img
                  src={pickupLogoError ? resolveRestaurantLogoForDelivery({}) : displayLogo}
                  alt="Pickup"
                  className="w-full h-full object-cover"
                  onError={() => setPickupLogoError(true)}
                />
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap gap-2 items-center mb-1">
                <h3 className={`text-gray-950 font-extrabold truncate ${compactReturnReached ? 'text-lg' : 'text-xl'}`}>{displayName}</h3>
                {isReturnPickup && (
                  <div className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700">
                    Return Pickup
                  </div>
                )}
                {mixedOrder && (
                  <div className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-700">
                    Mixed Order
                  </div>
                )}
              </div>
              <div className="flex items-center">
                {isAtPickup ? (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50/80 border border-green-100 px-2 py-1 rounded-md w-max">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Reached Location
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                    <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                       <Navigation className="w-3 h-3" />
                       {Number.isFinite(distanceToTarget)
                         ? `${(distanceToTarget / 1000).toFixed(1)} km`
                         : '--'}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                       <Clock className="w-3 h-3" />
                       {eta || '--'} min
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                if (displayPhone) window.location.href = `tel:${displayPhone}`;
                else toast.error('Phone number not available');
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                isReturnPickup
                  ? 'bg-red-50 text-red-600 border-red-100'
                  : 'bg-green-50 text-green-600 border-green-100'
              }`}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`, '_blank')}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ${
                isReturnPickup ? 'bg-red-600' : 'bg-gray-900'
              }`}
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-4 overflow-hidden">
          <div className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-800 font-mono border border-gray-200 shadow-sm whitespace-nowrap">
            ID: {order?.orderId || order?._id}
          </div>
        </div>

        {showPickupStops && (
        <div className="mb-4 space-y-2">
          {pickupStops.map((pickup, index) => {
            const isQuickStore = pickup.pickupType === 'quick';
            const label = pickupPointLabel;
            const accentClasses = isReturnPickup
              ? 'text-red-700 bg-red-50 border-red-200'
              : isQuickStore
                ? 'text-red-600 bg-red-50 border-red-100'
                : 'text-green-600 bg-green-50 border-green-100';

            return (
              <div
                key={pickup.id || `${pickup.pickupType}-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50/80 p-3"
              >
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${accentClasses}`}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{pickupStops.length > 1 ? `${label} ${index + 1}` : label}</span>
                </div>
                <p className="mt-3 text-base font-bold text-gray-950">
                  {isReturnPickup
                    ? resolveDeliveryCustomerName(order, pickup.sourceName || primaryName)
                    : (pickup.sourceName || primaryName)}
                </p>
                {(pickup.phone || primaryPhone) ? (
                  <p className="mt-1 text-sm font-semibold text-gray-700">{pickup.phone || primaryPhone}</p>
                ) : null}
                <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">{pickup.address || primaryAddress || 'Address not available'}</p>
              </div>
            );
          })}
        </div>
        )}

        {/* Action Sliders */}
        <div className={compactReturnReached ? 'space-y-3' : 'space-y-4'}>
          {!isAtPickup ? (
            <div>
              <p className={`text-center text-[10px] font-bold uppercase tracking-widest mb-3 transition-colors ${
                isWithinRange ? 'text-green-600' : 'text-red-500 animate-pulse'
              }`}>
                {isWithinRange ? 'Ready - Swipe to confirm arrival' : 'Get closer to pickup point'}
              </p>
              <ActionSlider 
                key="action-reach"
                label="Slide to Reach" 
                lockedLabel={isReturnPickup ? `Get closer to ${resolveDeliveryCustomerName(order)}` : 'Get closer to pickup point'}
                successLabel="Reached!"
                disabled={!isWithinRange}
                onConfirm={onReachedPickup}
                color="bg-[#FE5502]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <RenderPickupVerification 
                order={order}
                isReturnPickup={isReturnPickup}
                billImageUploaded={billImageUploaded}
                isUploadingBill={isUploadingBill}
                customerOtpDigits={customerOtpDigits}
                setCustomerOtpDigits={setCustomerOtpDigits}
                handleTakeCameraPhoto={handleTakeCameraPhoto}
                handlePickFromGallery={handlePickFromGallery}
                cameraInputRef={cameraInputRef}
                handleBillImageSelect={handleBillImageSelect}
              />


              <div>
                <p className={`text-center text-[9px] font-bold uppercase tracking-widest mb-2 ${canConfirmPickup ? 'text-green-600' : isReturnPickup ? 'text-red-500' : 'text-gray-400'}`}>
                  {isReturnPickup
                    ? (canConfirmPickup ? 'Swipe to confirm pickup' : 'Complete photo + OTP to unlock')
                    : (billImageUploaded ? "Check the restaurant logo - Swipe to pick up" : "Capture bill to unlock swipe")}
                </p>
                <ActionSlider
                  key="action-pickup"
                  label={isReturnPickup ? "Slide to Confirm Pickup" : "Slide to Pick Up"}
                  lockedLabel={isReturnPickup ? returnPickupLockedLabel : 'Upload bill to unlock'}
                  successLabel="Picked Up!"
                  disabled={!canConfirmPickup}
                  onConfirm={() => onPickedUp(billImageUrl, {
                    otp: customerOtp,
                    customerOtp,
                    pickupPhotoUrl: billImageUrl,
                    pickupImages: billImageUrl ? [billImageUrl] : [],
                  })}
                  color="bg-[#FE5502]"
                />
              </div>
            </div>
          )}

          {/* Delivery Instructions (User Note) */}
          {order?.note && (
            <div className={`bg-red-50 border border-red-100 rounded-xl flex gap-2.5 items-start ${
              compactReturnReached ? 'p-2.5' : 'p-3'
            }`}>
              {isReturnPickup ? (
                <UserRound className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <ChefHat className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                  {isReturnPickup ? 'Return Reason' : 'User Instructions'}
                </p>
                <p className={`font-bold text-gray-800 leading-snug ${compactReturnReached ? 'text-xs' : 'text-sm'}`}>"{order.note}"</p>
              </div>
            </div>
          )}

          {/* Collapsible Order Summary */}
          <button 
            onClick={() => setShowItems(!showItems)}
            className={`w-full flex items-center justify-between bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors ${
              compactReturnReached ? 'p-2.5' : 'p-3'
            }`}
          >
            <div className="flex items-center gap-2 text-gray-900 font-bold text-[10px] uppercase tracking-widest">
              <Package className="w-4 h-4 text-gray-400" />
              <span>{`Order Details (${items.length || 0})`}</span>
            </div>
            {showItems ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {showItems && (
            <div className="overflow-hidden space-y-2 px-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 text-sm font-bold">{item.name || 'Item Name'}</span>
                  <span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${
                    isReturnPickup ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                  }`}>x{item.quantity || 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PickupActionModal;

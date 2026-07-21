import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChefHat, MapPin, Phone, 
  ChevronDown, ChevronUp, Package, 
  Navigation, CheckCircle2, Camera, Loader2, Image as ImageIcon
} from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { uploadAPI, deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { openCamera } from "@food/utils/imageUploadUtils";
import { isMixedOrder, normalizePickupPoints } from '@/modules/DeliveryV2/utils/orderRouting';

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
  
  // Return Proof Images
  const [uploadedReturnImages, setUploadedReturnImages] = useState([]);
  
  const [returnOtp, setReturnOtp] = useState(['', '', '', '']);
  const returnOtpRefs = useRef([]);
  const cameraInputRef = useRef(null);

  const [resendingOtp, setResendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Handle cooldown timer
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendOtp = async () => {
    if (cooldown > 0 || resendingOtp) return;
    try {
      setResendingOtp(true);
      const res = await deliveryAPI.resendReturnOtp(order._id);
      toast.success('OTP resent successfully!');
      if (res.data?.cooldownRemaining) {
        setCooldown(res.data.cooldownRemaining);
      } else {
        setCooldown(60);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP';
      toast.error(msg);
      if (err.response?.data?.cooldownRemaining) {
        setCooldown(err.response.data.cooldownRemaining);
      }
    } finally {
      setResendingOtp(false);
    }
  };

  if (!order) return null;
  const isReturn = !!order?.isReturn;

  const handleBillImageSelect = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    if (isReturn && uploadedReturnImages.length >= 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setIsUploadingBill(true);
    try {
      const res = await uploadAPI.uploadMedia(file, { folder: 'appzeto/delivery/proofs' });
      if (res?.data?.success && res?.data?.data) {
        const url = res.data.data.url || res.data.data.secure_url;
        if (isReturn) {
          setUploadedReturnImages(prev => [...prev, url]);
        } else {
          setBillImageUrl(url);
          setBillImageUploaded(true);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      toast.error('Failed to upload image');
      if (!isReturn) {
        setBillImageUploaded(false);
        setBillImageUrl(null);
      }
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

  const handleReturnOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...returnOtp];
    newOtp[index] = value.substring(value.length - 1);
    setReturnOtp(newOtp);
    if (value && index < 3) returnOtpRefs.current[index + 1]?.focus();
  };

  const handleReturnOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !returnOtp[index] && index > 0)
      returnOtpRefs.current[index - 1]?.focus();
  };

  const isAtPickup = status === 'REACHED_PICKUP';
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName = isQuickOrder
    ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
    : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant';
  const restaurantAddress = isQuickOrder
    ? order?.storeAddress || order?.sellerAddress || order?.seller?.location?.address || order?.seller?.location?.formattedAddress || 'Address not available'
    : order?.restaurantAddress || order?.restaurant_address || order?.restaurantLocation?.address || 'Address not available';
  const restaurantPhone = isQuickOrder
    ? order?.storePhone || order?.sellerPhone || order?.seller?.phone || ''
    : order?.restaurantPhone || order?.restaurant_phone || order?.restaurantId?.phone || '';
  const items = order.items || [];
  const restaurantLogo = isQuickOrder
    ? order?.storeImage || order?.seller?.logo || order?.seller?.image || order?.seller?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png'
    : order?.restaurantImage || order?.restaurant?.logo || order?.restaurant?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
  const pickupPoints = normalizePickupPoints(order);
  const mixedOrder = isMixedOrder(order);
  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
        {
          id: 'food:primary',
          pickupType: isQuickOrder ? 'quick' : 'food',
          sourceName: isReturn ? (order?.user?.name || order?.pickupAddress?.name || 'Customer') : restaurantName,
          address: isReturn ? (order?.pickupAddress?.address || order?.pickupAddress?.formattedAddress || 'Customer Address') : restaurantAddress,
          phone: isReturn ? (order?.user?.phone || '') : restaurantPhone,
        },
      ];
  const primaryStop = pickupStops[0] || null;
  const primaryPickupType = primaryStop?.pickupType === 'quick' ? 'quick' : 'food';
  const primaryName = primaryStop?.sourceName || (isReturn ? 'Customer' : restaurantName);
  const primaryAddress = primaryStop?.address || (isReturn ? (order.pickupAddress?.address || 'Customer Address') : restaurantAddress);
  const primaryPhone = primaryStop?.phone || restaurantPhone;
  const primaryDestinationLabel = isReturn ? 'Customer' : (primaryPickupType === 'quick' ? 'Store' : 'Restaurant');

  return (
    <div className="absolute inset-x-0 bottom-0 z-[110] p-0 sm:p-2 sm:mb-2 flex items-end justify-center">
      {/* Background Dim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 -z-10"
      />

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-[0_-15px_40px_rgba(0,0,0,0.2)] p-4 pb-8"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-4 pt-1">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
             <ChevronDown className="w-6 h-6 text-gray-400 stroke-[3]" />
          </button>
        </div>

        {/* Restaurant Header */}
        <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-50">
          <div className="flex gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 overflow-hidden border border-gray-100">
              <img src={restaurantLogo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-gray-950 text-xl font-bold">{primaryName}</h3>
              {mixedOrder && (
                <div className="mt-2 inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-600">
                  Mixed Order
                </div>
              )}
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-1.5">
                {isAtPickup ? (
                  <span className="text-green-600">Reached Location √</span>
                ) : (
                  <span className="text-orange-500">
                    {(distanceToTarget / 1000).toFixed(1)} km • {eta || '--'} min to {primaryDestinationLabel}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {primaryPhone && (
              <button
                onClick={() => window.location.href = `tel:${primaryPhone}`}
                className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryAddress)}`, '_blank')}
              className="w-10 h-10 rounded-full bg-[#FE5502] flex items-center justify-center text-white shadow-lg hover:bg-[#FE5502]/90"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 space-y-2">
          {pickupStops.map((pickup, index) => {
            const isQuickStore = pickup.pickupType === 'quick';
            const label = isQuickStore ? 'Store Pickup' : 'Restaurant Pickup';
            const accentClasses = isQuickStore
              ? 'text-orange-600 bg-orange-50 border-orange-100'
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
                <p className="mt-3 text-base font-bold text-gray-950">{pickup.sourceName || (isQuickStore ? 'Seller store' : 'Restaurant')}</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">{pickup.address || 'Address not available'}</p>
              </div>
            );
          })}
        </div>

        {/* Action Sliders */}
        <div className="space-y-4">
          {!isAtPickup ? (
            <div>
              <p className={`text-center text-[10px] font-bold uppercase tracking-widest mb-3 transition-colors ${
                isWithinRange ? 'text-green-600' : 'text-orange-500 animate-pulse'
              }`}>
                {isWithinRange ? 'Ready - Swipe to confirm arrival' : 'Get closer to pickup point'}
              </p>
              <ActionSlider 
                key="action-reach"
                label="Slide to Reach" 
                successLabel="Reached!"
                disabled={!isWithinRange}
                onConfirm={onReachedPickup}
                color="bg-primary"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {isReturn ? (
                <div className="w-full bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col items-center">
                  <div className="w-full mb-4">
                     <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Proof of Pickup ({uploadedReturnImages.length}/5)</p>
                     </div>
                     <div className="flex gap-2 overflow-x-auto pb-2">
                        {uploadedReturnImages.map((img, i) => (
                           <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-200">
                             <img src={img} alt="Proof" className="w-full h-full object-cover" />
                           </div>
                        ))}
                        {uploadedReturnImages.length < 5 && (
                          <button 
                            onClick={handleTakeCameraPhoto}
                            disabled={isUploadingBill}
                            className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 hover:border-[#FE5502] transition-colors"
                          >
                            {isUploadingBill ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Camera className="w-5 h-5 text-gray-400" />}
                          </button>
                        )}
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBillImageSelect(e.target.files[0])}
                          className="hidden"
                        />
                     </div>
                  </div>
                  
                  {uploadedReturnImages.length > 0 ? (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Ask Customer for Pickup OTP</p>
                      <div className="flex justify-center gap-3">
                        {returnOtp.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => (returnOtpRefs.current[i] = el)}
                            type="number"
                            value={digit}
                            onChange={(e) => handleReturnOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleReturnOtpKeyDown(i, e)}
                            className={`w-12 h-14 bg-white border-2 rounded-xl text-center text-2xl font-bold transition-all focus:border-primary text-gray-700 border-gray-200`}
                          />
                        ))}
                      </div>
                      
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={handleResendOtp}
                          disabled={resendingOtp || cooldown > 0}
                          className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                            cooldown > 0 
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                              : "bg-orange-50 text-orange-600 hover:bg-orange-100 active:scale-95"
                          }`}
                        >
                          {resendingOtp ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                          ) : cooldown > 0 ? (
                            `Resend OTP in ${cooldown}s`
                          ) : (
                            "Resend OTP"
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-orange-500 bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 text-center">
                      Upload at least 1 image of the item to enter OTP
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-center items-center gap-3 w-full">
                   {!billImageUploaded && !isUploadingBill && (
                     <>
                        <button
                          onClick={handleTakeCameraPhoto}
                          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FE5502] text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-[#FE5502]/90"
                        >
                          <Camera className="w-5 h-5" />
                          <span>Camera</span>
                        </button>
                        <button
                          onClick={handlePickFromGallery}
                          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                        >
                          <ImageIcon className="w-5 h-5" />
                          <span>Gallery</span>
                        </button>
                     </>
                   )}
  
                   {isUploadingBill && (
                      <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs uppercase tracking-widest">
                         <Loader2 className="w-4 h-4 animate-spin" />
                         <span>Uploading...</span>
                      </div>
                   )}
  
                   {billImageUploaded && (
                      <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-100 text-green-700 font-bold text-xs uppercase tracking-widest">
                         <CheckCircle2 className="w-4 h-4" />
                         <span>Bill Uploaded</span>
                      </div>
                   )}
  
                   <input
                     ref={cameraInputRef}
                     type="file"
                     accept="image/*"
                     onChange={(e) => handleBillImageSelect(e.target.files[0])}
                     className="hidden"
                   />
                </div>
              )}

              <div>
                <p className={`text-center text-[10px] font-bold uppercase tracking-widest mb-3 ${(isReturn ? returnOtp.every(d => d) && uploadedReturnImages.length > 0 : billImageUploaded) ? 'text-green-600' : 'text-gray-400'}`}>
                  {isReturn 
                    ? (returnOtp.every(d => d) && uploadedReturnImages.length > 0 ? "Verified - Swipe to confirm pickup" : "Complete requirements to unlock swipe")
                    : (billImageUploaded ? "Check the restaurant logo - Swipe to pick up" : "Capture bill to unlock swipe")}
                </p>
                <ActionSlider 
                  key="action-pickup"
                  label={isReturn ? "Slide to Confirm Pickup" : "Slide to Pick Up"}
                  successLabel={isReturn ? "Picked Up!" : "Picked Up!"}
                  disabled={isReturn ? !(returnOtp.every(d => d) && uploadedReturnImages.length > 0) : !billImageUploaded}
                  onConfirm={() => onPickedUp(isReturn ? { otp: returnOtp.join(''), pickupProofImages: uploadedReturnImages } : billImageUrl)}
                  color="bg-primary"
                />
              </div>
            </div>
          )}

          {/* Delivery Instructions (User Note) */}
          {order?.note && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex gap-3 items-start">
              <ChefHat className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">User Instructions</p>
                <p className="text-sm font-bold text-gray-800 leading-snug">"{order.note}"</p>
              </div>
            </div>
          )}

          {/* Collapsible Order Summary */}
          <button 
            onClick={() => setShowItems(!showItems)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3 text-gray-900 font-bold text-xs uppercase tracking-widest">
              <Package className="w-5 h-5 text-gray-400" />
              <span>Order Details ({items.length || 0})</span>
            </div>
            {showItems ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {showItems && (
            <div className="overflow-hidden space-y-2 px-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 text-sm font-bold">{item.name || 'Item Name'}</span>
                  <span className="text-green-600 font-bold bg-green-50 px-2.5 py-1 rounded-lg text-xs">x{item.quantity || 1}</span>
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

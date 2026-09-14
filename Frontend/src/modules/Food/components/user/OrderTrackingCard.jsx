import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatScheduledAtShort } from "@food/utils/scheduleTime";
import { useActiveOrderStore } from "@food/store/activeOrderStore";
import {
  getCustomerToken,
  getOrderKey,
  getOrderPhase,
  getOrderStatus,
  getActiveOrderVenueImageUrl,
  getActiveOrderVenueName,
  shouldShowActiveOrderBanner,
  shouldShowActiveOrderBannerWithLifecycle,
} from "@food/utils/activeOrderUtils";
import { getLifecycleDisplay } from "@food/utils/orderLifecycleDisplay";
import { resolveQuickImageUrl } from "@/modules/quickCommerce/user/utils/image";

const CookingAnimation = memo(() => (
  <motion.div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 border border-red-100 overflow-visible shadow-[0_4px_15px_rgba(204,37,50,0.15)] shrink-0">
    <div className="absolute -top-3 flex gap-1.5">
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -8, -12], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -10, -15], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -8, -12], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
    </div>
    <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 mt-1">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FF0000] drop-shadow-sm">
        <path d="M6 10h12v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-6z" />
        <rect x="5" y="8" width="14" height="2" rx="1" />
        <path d="M12 8V5" />
        <path d="M11 5h2v2h-2z" fill="currentColor" />
        <path d="M19 9l3-1v2l-3 1" fill="currentColor" strokeWidth="1" />
        <path d="M5 10H3v2h2" />
      </svg>
    </motion.div>
    <motion.div animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [0.8, 1.2, 0.8] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 w-full flex justify-center z-0">
      <motion.div className="w-4 h-1 bg-red-500 blur-[2px] rounded-full" />
    </motion.div>
  </motion.div>
));

const ShoppingAnimation = memo(() => (
  <motion.div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50 border border-blue-100 overflow-visible shadow-[0_4px_15px_rgba(59,130,246,0.15)] shrink-0">
    <motion.div
      animate={{ y: [0, -4, 0], rotate: [0, -5, 5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="relative z-10"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 drop-shadow-sm">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    </motion.div>
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 bg-blue-400/10 rounded-xl blur-md"
    />
  </motion.div>
));

/** Legacy banner copy — used only when VITE_ORDER_LIFECYCLE_SSOT is OFF. */
function legacyBannerStatusText(orderStatus, orderPhase, isQuickOrder) {
  const s = String(orderStatus);
  const p = String(orderPhase);

  if (s === "scheduled") return "Your order is scheduled";
  if (s === "confirmed") return "Order confirmed";
  if (s === "preparing" || s === "created" || s === "pending") {
    return isQuickOrder ? "Packing your items" : "Preparing your order";
  }
  if (s === "ready_for_pickup") return "Ready for pickup";

  if (s === "reached_pickup" || p === "at_pickup") {
    return isQuickOrder
      ? "Delivery partner reached store"
      : "Delivery partner reached restaurant";
  }
  if (s === "picked_up" || p === "en_route_to_delivery") return "On the way";
  if (s === "reached_drop" || p === "at_drop") return "Arrived near you";

  if (s === "delivered" || p === "delivered" || p === "completed") return "Delivered";
  return isQuickOrder ? "Packing your items" : "Preparing your order";
}

function OrderTrackingCardInner({ hasBottomNav = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeOrder = useActiveOrderStore((s) => s.activeOrder);
  const etaMinutes = useActiveOrderStore((s) => s.etaMinutes);
  const dismissedKey = useActiveOrderStore((s) => s.dismissedKey);
  const dismissCurrent = useActiveOrderStore((s) => s.dismissCurrent);
  const [venueImageFailed, setVenueImageFailed] = useState(false);

  const lifecycle = getLifecycleDisplay(activeOrder, { audience: "user" });
  const bannerOrder = useMemo(() => {
    if (!getCustomerToken()) return null;
    if (lifecycle) {
      return shouldShowActiveOrderBannerWithLifecycle(activeOrder, dismissedKey, lifecycle)
        ? activeOrder
        : null;
    }
    return shouldShowActiveOrderBanner(activeOrder, dismissedKey) ? activeOrder : null;
  }, [activeOrder, dismissedKey, lifecycle]);

  const isQuickOrder = useMemo(() => {
    if (!bannerOrder) return false;
    return (
      bannerOrder.orderType === "quick" ||
      bannerOrder.module === "quick" ||
      !!bannerOrder.storeName ||
      !!bannerOrder.sellerName ||
      location.pathname.includes("/quick")
    );
  }, [bannerOrder, location.pathname]);

  const venueImageUrl = useMemo(() => {
    if (!bannerOrder) return "";
    const raw = getActiveOrderVenueImageUrl(bannerOrder, { isQuickOrder });
    if (!raw) return "";
    return isQuickOrder ? (resolveQuickImageUrl(raw) || raw) : raw;
  }, [bannerOrder, isQuickOrder]);

  const currentOrderKey = bannerOrder ? getOrderKey(bannerOrder) : "";

  useEffect(() => {
    setVenueImageFailed(false);
  }, [venueImageUrl, currentOrderKey]);

  if (!getCustomerToken() || !bannerOrder) {
    return null;
  }

  const orderStatus = getOrderStatus(bannerOrder) || "preparing";
  const orderPhase = getOrderPhase(bannerOrder);

  const displayName = getActiveOrderVenueName(bannerOrder, { isQuickOrder });

  const statusText = lifecycle
    ? lifecycle.subtitle
    : legacyBannerStatusText(orderStatus, orderPhase, isQuickOrder);

  const showEtaChrome = lifecycle
    ? lifecycle.stage !== "scheduled" &&
      lifecycle.stage !== "delivered" &&
      lifecycle.stage !== "cancelled" &&
      (lifecycle.showETA || etaMinutes !== null)
    : orderStatus !== "scheduled";

  const etaLabel =
    lifecycle?.stage === "scheduled" || orderStatus === "scheduled"
      ? formatScheduledAtShort(bannerOrder.scheduledAt) || "Scheduled"
      : etaMinutes !== null
        ? `${etaMinutes} min`
        : showEtaChrome
          ? "--"
          : "—";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed ${hasBottomNav ? "bottom-20" : "bottom-6"} left-4 right-4 z-[9999]`}
      >
        <div
          onClick={() => {
            const basePath = isQuickOrder ? "/quick/orders" : "/food/user/orders";
            navigate(`${basePath}/${currentOrderKey}`);
          }}
          className={`relative bg-white/95 backdrop-blur-xl rounded-[20px] p-4 shadow-[0_8px_30px_${isQuickOrder ? "rgba(59,130,246,0.15)" : "rgba(204,37,50,0.15)"}] border ${isQuickOrder ? "border-blue-100/60" : "border-red-100/60"} overflow-visible cursor-pointer group`}
        >
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${isQuickOrder ? "from-blue-50/50" : "from-red-50/50"} via-white/40 to-white/80 opacity-60 pointer-events-none rounded-[20px]`}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissCurrent();
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full ${isQuickOrder ? "bg-blue-50/80 text-blue-400 hover:text-blue-600 hover:bg-blue-100/80" : "bg-red-50/80 text-red-400 hover:text-red-600 hover:bg-red-100/80"} transition-colors z-20 shadow-sm`}
          >
            <X className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          <motion.div className="flex items-center gap-4 relative z-10 w-full">
            {venueImageUrl && !venueImageFailed ? (
              <motion.div
                className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border shadow-sm ${
                  isQuickOrder ? "border-blue-100" : "border-red-100"
                }`}
              >
                <img
                  src={venueImageUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={() => setVenueImageFailed(true)}
                />
              </motion.div>
            ) : isQuickOrder ? (
              <ShoppingAnimation />
            ) : (
              <CookingAnimation />
            )}

            <motion.div className="flex-1 min-w-0 pr-4">
              <p className="text-gray-900 font-bold text-base md:text-lg truncate tracking-tight">
                {displayName}
              </p>
              <motion.div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-gray-500 font-medium text-xs md:text-sm truncate">{statusText}</p>
                <ChevronRight
                  className={`w-3.5 h-3.5 ${isQuickOrder ? "text-blue-500" : "text-[#FF0000]"} shrink-0 group-hover:translate-x-1 transition-transform`}
                />
              </motion.div>
            </motion.div>

            <motion.div
              className={`bg-gradient-to-br ${isQuickOrder ? "from-blue-500 to-blue-600 shadow-blue-500/20 border-blue-200" : "from-[#FF0000] to-[#C83C00] shadow-red-500/20 border-red-200"} shadow-lg rounded-xl px-3.5 py-2 shrink-0 flex flex-col items-center justify-center border min-w-[72px]`}
            >
              <p
                className={`${isQuickOrder ? "text-blue-50" : "text-red-50"} text-[10px] font-bold uppercase tracking-wider opacity-95 leading-tight mb-[2px]`}
              >
                {lifecycle?.stage === "scheduled" || orderStatus === "scheduled"
                  ? "Scheduled"
                  : showEtaChrome
                    ? "arriving in"
                    : "status"}
              </p>
              <p className="text-white text-base md:text-[17px] font-bold leading-tight drop-shadow-sm tabular-nums">
                {etaLabel}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const OrderTrackingCard = memo(OrderTrackingCardInner);
export default OrderTrackingCard;

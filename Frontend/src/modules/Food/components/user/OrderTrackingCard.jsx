import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UtensilsCrossed, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CookingAnimation = memo(() => (
  <div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 border border-red-100 overflow-visible shadow-[0_4px_15px_rgba(204,37,50,0.15)] shrink-0">
    <div className="absolute -top-3 flex gap-1.5">
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -8, -12], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -10, -15], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -8, -12], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1, ease: "easeOut" }} className="w-1.5 h-3 bg-red-400/60 rounded-full blur-[1px]" />
    </div>
    <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 mt-1">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FE5502] drop-shadow-sm">
        {/* Cooker Body */}
        <path d="M6 10h12v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-6z" />
        {/* Lid Rim */}
        <rect x="5" y="8" width="14" height="2" rx="1" />
        {/* Pressure Whistle (Top) */}
        <path d="M12 8V5" />
        <path d="M11 5h2v2h-2z" fill="currentColor" />
        {/* Main Handle (Right) */}
        <path d="M19 9l3-1v2l-3 1" fill="currentColor" strokeWidth="1" />
        {/* Sub Handle (Left) */}
        <path d="M5 10H3v2h2" />
      </svg>
    </motion.div>
    {/* Flame below */}
    <motion.div animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [0.8, 1.2, 0.8] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 w-full flex justify-center z-0">
      <div className="w-4 h-1 bg-red-500 blur-[2px] rounded-full" />
    </motion.div>
  </div>
));

const ShoppingAnimation = memo(() => (
  <div className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-orange-50 border border-orange-100 overflow-visible shadow-[0_4px_15px_rgba(59,130,246,0.15)] shrink-0">
    <motion.div 
      animate={{ 
        y: [0, -4, 0],
        rotate: [0, -5, 5, 0]
      }} 
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }} 
      className="relative z-10"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary drop-shadow-sm">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    </motion.div>
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.6, 0.3]
      }} 
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }} 
      className="absolute inset-0 bg-orange-400/10 rounded-xl blur-md"
    />
  </div>
));

import { useOrders } from "@food/context/OrdersContext";
import { orderAPI } from "@food/api";

const getOrderKey = (order) => order?.id || order?._id || order?.orderId || null;
const getCustomerToken = () => {
  let token = localStorage.getItem("auth_customer") || localStorage.getItem("user_accessToken");
  if (!token) {
    const generic = localStorage.getItem("accessToken");
    if (generic) {
      try {
        const payload = JSON.parse(window.atob(generic.split(".")[1]));
        if (payload?.role && payload.role.toUpperCase() !== "USER") return null;
      } catch (e) {}
      token = generic;
    }
  }
  return token;
};

const getOrderStatus = (order) =>
  String(order?.orderStatus || order?.status || order?.deliveryState?.status || "").toLowerCase();

const getOrderPhase = (order) =>
  String(order?.deliveryState?.currentPhase || "").toLowerCase();

const ACTIVE_PHASES = new Set([
  "created",
  "confirmed",
  "preparing",
  "accepted",
  "ready",
  "ready_for_pickup",
  "reached_pickup",
  "picked_up",
  "out_for_delivery",
  "en_route_to_delivery",
  "at_pickup",
  "at_drop",
]);

/** Orders that should show the live tracking strip (any in-flight order, not terminal). */
const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "completed",
  "failed",
  "cancelled_by_user",
  "cancelled_by_restaurant",
  "cancelled_by_admin",
]);

const isActiveOrder = (order) => {
  if (!order) return false;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (phase === "completed" || phase === "delivered") return false;
  // Some refresh payloads provide live phase but sparse status; keep tracking visible.
  if (!status && phase) return ACTIVE_PHASES.has(phase);
  if (!status) return false;
  if (status === "scheduled") return false;
  return true;
};

const getTimeRemaining = (order) => {
  if (!order) return null;

  const orderTime = new Date(
    order.createdAt || order.orderDate || order.created_at || order.date || Date.now(),
  );
  const estimatedMinutes =
    order.estimatedDeliveryTime ||
    order.estimatedTime ||
    order.estimated_delivery_time ||
    35;
  const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
  return Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
};

/** Cheap fingerprint so we skip setState when list content is unchanged (fewer re-renders). */
function ordersFingerprint(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return "";
  return orders
    .map((o) => `${getOrderKey(o)}:${getOrderStatus(o)}`)
    .join("|");
}

function OrderTrackingCardInner({ hasBottomNav = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders: contextOrders } = useOrders();
  const hasCustomerAuth = !!getCustomerToken();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);
  const [hasFetchedApi, setHasFetchedApi] = useState(false);
  const [activeOrderOverride, setActiveOrderOverride] = useState(null);
  const lastRefreshRef = useRef(0);
  const lastApiFingerprintRef = useRef("");
  const activeOrderKeyRef = useRef("");
  const activeOrderSnapshotRef = useRef(null);
  const [invalidOrderIds, setInvalidOrderIds] = useState(new Set());

  const fetchOrders = useCallback(async () => {
    if (!getCustomerToken()) {
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
      setHasFetchedApi(true);
      return;
    }
    try {
      const response = await orderAPI.getOrders({ limit: 10, page: 1 });
      let nextOrders = [];

      if (response?.data?.success && response?.data?.data?.orders) {
        nextOrders = response.data.data.orders;
      } else if (response?.data?.orders) {
        nextOrders = response.data.orders;
      } else if (response?.data?.data?.data && Array.isArray(response.data.data.data)) {
        nextOrders = response.data.data.data;
      } else if (response?.data?.data?.docs && Array.isArray(response.data.data.docs)) {
        nextOrders = response.data.data.docs;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        nextOrders = response.data.data;
      }

      const list = Array.isArray(nextOrders) ? nextOrders : [];
      const fp = ordersFingerprint(list);
      if (fp !== lastApiFingerprintRef.current) {
        lastApiFingerprintRef.current = fp;
        setApiOrders(list);
      }
    } catch (error) {
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
    } finally {
      setHasFetchedApi(true);
    }
  }, []);

  useEffect(() => {
    if (!hasCustomerAuth) return;
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, hasCustomerAuth]);

  const uniqueOrders = useMemo(() => {
    const isMongoObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
    const serverKeys = new Set(
      (apiOrders || []).map((o) => String(getOrderKey(o) || "")).filter(Boolean),
    );
    const seen = new Set();

    return [...apiOrders, ...contextOrders].filter((order) => {
      const key = getOrderKey(order);
      if (!key || seen.has(key)) {
        return false;
      }
      if (invalidOrderIds.has(key)) {
        return false;
      }
      // After first API sync, ignore stale local Mongo-like ids that are absent server-side.
      // This prevents repeated verification calls for already-deleted orders.
      if (
        hasFetchedApi &&
        isMongoObjectId(key) &&
        !serverKeys.has(String(key))
      ) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [contextOrders, apiOrders, invalidOrderIds, hasFetchedApi]);

  const activeOrder = useMemo(() => {
    const candidate = uniqueOrders.find((order) => isActiveOrder(order)) || null;
    if (!candidate) return null;
    const overrideKey = getOrderKey(activeOrderOverride);
    const candidateKey = getOrderKey(candidate);
    if (overrideKey && candidateKey && overrideKey === candidateKey) return activeOrderOverride;
    return candidate;
  }, [uniqueOrders, activeOrderOverride]);

  useEffect(() => {
    const key = String(getOrderKey(activeOrder) || "");
    activeOrderKeyRef.current = key;
    activeOrderSnapshotRef.current = activeOrder;
  }, [activeOrder]);

  useEffect(() => {
    if (!hasCustomerAuth) return;
    const handleOrderStatusNotification = async (event) => {
      const detail = event?.detail || {};
      const incomingKey = String(detail?.orderMongoId || detail?.orderId || "").trim();
      const currentKey = activeOrderKeyRef.current;
      if (!incomingKey || !currentKey) return;
      if (incomingKey !== currentKey) return;

      const snap = activeOrderSnapshotRef.current;

      setActiveOrderOverride((prev) => ({
        ...(prev || snap || {}),
        orderStatus: detail?.orderStatus || prev?.orderStatus || snap?.orderStatus,
        deliveryState: detail?.deliveryState
          ? { ...(prev?.deliveryState || snap?.deliveryState || {}), ...detail.deliveryState }
          : prev?.deliveryState || snap?.deliveryState,
        status: detail?.status || prev?.status || snap?.status,
      }));

      const now = Date.now();
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;

      try {
        const response = await orderAPI.getOrderDetails(incomingKey);
        const fresh = response?.data?.data?.order || response?.data?.order || response?.data?.data || null;
        if (fresh) setActiveOrderOverride(fresh);
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          setInvalidOrderIds((prev) => {
            const next = new Set(prev);
            next.add(incomingKey);
            return next;
          });
        }
      }
    };

    const handleOrderPlaced = () => {
      fetchOrders();
    };

    window.addEventListener("orderStatusNotification", handleOrderStatusNotification);
    window.addEventListener("order-placed", handleOrderPlaced);

    return () => {
      window.removeEventListener("orderStatusNotification", handleOrderStatusNotification);
      window.removeEventListener("order-placed", handleOrderPlaced);
    };
  }, [fetchOrders, hasCustomerAuth]);

  useEffect(() => {
    if (!activeOrder) {
      setTimeRemaining((prev) => (prev !== null ? null : prev));
      return;
    }

    const tick = () => {
      const next = getTimeRemaining(activeOrder);
      setTimeRemaining((prev) => (prev === next ? prev : next));
    };

    tick();
    const interval = setInterval(tick, 60000);

    return () => clearInterval(interval);
  }, [activeOrder]);

  // Proactive verification for active orders not found in recent API list
  useEffect(() => {
    if (!hasCustomerAuth) return;
    const key = getOrderKey(activeOrder);
    if (!key || invalidOrderIds.has(key)) return;

    // If order is present in the recent server-provided list, we consider it valid without extra check
    const isRecentlyConfirmed = apiOrders.some((o) => getOrderKey(o) === key);
    if (isRecentlyConfirmed) return;

    const verifyOrderExists = async () => {
      try {
        await orderAPI.getOrderDetails(key);
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          setInvalidOrderIds((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        }
      }
    };

    verifyOrderExists();
  }, [activeOrder, apiOrders, invalidOrderIds, hasCustomerAuth]);

  const [dismissedKey, setDismissedKey] = useState(null);

  if (!hasCustomerAuth) {
    return null;
  }

  if (!activeOrder) {
    return null;
  }

  const currentOrderKey = activeOrder.id || activeOrder._id || activeOrder.orderId;
  if (dismissedKey === currentOrderKey) {
    return null;
  }

  const orderStatus = getOrderStatus(activeOrder) || "preparing";
  const orderPhase = getOrderPhase(activeOrder);
  if (orderStatus === "delivered" || orderStatus === "completed") {
    return null;
  }

  const isQuickOrder = 
    activeOrder.orderType === "quick" || 
    activeOrder.module === "quick" || 
    !!activeOrder.storeName || 
    !!activeOrder.sellerName ||
    location.pathname.includes("/quick");

  const displayName =
    activeOrder.storeName || 
    activeOrder.sellerName || 
    activeOrder.restaurant || 
    activeOrder.restaurantName || 
    (isQuickOrder ? "Store" : "Restaurant");

  const statusText = (() => {
    const s = String(orderStatus);
    const p = String(orderPhase);

    if (s === "scheduled") return "Your order is scheduled";
    if (s === "confirmed") return "Order confirmed";
    if (s === "preparing" || s === "created" || s === "pending") {
      return isQuickOrder ? "Packing your items" : "Preparing your order";
    }
    if (s === "ready_for_pickup") return "Ready for pickup";

    if (s === "reached_pickup" || p === "at_pickup") {
      return isQuickOrder ? "Delivery partner reached store" : "Delivery partner reached restaurant";
    }
    if (s === "picked_up" || p === "en_route_to_delivery") return "On the way";
    if (s === "reached_drop" || p === "at_drop") return "Arrived near you";

    if (s === "delivered" || p === "delivered" || p === "completed") return "Delivered";
    return isQuickOrder ? "Packing your items" : "Preparing your order";
  })();

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
            const id = activeOrder.id || activeOrder._id || activeOrder.orderId;
            const basePath = isQuickOrder ? "/quick/orders" : "/food/user/orders";
            navigate(`${basePath}/${id}`);
          }}
          className={`relative bg-white/95 backdrop-blur-xl rounded-[20px] p-4 shadow-[0_8px_30px_${isQuickOrder ? 'rgba(59,130,246,0.15)' : 'rgba(204,37,50,0.15)'}] border ${isQuickOrder ? 'border-orange-100/60' : 'border-red-100/60'} overflow-visible cursor-pointer group`}
        >
          {/* Subtle gradient background mesh */}
          <div className={`absolute inset-0 bg-gradient-to-r ${isQuickOrder ? 'from-orange-50/50' : 'from-red-50/50'} via-white/40 to-white/80 opacity-60 pointer-events-none rounded-[20px]`} />
          
          <button 
             onClick={(e) => { e.stopPropagation(); setDismissedKey(currentOrderKey); }}
             className={`absolute top-2 right-2 p-1.5 rounded-full ${isQuickOrder ? 'bg-orange-50/80 text-orange-400 hover:text-primary hover:bg-orange-100/80' : 'bg-red-50/80 text-red-400 hover:text-red-600 hover:bg-red-100/80'} transition-colors z-20 shadow-sm`}
          >
            <X className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          <div className="flex items-center gap-4 relative z-10 w-full">
            {isQuickOrder ? <ShoppingAnimation /> : <CookingAnimation />}

            <div className="flex-1 min-w-0 pr-4">
              <p className="text-gray-900 font-bold text-base md:text-lg truncate tracking-tight">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-gray-500 font-medium text-xs md:text-sm truncate">{statusText}</p>
                <ChevronRight className={`w-3.5 h-3.5 ${isQuickOrder ? 'text-primary' : 'text-[#FE5502]'} shrink-0 group-hover:translate-x-1 transition-transform`} />
              </div>
            </div>

            <div className={`bg-gradient-to-br ${isQuickOrder ? 'from-orange-500 to-orange-600 shadow-orange-500/20 border-orange-200' : 'from-[#FE5502] to-[#C83C00] shadow-red-500/20 border-red-200'} shadow-lg rounded-xl px-4 py-2 shrink-0 flex flex-col items-center justify-center border`}>
              <p className={`${isQuickOrder ? 'text-orange-50' : 'text-red-50'} text-[10px] font-bold uppercase tracking-wider opacity-95 leading-tight mb-[2px]`}>
                {orderStatus === "scheduled" ? "Scheduled" : "arriving in"}
              </p>
              <p className="text-white text-base md:text-[17px] font-black leading-tight drop-shadow-sm">
                {orderStatus === "scheduled"
                  ? activeOrder.scheduledAt
                    ? new Date(activeOrder.scheduledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Scheduled"
                  : timeRemaining !== null
                    ? `${Math.max(1, timeRemaining)} min`
                    : "--"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const OrderTrackingCard = memo(OrderTrackingCardInner);
export default OrderTrackingCard;

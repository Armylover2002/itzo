import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { generateOrderInvoice } from "../../utils/printOrderInvoice";
import { useNavigate } from "react-router-dom";
import {
  checkOnboardingStatus,
  isRestaurantOnboardingComplete,
} from "@food/utils/onboardingUtils";
import { motion, AnimatePresence } from "framer-motion";
// import Lenis from "lenis";
import {
  Printer,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  MessageSquare,
  Check,
  Phone,
  User,
  Lock,
  Unlock,
  Star,
  Package,
  Utensils,
  Search,
  Menu,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders";
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar";
import OrderDetails from "./OrderDetails";
import notificationSound from "@food/assets/audio/alert.mp3";
import { restaurantAPI } from "@food/api";
import { RESTAURANT_COMMISSION_ENABLED } from "@food/constants/commission";
import { getCancellationDisplayLabel, getCancellationDisplayReason } from "@food/utils/cancellationDisplay";

/** Dashboard list: one source of truth via restaurantAPI.getOrders (limit=50, 2.5s TTL). */
function invalidateRestaurantOrdersCache() {
  restaurantAPI.getOrders.invalidate?.();
}

async function fetchRestaurantOrdersShared({ force = false } = {}) {
  if (force) invalidateRestaurantOrdersCache();
  return restaurantAPI.getOrders();
}
import {
  formatScheduledAtShort,
  parseValidDate,
} from "@food/utils/scheduleTime";
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ResendNotificationButton from "@food/components/restaurant/ResendNotificationButton";
import { ActionSlider } from "@/modules/DeliveryV2/components/ui/ActionSlider";
import { useIncomingOrderQueueStore } from "../../store/incomingOrderQueueStore";
const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };

const STORAGE_KEY = "restaurant_online_status";

// Top filter tabs
const filterTabs = [
  { id: "all", label: "All", icon: Menu },
  { id: "preparing", label: "Preparing", icon: Clock },
  { id: "ready", label: "Ready", icon: Check },
  { id: "out-for-delivery", label: "Out for delivery", icon: Package },
  { id: "scheduled", label: "Scheduled", icon: Calendar },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "cancelled", label: "Cancelled", icon: X },
];

const allOrdersStatusPriority = {
  preparing: 0,
  ready: 1,
  confirmed: 2,
  pending: 3,
  out_for_delivery: 4,
  scheduled: 5,
  delivered: 6,
  completed: 6,
  cancelled: 7,
  cancelled_by_restaurant: 7,
  cancelled_by_user: 7,
  cancelled_by_admin: 7,
  cancelled_by_delivery: 7,
};

const TERMINAL_ORDER_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled",
  "cancelled_by_restaurant",
  "cancelled_by_user",
  "cancelled_by_admin",
  "cancelled_by_delivery",
]);

const normalizeOrderListStatus = (orderLike = {}) => {
  const raw = String(orderLike?.status || orderLike?.orderStatus || "pending")
    .trim()
    .toLowerCase();
  if (raw.includes("cancel")) return "cancelled";
  if (raw === "ready_for_pickup" || raw === "ready") return "ready";
  if (raw === "picked_up" || raw === "out_for_delivery" || raw === "on_the_way") {
    return "out_for_delivery";
  }
  return raw || "pending";
};

const isTerminalOrderListStatus = (status) =>
  TERMINAL_ORDER_STATUSES.has(String(status || "").toLowerCase()) ||
  String(status || "").toLowerCase().includes("cancel");

const compareLiveOrdersForRestaurant = (a, b) => {
  const aTerminal = isTerminalOrderListStatus(a?.status);
  const bTerminal = isTerminalOrderListStatus(b?.status);
  // Keep actionable kitchen orders above delivered/cancelled.
  if (aTerminal !== bTerminal) return aTerminal ? 1 : -1;

  const quickDiff = (a?.kitchenPriority ?? 1) - (b?.kitchenPriority ?? 1);
  if (quickDiff !== 0) return quickDiff;

  const priorityDiff =
    (allOrdersStatusPriority[normalizeOrderListStatus(a)] ?? 999) -
    (allOrdersStatusPriority[normalizeOrderListStatus(b)] ?? 999);
  if (priorityDiff !== 0) return priorityDiff;

  return (b?.sortTimestamp || 0) - (a?.sortTimestamp || 0);
};

const getAllOrdersTimestamp = (order) => {
  const status = normalizeOrderListStatus(order);
  // Only while still scheduled: list clock must show scheduledAt (not createdAt).
  if (status === "scheduled") {
    const scheduled = parseValidDate(order.scheduledAt);
    if (scheduled) return scheduled.toISOString();
  }
  return (
    order?.cancelledAt ||
    order?.deliveredAt ||
    order?.updatedAt ||
    order?.createdAt ||
    new Date().toISOString()
  );
};

const getRestaurantVisibleItems = (items = []) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const foodItems = normalizedItems.filter((item) => {
    const itemType = String(item?.type || item?.orderType || "food").toLowerCase();
    return itemType !== "quick";
  });
  return foodItems.length ? foodItems : normalizedItems;
};

const isFoodQuickDeliveryOrder = (orderLike = {}) =>
  orderLike.isFoodQuickDelivery === true ||
  String(orderLike.deliveryMode || "").toLowerCase() === "quick" ||
  String(orderLike.type || "").toLowerCase() === "quick";

const resolveQuickRestaurantShare = (orderLike = {}) => {
  const pricing = orderLike?.pricing || {};
  let quickShare = Math.max(
    0,
    Number(pricing.quickRestaurantShare) ||
      Number(orderLike.quickRestaurantShare) ||
      0,
  );
  let quickSharePct = Math.max(
    0,
    Number(pricing.quickSharePcts?.restaurant) ||
      Number(orderLike.quickSharePcts?.restaurant) ||
      0,
  );

  if (!(quickShare > 0) && isFoodQuickDeliveryOrder(orderLike)) {
    const charge = Math.max(
      0,
      Number(pricing.quickDeliveryFee) || Number(orderLike.quickDeliveryFee) || 0,
    );
    if (charge > 0 && quickSharePct > 0) {
      quickShare = Math.round(((charge * quickSharePct) / 100) * 100) / 100;
    }
  }

  return { quickShare, quickSharePct };
};

const buildOrderItemsSummary = (items = []) =>
  getRestaurantVisibleItems(items)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ") || "No items";

const getOrderPreviewItem = (items = []) =>
  getRestaurantVisibleItems(items)[0] || null;

const transformOrderForList = (order) => {
  const status = normalizeOrderListStatus(order);
  const displayTs =
    status === "scheduled" && parseValidDate(order.scheduledAt)
      ? order.scheduledAt
      : getAllOrdersTimestamp(order);
  const isFoodQuick = String(order.deliveryMode || "").toLowerCase() === "quick";
  return {
  orderId: order.orderId || order.orderMongoId || order._id,
  mongoId: order._id || order.orderMongoId || null,
  status,
  customerName: order.userId?.name || order.customerName || "Customer",
  type: "Home Delivery",
  tableOrToken: null,
  timePlaced: new Date(displayTs).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ),
  scheduledAt: order.scheduledAt || null,
  eta: order.etaPromise?.max || null,
  deliveryMode: order.deliveryMode || "basic",
  isFoodQuickDelivery: isFoodQuick,
  etaPromise: order.etaPromise || null,
  itemsSummary: buildOrderItemsSummary(order.items),
  photoUrl: getOrderPreviewItem(order.items)?.image || null,
  photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
  paymentMethod: order.paymentMethod || order.payment?.method || null,
  deliveryPartnerId: order.deliveryPartnerId || null,
  dispatchStatus: order.dispatch?.status || null,
  preparingTimestamp: order.tracking?.preparing?.timestamp
    ? new Date(order.tracking.preparing.timestamp)
    : new Date(order.createdAt || Date.now()),
  initialETA: order.etaPromise?.max || order.estimatedDeliveryTime || 30,
  sortTimestamp: new Date(getAllOrdersTimestamp(order)).getTime(),
  kitchenPriority: isFoodQuick ? 0 : 1,
};
};

// Completed Orders List Component
function CompletedOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const completedOrders = response.data.data.orders.filter(
            (order) =>
              order.status === "delivered" || order.status === "completed",
          );

          const transformedOrders = completedOrders.map((order) => ({
            orderId: order.orderId || order.orderMongoId || order._id,
            mongoId: order._id || order.orderMongoId || null,
            status: order.status || "delivered",
            customerName: order.userId?.name || order.customerName || "Customer",
            type: "Home Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            deliveredAt:
              order.deliveredAt || order.updatedAt || order.createdAt,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            amount: order.pricing?.total || order.total || 0,
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          }));

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.deliveredAt);
            const dateB = new Date(b.deliveredAt);
            return dateB - dateA;
          });

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching completed orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Completed orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Completed orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No completed orders yet
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const deliveredDate = order.deliveredAt
              ? new Date(order.deliveredAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "N/A";

            return (
              <div
                key={order.orderId || order.mongoId}
                className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      mongoId: order.mongoId,
                      status: "Delivered",
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: deliveredDate,
                      itemsSummary: order.itemsSummary,
                      paymentMethod: order.paymentMethod,
                    })
                  }
                  className="w-full text-left flex gap-3 items-stretch">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black leading-tight">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-[#0D315B]/40 text-[#0D315B]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0D315B]" />
                          Delivered
                        </span>
                        <span className="text-[11px] text-gray-500 text-right">
                          {deliveredDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {order.itemsSummary}
                      </p>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">
                          Amount
                        </span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Cancelled Orders List Component
function CancelledOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter cancelled orders (both restaurant and user cancelled)
          const cancelledOrders = response.data.data.orders.filter((order) => {
            const status = String(order.status || order.orderStatus || "").toLowerCase();
            return status.includes("cancel");
          });

          const transformedOrders = cancelledOrders.map((order) => {
            const orderStatus = order.orderStatus || order.status;
            const displayReason =
              getCancellationDisplayReason({
                ...order,
                orderStatus,
              }) || order.cancellationReason || "No reason provided";

            return {
            orderId: order.orderId || order.orderMongoId || order._id,
            mongoId: order._id || order.orderMongoId || null,
            status: orderStatus || "cancelled",
            orderStatus,
            customerName: order.userId?.name || order.customerName || "Customer",
            type: "Home Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            cancelledAt:
              order.cancelledAt || order.updatedAt || order.createdAt,
            cancelledBy: order.cancelledBy || "unknown",
            cancellationReason: displayReason,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            amount: order.pricing?.total || order.total || 0,
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          };
          });

          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.cancelledAt);
            const dateB = new Date(b.cancelledAt);
            return dateB - dateA;
          });

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching cancelled orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Cancelled orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Cancelled orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No cancelled orders yet
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const cancelledDate = order.cancelledAt
              ? new Date(order.cancelledAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "N/A";

            const cancelledByText =
              getCancellationDisplayLabel(order) || "Cancelled";

            return (
              <div
                key={order.orderId || order.mongoId}
                className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    onSelectOrder?.({
                      orderId: order.orderId,
                      mongoId: order.mongoId,
                      status: "Cancelled",
                      customerName: order.customerName,
                      type: order.type,
                      tableOrToken: order.tableOrToken,
                      timePlaced: cancelledDate,
                      itemsSummary: order.itemsSummary,
                      paymentMethod: order.paymentMethod,
                    })
                  }
                  className="w-full text-left flex gap-3 items-stretch">
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
                    {order.photoUrl ? (
                      <img
                        src={order.photoUrl}
                        alt={order.photoAlt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                        <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                          {order.photoAlt}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-h-[80px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-black leading-tight">
                          Order #{order.orderId}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${order.cancelledBy === "user"
                            ? "border-red-500 text-red-600"
                            : "border-red-500 text-red-600"
                            }`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${order.cancelledBy === "user"
                              ? "bg-red-500"
                              : "bg-red-500"
                              }`}
                          />
                          {cancelledByText}
                        </span>
                        <span className="text-[11px] text-gray-500 text-right">
                          {cancelledDate}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {order.itemsSummary}
                      </p>
                      {order.cancellationReason && (
                        <p className="text-[10px] text-red-600 mt-1 line-clamp-1">
                          Reason: {order.cancellationReason}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-gray-500">
                          {order.type}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-gray-500">
                          Amount
                        </span>
                        <span className="text-xs font-medium text-black">
                          ₹{order.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AllOrders({
  onSelectOrder,
  onCancel,
  searchQuery = "",
  refreshToken = 0,
  socketConnected = false,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingReadyOrderIds, setMarkingReadyOrderIds] = useState({});

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    let countdownIntervalId = null;

    const fetchOrders = async () => {
      try {
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const transformedOrders = response.data.data.orders
            .map(transformOrderForList)
            .sort(compareLiveOrdersForRestaurant);

          setOrders(transformedOrders);
        } else {
          setOrders([]);
        }
      } catch (error) {
        if (!isMounted) return;

        if (
          error.code !== "ERR_NETWORK" &&
          error.response?.status !== 404 &&
          error.response?.status !== 401
        ) {
          debugError("Error fetching all orders:", error);
        }

        setOrders([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();
    // Socket-first: REST poll only when restaurant socket is down.
    if (!socketConnected) {
      intervalId = setInterval(fetchOrders, 45000);
    }
    countdownIntervalId = setInterval(() => {
      // Pause ETA tick only while the incoming panel is expanded over the list.
      if (
        useIncomingOrderQueueStore.getState().orders.length > 0 &&
        !useIncomingOrderQueueStore.getState().panelMinimized
      )
        return;
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (countdownIntervalId) clearInterval(countdownIntervalId);
    };
  }, [refreshToken, socketConnected]);

  const handleMarkReady = async ({ orderId, mongoId }) => {
    const orderKey = mongoId || orderId;
    if (!orderKey || markingReadyOrderIds[orderKey]) return;

    try {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: true }));
      await restaurantAPI.markOrderReady(orderKey);
      setOrders((prev) =>
        prev
          .map((order) =>
            (order.mongoId || order.orderId) === orderKey
              ? {
                  ...order,
                  status: "ready",
                  eta: null,
                  sortTimestamp: Date.now(),
                }
              : order,
          )
          .sort(compareLiveOrdersForRestaurant),
      );
      toast.success("Order marked as ready");
    } catch (error) {
      debugError("Error marking order as ready from All orders:", error);
      toast.error(
        error.response?.data?.message || "Failed to mark order as ready",
      );
    } finally {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">All orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders
    .filter((o) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
        String(o.customerName || "").toLowerCase().includes(q) ||
        String(o.itemsSummary || "").toLowerCase().includes(q)
      );
    })
    .sort(compareLiveOrdersForRestaurant);

  return (
    <div className="pt-4 pb-6 md:pt-0">
      <div className="flex items-baseline justify-between mb-3 md:mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base md:text-lg font-bold text-gray-900">All orders</h2>
          <span className="text-xs md:text-sm font-semibold text-gray-500">({filteredOrders.length})</span>
        </div>
        <button className="text-sm font-semibold text-blue-600 hidden md:block hover:text-blue-700 transition-colors">
          Full History &gt;
        </button>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="md:bg-white md:rounded-2xl md:border md:border-gray-100/80 md:shadow-sm flex flex-col items-center justify-center py-16 md:min-h-[400px]">
          <div className="w-16 h-16 bg-slate-50/80 rounded-full flex items-center justify-center mb-4 border border-gray-100 hidden md:flex">
            <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-base md:text-lg font-bold text-gray-500 md:text-gray-900">There is no live order</h3>
          <p className="text-sm text-gray-400 mt-1 hidden md:block">There are no orders here right now.</p>
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            const normalizedStatus = String(order.status || "").toLowerCase();
            let etaDisplay = order.eta;

            if (normalizedStatus === "preparing" && order.preparingTimestamp) {
              const elapsedMs = currentTime - order.preparingTimestamp;
              const elapsedMinutes = Math.floor(elapsedMs / 60000);
              const remainingMinutes = Math.max(
                0,
                order.initialETA - elapsedMinutes,
              );

              if (remainingMinutes <= 0) {
                const remainingSeconds = Math.max(
                  0,
                  Math.floor(order.initialETA * 60 - elapsedMs / 1000),
                );
                etaDisplay =
                  remainingSeconds > 0 ? `${remainingSeconds} secs` : "0 mins";
              } else {
                etaDisplay = `${remainingMinutes} mins`;
              }
            }

            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                {...order}
                eta={etaDisplay}
                onSelect={onSelectOrder}
                onCancel={
                  normalizedStatus === "preparing" ? onCancel : undefined
                }
                onMarkReady={
                  normalizedStatus === "preparing" ? handleMarkReady : undefined
                }
                isMarkingReady={Boolean(
                  markingReadyOrderIds[order.mongoId || order.orderId],
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Timer persistence helpers
const getInitialCountdown = (orderId) => {
  if (!orderId) return 240;
  const storageKey = `order_timer_${orderId}`;
  const startTime = localStorage.getItem(storageKey);

  if (startTime) {
    const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000);
    const remaining = 240 - elapsed;
    return remaining > 0 ? remaining : 0;
  } else {
    localStorage.setItem(storageKey, Date.now().toString());
    return 240;
  }
};

const getPopupOrderTotal = (orderLike) => {
  if (!orderLike) return 0;

  const rawItems = Array.isArray(orderLike.items) ? orderLike.items : [];
  const visibleItems = getRestaurantVisibleItems(rawItems);

  const subtotal =
    Number(orderLike.pricing?.subtotal ?? orderLike.pricing?.itemSubtotal) ||
    visibleItems.reduce((sum, item) => {
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 0);
      return (
        sum +
        (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0)
      );
    }, 0);

  const packagingFee = Number(orderLike.pricing?.packagingFee) || 0;
  const { quickShare } = resolveQuickRestaurantShare(orderLike);

  return Math.max(0, subtotal + packagingFee + quickShare);
};

// Restaurant facing pricing breakdown — produces exactly the same format the user
// requested in the second reference image (subtotal, packaging, commission with
// fallback, restaurant earning).
const computeRestaurantBreakdown = (orderLike, visibleItemsFallback) => {
  if (!orderLike) {
    return { subtotal: 0, packagingFee: 0, commission: 0, commissionPct: 0, restaurantEarning: 0 };
  }
  const pricing = orderLike.pricing || {};

  // Subtotal — prefer stored, else sum items.
  const subtotal = Math.max(
    0,
    Number(pricing.subtotal ?? pricing.itemSubtotal) ||
      (Array.isArray(visibleItemsFallback)
        ? visibleItemsFallback.reduce((s, it) => {
            const p = Number(it?.price || 0);
            const q = Number(it?.quantity || 0);
            return s + (Number.isFinite(p) ? p : 0) * (Number.isFinite(q) ? q : 0);
          }, 0)
        : 0)
  );

  const packagingFee = Math.max(0, Number(pricing.packagingFee) || 0);
  const { quickShare, quickSharePct } = resolveQuickRestaurantShare(orderLike);

  // Restaurant commission flow is disabled (subscription based model instead) —
  // never fall back to an estimated commission when it's off.
  let commission = 0;
  let commissionPct = 0;
  if (RESTAURANT_COMMISSION_ENABLED) {
    // Commission with multi-source fallback — fixes issue where commission row
    // would not render at all when pricing.restaurantCommission was missing.
    commission = Math.max(
      0,
      Number(pricing.restaurantCommission) || Number(orderLike.restaurantCommission) || 0
    );
    const storedPct = Math.max(
      0,
      Number(pricing.restaurantCommissionPercentage) ||
        Number(orderLike.restaurantCommissionPercentage) ||
        0
    );
    if (!(commission > 0) && subtotal > 0) {
      // Compute dynamically from stored pct or default 15%.
      const pct = storedPct > 0 ? storedPct : 15;
      commission = Math.round((subtotal * pct) * 100) / 10000;
    }
    commissionPct =
      commission > 0 && subtotal > 0
        ? storedPct > 0
          ? storedPct
          : Number(((commission / subtotal) * 100).toFixed(1))
        : 0;
  }

  const restaurantEarning = Math.max(0, subtotal + packagingFee + quickShare - commission);

  return { subtotal, packagingFee, quickShare, quickSharePct, commission, commissionPct, restaurantEarning };
};

const buildIncomingOrderQueueEntry = (source = {}) => {
  const visibleItems = getRestaurantVisibleItems(source.items || []);
  const { quickShare, quickSharePct } = resolveQuickRestaurantShare(source);
  const pricing = {
    ...(source.pricing || {}),
    ...(quickShare > 0 ? { quickRestaurantShare: quickShare } : {}),
    ...(quickSharePct > 0
      ? {
          quickSharePcts: {
            ...(source.pricing?.quickSharePcts || {}),
            restaurant: quickSharePct,
          },
        }
      : {}),
  };
  const deliveryMode =
    source.deliveryMode ||
    (isFoodQuickDeliveryOrder(source) ? "quick" : "basic");
  const normalized = {
    ...source,
    items: visibleItems,
    pricing,
    deliveryMode,
    isFoodQuickDelivery: String(deliveryMode).toLowerCase() === "quick",
    quickRestaurantShare: quickShare,
  };

  return {
    orderId: source.orderId || source.id || source._id,
    orderMongoId: source.orderMongoId || source._id,
    _id: source._id,
    restaurantId: source.restaurantId,
    restaurantName: source.restaurantName,
    items: visibleItems,
    pricing,
    restaurantBill: source.restaurantBill ?? pricing.restaurantBill,
    total: getPopupOrderTotal(normalized),
    customerAddress: source.customerAddress || source.address,
    status: source.status || source.orderStatus,
    createdAt: source.createdAt,
    scheduledAt: source.scheduledAt,
    estimatedDeliveryTime: source.estimatedDeliveryTime || 30,
    note: source.note || "",
    restaurantNote: source.restaurantNote || "",
    sendCutlery: source.sendCutlery,
    paymentMethod: source.paymentMethod || source.payment?.method || null,
    payment: source.payment,
    deliveryMode,
    isFoodQuickDelivery: normalized.isFoodQuickDelivery,
    quickRestaurantShare: quickShare,
    quickSharePcts: pricing.quickSharePcts,
  };
};

// Format countdown time
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/** Accept-time prep bounds — aligned with Delivery Settings kitchen prep (max 90). */
const PREP_TIME_MIN = 5;
const PREP_TIME_MAX = 90;
const PREP_TIME_FALLBACK = 12;

const clampPrepMinutes = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return PREP_TIME_FALLBACK;
  return Math.min(PREP_TIME_MAX, Math.max(PREP_TIME_MIN, Math.round(n)));
};

const IncomingOrderCard = memo(function IncomingOrderCard({
    order,
    orderKey,
    defaultPrepMinutes = PREP_TIME_FALLBACK,
  
    rejectTarget,
    showRejectPopup,
    setShowRejectPopup,
    setRejectTarget,
    setRejectReason,
    requestOrdersRefresh,
    isMuted,
    toggleMute,
    handlePrint,
    handleRejectClick,
    rejectInFlightRef,
    clearOrderTimer,
    markOrderAsShown,
    removeIncomingOrder,
    stopRinging,
}) {
    const orderIdForApi =
      order?.orderMongoId || order?.orderId || order?._id || order?.id;

    const orderIdForTimer = orderIdForApi;
    const rejectTargetKey = rejectTarget
      ? useIncomingOrderQueueStore.getState().getOrderKey(rejectTarget)
      : null;
    const isRejectModalOpenForThisOrder =
      showRejectPopup && rejectTargetKey === orderKey;

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
    const [prepTime, setPrepTime] = useState(() =>
      clampPrepMinutes(defaultPrepMinutes),
    );
    const [countdown, setCountdown] = useState(() =>
      getInitialCountdown(orderIdForTimer),
    );
    const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
    const autoRejectInFlightRef = useRef(false);

    const visibleItems = getRestaurantVisibleItems(order?.items);
    const primaryItem = visibleItems[0] || null;
    const breakdown = computeRestaurantBreakdown(order, visibleItems);

    useEffect(() => {
      if (countdown <= 0) return;
      if (isAcceptingOrder) return;
      if (isRejectModalOpenForThisOrder) return;

      // Stable 1s tick — do NOT depend on `countdown` value (that recreated the interval every second).
      // `countdown === 0` in deps only re-runs when timer finishes so the interval is cleared.
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => clearInterval(timer);
    }, [isAcceptingOrder, isRejectModalOpenForThisOrder, countdown === 0]);

    useEffect(() => {
      if (countdown > 0) return;
      if (!orderIdForApi) return;
      if (autoRejectInFlightRef.current) return;
      if (isAcceptingOrder) return;
      if (rejectInFlightRef.current) return;
      if (isRejectModalOpenForThisOrder) return;

      autoRejectInFlightRef.current = true;

      // Stop ringtone + remove from queue immediately so multi-order UI never sticks at 0:00.
      markOrderAsShown(order);
      stopRinging(order);
      clearOrderTimer(order);
      clearOrderTimer(orderIdForTimer);
      removeIncomingOrder(order);

      if (showRejectPopup && rejectTargetKey === orderKey) {
        setShowRejectPopup(false);
        setRejectTarget(null);
        setRejectReason("");
      }

      (async () => {
        try {
          const rejectPromise = restaurantAPI.rejectOrder(
            orderIdForApi,
            "Restaurant not accept",
          );
          // Bound wait so a hung API cannot block restaurant panel recovery.
          await Promise.race([
            rejectPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("auto-reject timeout")), 12000),
            ),
          ]);
          toast.info("Order auto-rejected due to timeout");
          requestOrdersRefresh();
        } catch (error) {
          debugError("Error auto-rejecting order:", error);
          toast.error("Order timed out — remove failed on server. Refresh orders.");
          requestOrdersRefresh();
        }
      })();
    }, [
      countdown,
      orderIdForApi,
      orderIdForTimer,
      orderKey,
      isAcceptingOrder,
      isRejectModalOpenForThisOrder,
      rejectTargetKey,
      showRejectPopup,
      markOrderAsShown,
      stopRinging,
      clearOrderTimer,
      removeIncomingOrder,
      requestOrdersRefresh,
      setShowRejectPopup,
      setRejectTarget,
      setRejectReason,
      rejectInFlightRef,
      order,
    ]);

    const handleAcceptIncoming = async () => {
      if (isAcceptingOrder) return;
      if (isRejectModalOpenForThisOrder) return;
      if (!orderIdForApi) return;

      setIsAcceptingOrder(true);

      // Stop ringtone immediately for this accepted order.
      stopRinging(order);

      // Ensure this order can't re-trigger fallback selection.
      markOrderAsShown(order);

      try {
        await restaurantAPI.acceptOrder(
          orderIdForApi,
          clampPrepMinutes(prepTime),
        );
        toast.success("Order accepted successfully");
        requestOrdersRefresh();

        clearOrderTimer(orderIdForApi);
        removeIncomingOrder(order);
      } catch (error) {
        debugError("? Error accepting order:", error);
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to accept order. Please try again.";

        if (error.response?.status === 400) {
          toast.error(errorMessage);
        } else if (error.response?.status === 404) {
          toast.error(
            "Order not found. It may have been cancelled or already processed.",
          );
        } else {
          toast.error(errorMessage);
        }
        setIsAcceptingOrder(false);
      }
    };

    const decreasePrepTime = () =>
      setPrepTime((prev) => clampPrepMinutes(Number(prev) - 1));
    const increasePrepTime = () =>
      setPrepTime((prev) => clampPrepMinutes(Number(prev) + 1));

    return (
      <motion.div
        className="shrink-0 w-[min(92vw,400px)] sm:w-[400px] max-h-[70vh] snap-center bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-[#0D315B] px-5 py-4 flex justify-between items-center text-white border-b border-red-600/20">
          <div>
            <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              Incoming Order
            </p>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {order?.orderId || order?.orderMongoId || "#Order"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(order)}
              className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
              aria-label="Print"
            >
              <Printer className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 pb-3 flex-1 overflow-y-auto min-h-0 bg-gray-50 space-y-3">
          {/* Scheduled Indicator */}
          {order?.scheduledAt && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#0D315B] uppercase tracking-wider">
                  Scheduled Order
                </p>
                <p className="text-sm font-bold text-[#0D315B]">
                  For {formatScheduledAtShort(order.scheduledAt) || "Scheduled time"}
                </p>
              </div>
            </div>
          )}

          {/* Customer info & Details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h4 className="text-base font-bold text-gray-900 tracking-tight">
                  {primaryItem?.name || "New Order"}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {order?.createdAt
                    ? new Date(order.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now"}
                </p>
              </div>
              <div className="text-right">
                <span className="block text-xs font-medium text-gray-500">
                  {visibleItems.length || 0} item
                  {visibleItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="w-full flex items-center justify-center py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-600 mr-1">
                {isDetailsExpanded ? "Hide Details" : "View Details"}
              </span>
              {isDetailsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>

            <AnimatePresence>
              {isDetailsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden bg-gray-50/30"
                >
                  <div className="px-3 py-3 space-y-2 border-t border-gray-100">
                    {visibleItems.length > 0 ? (
                      visibleItems.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                              item.isVeg ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <p className="text-xs font-semibold text-gray-900 leading-snug">
                                {item.quantity} × {item.name}
                              </p>
                              <p className="text-xs font-bold text-gray-900 ml-2 shrink-0">
                                ₹{item.price * item.quantity}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 text-center">No items</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Customer note for the kitchen */}
          {Boolean(order?.restaurantNote) && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                Note for restaurant
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-line break-words">
                {order.restaurantNote}
              </p>
            </div>
          )}

          {/* Order Summary & Settings Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            {/* Cutlery preference & Payment */}
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Utensils
                  className={`w-4 h-4 ${
                    order?.sendCutlery === false
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    order?.sendCutlery === false
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {order?.sendCutlery === false ? "No Cutlery" : "Send Cutlery"}
                </span>
              </div>
              {(() => {
                const raw =
                  order?.paymentMethod || order?.payment?.method;
                const m = raw != null ? String(raw).toLowerCase().trim() : "";
                const isCod = m === "cash" || m === "cod";
                return (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
                      isCod
                        ? "bg-amber-50 text-amber-600 border-amber-200"
                        : "bg-green-50 text-green-600 border-green-200"
                    }`}
                  >
                    {isCod ? "COD" : "Paid"}
                  </span>
                );
              })()}
            </div>

            {/* Prep Time Row */}
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Prep Time</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
                <button
                  onClick={decreasePrepTime}
                  className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95"
                  disabled={isAcceptingOrder || prepTime <= PREP_TIME_MIN}
                  aria-label="Decrease prep time"
                >
                  <Minus className="w-3.5 h-3.5 text-gray-700" />
                </button>
                <span className="text-sm font-bold text-gray-900 w-8 text-center">
                  {prepTime}m
                </span>
                <button
                  onClick={increasePrepTime}
                  className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95"
                  disabled={isAcceptingOrder || prepTime >= PREP_TIME_MAX}
                  aria-label="Increase prep time"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Pricing Breakdown — matches the bill-details style from order summary dialogs.
                Shows: Item Subtotal → Packaging → Commission (-) → Order Total → Restaurant Earning.
                Item list itself is collapsible via "View / Hide Details" above so card stays compact. */}
            <div className="flex flex-col divide-y divide-gray-100 bg-gray-50/40 rounded-b-xl">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">Item Subtotal</span>
                <span className="text-xs font-semibold text-slate-700">
                  ₹{breakdown.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">Packaging Fee</span>
                <span className="text-xs font-semibold text-slate-700">
                  ₹{breakdown.packagingFee.toFixed(2)}
                </span>
              </div>
              {(breakdown.quickShare > 0 || isFoodQuickDeliveryOrder(order)) && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Quick delivery share
                    {breakdown.quickSharePct > 0 ? (
                      <span className="text-[10px] font-medium text-slate-400 ml-1">
                        ({breakdown.quickSharePct.toFixed(1)}%)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    ₹{breakdown.quickShare.toFixed(2)}
                  </span>
                </div>
              )}
              {breakdown.commission > 0 && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-bold text-red-600">
                    Commission Paid
                    {breakdown.commissionPct > 0 && (
                      <span className="text-[10px] font-medium text-red-400 ml-1">
                        ({breakdown.commissionPct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-red-600">
                    -₹{breakdown.commission.toFixed(2)}
                  </span>
                </div>
              )}
              {/* Total Bill row (matches user expectation, items+packaging) */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/60">
                <span className="text-sm font-bold text-gray-900">Total Bill</span>
                <span className="text-lg font-black text-gray-900">
                  ₹{getPopupOrderTotal(order)}
                </span>
              </div>
              {/* Restaurant Net Earning (green, positive) */}
              {breakdown.restaurantEarning >= 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-green-50/70">
                  <span className="text-xs font-bold text-green-700">Your Earning</span>
                  <span className="text-sm font-extrabold text-green-700">
                    ₹{breakdown.restaurantEarning.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="space-y-3">
            <ActionSlider
              label={
                isAcceptingOrder
                  ? "Accepting..."
                  : `Slide to accept (${formatTime(countdown)})`
              }
              lockedLabel="Accepting..."
              onConfirm={handleAcceptIncoming}
              disabled={isAcceptingOrder || isRejectModalOpenForThisOrder}
              color="bg-[#0D315B]"
              successLabel="Accepted ✓"
              timeProgress={(countdown / 240) * 100}
            />

            <button
              onClick={() => handleRejectClick(order)}
              disabled={isAcceptingOrder || isRejectModalOpenForThisOrder}
              className="w-full py-3 bg-white border border-[#0D315B]/20 text-[#0D315B] rounded-xl font-bold text-sm hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Order
            </button>
          </div>
        </div>
      </motion.div>
    );
  });

export default function OrdersMain() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const contentRef = useRef(null);
  const filterBarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const mouseStartX = useRef(0);
  const mouseEndX = useRef(0);
  const isMouseDown = useRef(false);

  // Incoming Orders Queue (multi-order)
  const [isMuted, setIsMuted] = useState(false);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectingOrder, setIsRejectingOrder] = useState(false);

  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  const audioRef = useRef(null);
  const shownOrdersRef = useRef(new Set()); // Track orders already shown in incoming queue

  const rejectInFlightRef = useRef(false);
  const cancelInFlightRef = useRef(false);
  const [restaurantStatus, setRestaurantStatus] = useState({
    isActive: null,
    rejectionReason: null,
    onboarding: null,
    kitchenPrepMinutes: PREP_TIME_FALLBACK,
    isLoading: true,
  });
  const defaultPrepMinutes = clampPrepMinutes(
    restaurantStatus.kitchenPrepMinutes,
  );
  const [isReverifying, setIsReverifying] = useState(false);
  const audioUnlockedRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const newOrderRef = useRef(null);

  // Timer persistence helpers


  const clearOrderTimer = useCallback((orderIdOrLike) => {
    if (!orderIdOrLike) return;
    if (typeof orderIdOrLike === "string" || typeof orderIdOrLike === "number") {
      localStorage.removeItem(`order_timer_${String(orderIdOrLike).trim()}`);
      return;
    }
    const keys = [
      orderIdOrLike?.orderMongoId,
      orderIdOrLike?.orderId,
      orderIdOrLike?._id,
      orderIdOrLike?.id,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);
    for (const k of keys) localStorage.removeItem(`order_timer_${k}`);
  }, []);

  const markOrderAsShown = useCallback((orderLike) => {
    const keys = [
      orderLike?.orderMongoId,
      orderLike?.orderId,
      orderLike?._id,
      orderLike?.id,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);

    for (const k of keys) shownOrdersRef.current.add(k);
  }, []);

  const hasOrderBeenShown = useCallback((orderLike) => {
    const keys = [
      orderLike?.orderMongoId,
      orderLike?.orderId,
      orderLike?._id,
      orderLike?.id,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);

    return keys.some((k) => shownOrdersRef.current.has(k));
  }, []);

  // Restaurant notifications hook for real-time orders
  const { newOrder, clearNewOrder, isConnected } = useRestaurantNotifications({
    enableSound: false,
  });

  const rejectReasons = [
    "Restaurant is too busy",
    "Item not available",
    "Outside delivery area",
    "Kitchen closing soon",
    "Technical issue",
    "Other reason",
  ];

  // Fetch restaurant verification status
  useEffect(() => {
    const fetchRestaurantStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        const restaurant =
          response?.data?.data?.restaurant || response?.data?.restaurant;
        if (restaurant) {
          setRestaurantStatus({
            isActive: restaurant.isActive,
            rejectionReason: restaurant.rejectionReason || null,
            onboarding: restaurant.onboarding || null,
            kitchenPrepMinutes: clampPrepMinutes(restaurant.kitchenPrepMinutes),
            isLoading: false,
          });

          // Check if onboarding is incomplete and redirect if needed
          if (!isRestaurantOnboardingComplete(restaurant)) {
            // Onboarding is incomplete, redirect to onboarding page
            const incompleteStep = await checkOnboardingStatus();
            if (incompleteStep) {
              navigate(`/restaurant/onboarding?step=${incompleteStep}`, {
                replace: true,
              });
              return;
            }
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (
          error.code !== "ERR_NETWORK" &&
          error.code !== "ECONNABORTED" &&
          !error.message?.includes("timeout")
        ) {
          debugError("Error fetching restaurant status:", error);
        }
        // Set loading to false so UI doesn't stay in loading state
        setRestaurantStatus((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchRestaurantStatus();

    // Listen for restaurant profile updates
    const handleProfileRefresh = () => {
      fetchRestaurantStatus();
    };

    window.addEventListener("restaurantProfileRefresh", handleProfileRefresh);

    return () => {
      window.removeEventListener(
        "restaurantProfileRefresh",
        handleProfileRefresh,
      );
    };
  }, [navigate]);

  // Handle reverify (resubmit for approval)
  const handleReverify = async () => {
    try {
      setIsReverifying(true);
      await restaurantAPI.reverify();

      // Refresh restaurant status
      const response = await restaurantAPI.getCurrentRestaurant();
      const restaurant =
        response?.data?.data?.restaurant || response?.data?.restaurant;
      if (restaurant) {
        setRestaurantStatus({
          isActive: restaurant.isActive,
          rejectionReason: restaurant.rejectionReason || null,
          onboarding: restaurant.onboarding || null,
          isLoading: false,
        });
      }

      // Trigger profile refresh event
      window.dispatchEvent(new Event("restaurantProfileRefresh"));

      alert(
        "Restaurant reverified successfully! Verification will be done in 24 hours.",
      );
    } catch (error) {
      // Don't log network/timeout errors (backend might be down)
      if (
        error.code !== "ERR_NETWORK" &&
        error.code !== "ECONNABORTED" &&
        !error.message?.includes("timeout")
      ) {
        debugError("Error reverifying restaurant:", error);
      }

      // Handle 401 Unauthorized errors (token expired/invalid)
      if (error.response?.status === 401) {
        const errorMessage =
          error.response?.data?.message ||
          "Your session has expired. Please login again.";
        alert(errorMessage);
        // The axios interceptor should handle redirecting to login
        // But if it doesn't, we can manually redirect
        if (!error.response?.data?.message?.includes("inactive")) {
          // Only redirect if it's not an "inactive" error (which we handle differently)
          setTimeout(() => {
            window.location.href = "/restaurant/login";
          }, 1500);
        }
      } else {
        // Other errors (400, 500, etc.)
        const errorMessage =
          error.response?.data?.message ||
          "Failed to reverify restaurant. Please try again.";
        alert(errorMessage);
      }
    } finally {
      setIsReverifying(false);
    }
  };

  // Lenis smooth scrolling removed as it interferes with flex container scrolling in h-screen layouts
  
  // Enqueue incoming orders as soon as they arrive via Socket.IO.
  useEffect(() => {
    if (!newOrder) return;

    debugLog("?? New order received via Socket.IO:", newOrder);

    const scheduledAt = newOrder.scheduledAt
      ? new Date(newOrder.scheduledAt).getTime()
      : null;
    const isFutureScheduled = scheduledAt && scheduledAt > Date.now() + 15 * 60000;

    // Preserve existing behavior: don't surface far-future scheduled orders immediately.
    if (isFutureScheduled) {
      toast.info(
        `New scheduled order received for ${formatScheduledAtShort(newOrder.scheduledAt) || "later"}`,
      );
      requestOrdersRefresh();
      return;
    }

    if (!hasOrderBeenShown(newOrder)) {
      markOrderAsShown(newOrder);

      const orderId = newOrder.orderMongoId || newOrder.orderId || newOrder._id;
      const orderForQueue = buildIncomingOrderQueueEntry(newOrder);

      useIncomingOrderQueueStore
        .getState()
        .enqueueIncomingOrder(orderForQueue, { ringOnNew: true });

      requestOrdersRefresh();

      // Ensure timer starts (localStorage persistence is used by per-card countdown).
      getInitialCountdown(orderId);
    }
  }, [newOrder]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    newOrderRef.current = newOrder;
  }, [newOrder]);

  // Best-effort unlock for popup buzzer so it can keep playing when tab is backgrounded.
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current || !audioRef.current) return;
      try {
        audioRef.current.muted = true;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioUnlockedRef.current = true;

        // If any incoming order is currently ringing, start buzzing immediately after unlock.
        const hasRingingOrders =
          useIncomingOrderQueueStore
            .getState()
            .orders.some((o) => o.ringing) && !isMutedRef.current;

        if (hasRingingOrders) {
          audioRef.current.loop = true;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } catch (_) {
        audioRef.current.muted = false;
      }
    };

    window.addEventListener("pointerdown", unlockAudio, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const refreshDebounceRef = useRef(null);
  const requestOrdersRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      invalidateRestaurantOrdersCache();
      setOrdersRefreshToken((t) => t + 1);
      refreshDebounceRef.current = null;
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, []);

  // Check for confirmed orders that haven't been shown in popup yet, or scheduled orders whose time has come
  useEffect(() => {
    const checkOrdersToPopup = async () => {
      // Best-effort REST fallback: if Socket.IO missed an incoming order,
      // enqueue it silently without triggering ringtone replay.

      try {
        const response = await fetchRestaurantOrdersShared();
        if (response.data?.success && response.data.data?.orders) {
          const now = Date.now();

          // Find orders that should trigger the popup
          const targetOrders = response.data.data.orders.filter((order) => {
            if (hasOrderBeenShown(order)) return false;

            const status = String(order.status || order.orderStatus || "").toLowerCase();

            // Never Instant-popup while still waiting for BullMQ activation.
            if (status === "scheduled") return false;

            const isConfirmed = status === "confirmed";

            if (isConfirmed && !order.scheduledAt) return true; // ordinary confirmed fallback

            // After PRIMARY/fallback activation → placed. Same Instant popup surface.
            if (order.scheduledAt && status === "placed") {
              return true;
            }

            // Legacy remnant: created/confirmed with scheduledAt near window.
            if (
              order.scheduledAt &&
              (status === "created" || status === "confirmed")
            ) {
              const scheduledTime = new Date(order.scheduledAt).getTime();
              if (scheduledTime <= now + 15 * 60000) return true;
            }

            return false;
          });

          // Enqueue all pending incoming orders (silent).
          for (const orderToPopup of targetOrders) {
            const orderId = orderToPopup.orderId || orderToPopup._id;

            // Transform order to match the queue card UI format (include payment so COD shows correctly)
            const orderForQueue = buildIncomingOrderQueueEntry(orderToPopup);

            debugLog("?? Found order ready for incoming queue (poll):", orderForQueue);
            markOrderAsShown({ orderId, _id: orderToPopup._id });
            useIncomingOrderQueueStore
              .getState()
              .enqueueIncomingOrder(orderForQueue, { ringOnNew: false });
            getInitialCountdown(orderId);
          }
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          debugError("Error checking orders to popup:", error);
        }
      }
    };

    // Check once on mount, and then every minute
    checkOrdersToPopup();
    const intervalId = setInterval(checkOrdersToPopup, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const incomingQueueOrders = useIncomingOrderQueueStore((s) => s.orders);
  const incomingPanelMinimized = useIncomingOrderQueueStore((s) => s.panelMinimized);
  const setIncomingPanelMinimized = useIncomingOrderQueueStore(
    (s) => s.setPanelMinimized,
  );
  const ringPulseCounter = useIncomingOrderQueueStore((s) => s.ringPulseCounter);
  const removeIncomingOrder = useIncomingOrderQueueStore(
    (s) => s.removeIncomingOrder,
  );
  const stopRinging = useIncomingOrderQueueStore((s) => s.stopRinging);

  // Legacy single-popup rendering is disabled; the incoming queue UI above/below
  // is the new source of truth. Kept as a short-circuit so the old JSX parses
  // without affecting runtime behavior.
  const showNewOrderPopup = false;

  const shouldPlayRingtone = incomingQueueOrders.some((o) => o.ringing) && !isMuted;
  const shouldPlayRingtoneRef = useRef(shouldPlayRingtone);

  useEffect(() => {
    shouldPlayRingtoneRef.current = shouldPlayRingtone;
  }, [shouldPlayRingtone]);

  // Play ringtone while there is at least one "ringing" incoming order.
  useEffect(() => {
    if (!audioRef.current) return;

    if (shouldPlayRingtone) {
      audioRef.current.loop = true;
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((err) => debugLog("Audio play failed:", err));
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [shouldPlayRingtone]);

  // Restart sound only when a new order arrives (ring pulse).
  useEffect(() => {
    if (!ringPulseCounter || !shouldPlayRingtone) return;
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current
      .play()
      .catch((err) => debugLog("Audio replay failed:", err));
  }, [ringPulseCounter, shouldPlayRingtone]);

  const handleRejectClick = useCallback((order) => {
    if (!order) return;
    setRejectTarget(order);
    setRejectReason("");
    setShowRejectPopup(true);
  }, []);

  const handleRejectConfirm = async () => {
    if (!rejectReason || rejectInFlightRef.current || isRejectingOrder) return;
    if (!rejectTarget) return;

    const orderId =
      rejectTarget.orderMongoId || rejectTarget.orderId || rejectTarget?._id;
    if (!orderId) return;

    rejectInFlightRef.current = true;
    setIsRejectingOrder(true);

    // Stop ringtone immediately for this specific order.
    stopRinging(rejectTarget);

    try {
      if (rejectTarget?.orderMongoId || rejectTarget?.orderId) {
        await restaurantAPI.rejectOrder(orderId, rejectReason);
        debugLog("? Order rejected:", orderId);
        requestOrdersRefresh();
      }

      clearOrderTimer(orderId);
      removeIncomingOrder(rejectTarget);

      setShowRejectPopup(false);
      setRejectTarget(null);
      setRejectReason("");
    } catch (error) {
      debugError("? Error rejecting order:", error);
      alert("Failed to reject order. Please try again.");
    } finally {
      rejectInFlightRef.current = false;
      setIsRejectingOrder(false);
    }
  };

  const handleRejectCancel = () => {
    if (isRejectingOrder || rejectInFlightRef.current) return;
    setShowRejectPopup(false);
    setRejectTarget(null);
    setRejectReason("");
  };

  // Handle cancel order (for preparing orders)
  const handleCancelClick = useCallback((order) => {
    setOrderToCancel(order);
    setShowCancelPopup(true);
  }, []);

  const handleCancelConfirm = async () => {
    if (
      !cancelReason.trim() ||
      !orderToCancel ||
      cancelInFlightRef.current ||
      isCancellingOrder
    ) {
      return;
    }

    cancelInFlightRef.current = true;
    setIsCancellingOrder(true);

    try {
      const orderId = orderToCancel.mongoId || orderToCancel.orderId;
      await restaurantAPI.rejectOrder(orderId, cancelReason.trim());
      toast.success("Order cancelled successfully");
      requestOrdersRefresh();
      setShowCancelPopup(false);
      setOrderToCancel(null);
      setCancelReason("");
    } catch (error) {
      debugError("? Error cancelling order:", error);
      toast.error(error.response?.data?.message || "Failed to cancel order");
    } finally {
      cancelInFlightRef.current = false;
      setIsCancellingOrder(false);
    }
  };

  const handleCancelPopupClose = () => {
    if (isCancellingOrder || cancelInFlightRef.current) return;
    setShowCancelPopup(false);
    setOrderToCancel(null);
    setCancelReason("");
  };

  // Toggle mute
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (!audioRef.current) return;

    if (next) {
      // Muting: stop immediately.
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      // Unmuting: only play if we actually have ringing orders.
      const hasRingingOrders = useIncomingOrderQueueStore
        .getState()
        .orders.some((o) => o.ringing);

      if (!hasRingingOrders) return;

      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((err) => debugLog("Audio play failed:", err));
    }
  };

  // Handle PDF download
  const handlePrint = async (orderToPrint) => {
    if (!orderToPrint) {
      debugWarn("No order data available for PDF generation");
      return;
    }

    try {
      await generateOrderInvoice(orderToPrint);
      debugLog("? PDF generated successfully");
    } catch (error) {
      debugError("? Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Handle swipe gestures with smooth animations
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true;
      }
    }

    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      return;
    }

    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    const swipeVelocity = Math.abs(swipeDistance);

    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = filterTabs.findIndex(
        (tab) => tab.id === activeFilter,
      );
      let newIndex = currentIndex;

      if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
        // Swipe left - go to next filter (right side)
        newIndex = currentIndex + 1;
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous filter (left side)
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true);

        // Smooth transition with animation
        setTimeout(() => {
          setActiveFilter(filterTabs[newIndex].id);
          scrollToFilter(newIndex);

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
        }, 50);
      }
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
  };

  // Scroll filter bar to show active button with smooth animation
  const scrollToFilter = (index) => {
    if (filterBarRef.current) {
      const buttons = filterBarRef.current.querySelectorAll("button");
      if (buttons[index]) {
        const button = buttons[index];
        const container = filterBarRef.current;
        const buttonLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  };

  // Scroll to active filter on change with smooth animation
  useEffect(() => {
    const index = filterTabs.findIndex((tab) => tab.id === activeFilter);
    if (index >= 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToFilter(index);
      });
    }
  }, [activeFilter]);

  const handleSelectOrder = useCallback((order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  }, []);

  // Incoming panel and mobile order sheet must not stack — sheet left at opacity 0
  // was blocking the whole mobile viewport.
  useEffect(() => {
    if (incomingQueueOrders.length > 0 && !incomingPanelMinimized) {
      setIsSheetOpen(false);
    }
  }, [incomingQueueOrders.length, incomingPanelMinimized]);

  const renderContent = () => {
    switch (activeFilter) {
      case "all":
        return (
          <AllOrders
            onSelectOrder={handleSelectOrder}
            onCancel={handleCancelClick}
            searchQuery={searchQuery}
            refreshToken={ordersRefreshToken}
            socketConnected={isConnected}
          />
        );
      case "preparing":
        return (
          <PreparingOrders
            onSelectOrder={handleSelectOrder}
            onCancel={handleCancelClick}
            refreshToken={ordersRefreshToken}
            onStatusChanged={requestOrdersRefresh}
            searchQuery={searchQuery}
          />
        );
      case "ready":
        return (
          <ReadyOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "out-for-delivery":
        return (
          <OutForDeliveryOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "scheduled":
        return (
          <ScheduledOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      case "completed":
        return (
          <CompletedOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
case "cancelled":
        return (
          <CancelledOrders
            onSelectOrder={handleSelectOrder}
            refreshToken={ordersRefreshToken}
            searchQuery={searchQuery}
          />
        );
      default:
        return <EmptyState />;
    }
  };

    return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 md:bg-slate-50 md:overflow-hidden overflow-x-hidden">
      {/* Restaurant Navbar - Sticky at top (Mobile only) */}
      <div className="sticky top-0 z-50 bg-white md:hidden">
        <RestaurantNavbar 
          showNotifications={true} 
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between px-6 pt-5 pb-3 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Live orders
            {incomingQueueOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setIncomingPanelMinimized(false)}
                className="inline-flex items-center rounded-full bg-[#0D315B] text-white text-xs px-2 py-0.5 font-bold hover:bg-red-600 transition-colors"
                title="Open incoming orders"
              >
                {incomingQueueOrders.length}
                {incomingPanelMinimized ? " · Open" : ""}
              </button>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage incoming and active orders</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, menu..."
            className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-full text-sm w-80 focus:outline-none focus:border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow"
          />
        </div>
      </div>

      {/* Top Filter Bar - Sticky below navbar on mobile, static on desktop */}
      <div className="sticky top-[50px] md:static z-40 pb-2 md:pb-3 bg-gray-100 md:bg-white md:px-6 border-b border-gray-200/50 md:border-gray-100">
        <div
          ref={filterBarRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 md:px-0 py-2 mt-2 md:mt-0"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}>
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {filterTabs.map((tab, index) => {
            const isActive = activeFilter === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true);
                    setActiveFilter(tab.id);
                    scrollToFilter(index);
                    setTimeout(() => setIsTransitioning(false), 300);
                  }
                }}
                className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-[13px] whitespace-nowrap relative overflow-hidden flex items-center gap-2 ${isActive ? "text-white" : "bg-white text-gray-600 border border-gray-100/50 hover:bg-gray-50"
                  }`}
                animate={{
                  scale: isActive ? 1.05 : 1,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                whileTap={{ scale: 0.95 }}>
                {isActive && (
                  <motion.div
                    layoutId="activeFilterBackground"
                    className="absolute inset-0 bg-[#0D315B] rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab.icon && <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isActive ? "text-white" : "text-gray-400"}`} strokeWidth={2.5} />}
                  {tab.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row md:gap-6 px-4 md:px-6 pt-4 md:pt-6 pb-24 md:pb-6 md:overflow-hidden">
        
        {/* Left Column - Scrollable Content */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0 min-h-0 overflow-y-auto content-scroll md:pr-1 overscroll-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => {
            mouseStartX.current = e.clientX;
            mouseEndX.current = e.clientX;
            isMouseDown.current = true;
            isSwiping.current = false;
          }}
          onMouseMove={(e) => {
            if (isMouseDown.current) {
              if (!isSwiping.current) {
                const deltaX = Math.abs(e.clientX - mouseStartX.current);
                if (deltaX > 10) {
                  isSwiping.current = true;
                }
              }
              if (isSwiping.current) {
                mouseEndX.current = e.clientX;
              }
            }
          }}
          onMouseUp={() => {
            if (isMouseDown.current && isSwiping.current) {
              const swipeDistance = mouseStartX.current - mouseEndX.current;
              const minSwipeDistance = 50;

              if (
                Math.abs(swipeDistance) > minSwipeDistance &&
                !isTransitioning
              ) {
                const currentIndex = filterTabs.findIndex(
                  (tab) => tab.id === activeFilter,
                );
                let newIndex = currentIndex;

                if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
                  newIndex = currentIndex + 1;
                } else if (swipeDistance < 0 && currentIndex > 0) {
                  newIndex = currentIndex - 1;
                }

                if (newIndex !== currentIndex) {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setActiveFilter(filterTabs[newIndex].id);
                    scrollToFilter(newIndex);
                    setTimeout(() => setIsTransitioning(false), 300);
                  }, 50);
                }
              }
            }

            isMouseDown.current = false;
            isSwiping.current = false;
            mouseStartX.current = 0;
            mouseEndX.current = 0;
          }}
          onMouseLeave={() => {
            isMouseDown.current = false;
            isSwiping.current = false;
          }}>
          <style>{`
            .content-scroll {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .content-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Verification Pending Card - Show if onboarding is complete (all 4 steps) and restaurant is not active */}
        {!restaurantStatus.isLoading &&
          !restaurantStatus.isActive &&
          restaurantStatus.onboarding?.completedSteps === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`mt-4 mb-4 rounded-2xl shadow-sm px-6 py-4 ${restaurantStatus.rejectionReason
                ? "bg-white border border-red-200"
                : "bg-white border border-yellow-200"
                }`}>
              {restaurantStatus.rejectionReason ? (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 rounded-full p-2 bg-red-100">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-red-600 mb-2">
                        Denied Verification
                      </h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-red-800 mb-2">
                          Reason for Rejection:
                        </p>
                        <div className="text-xs text-red-700 space-y-1">
                          {restaurantStatus.rejectionReason
                            .split("\n")
                            .filter((line) => line.trim()).length > 1 ? (
                            <ul className="space-y-1 list-disc list-inside">
                              {restaurantStatus.rejectionReason
                                .split("\n")
                                .map(
                                  (point, index) =>
                                    point.trim() && (
                                      <li key={index}>{point.trim()}</li>
                                    ),
                                )}
                            </ul>
                          ) : (
                            <p className="text-red-700">
                              {restaurantStatus.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    Please correct the above issues and click "Reverify" to
                    resubmit your request for approval.
                  </p>
                  <button
                    onClick={handleReverify}
                    disabled={isReverifying}
                    className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isReverifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Reverify"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Verification Done in 24 Hours
                  </h3>
                  <p className="text-sm text-gray-600">
                    Your account is under verification. You'll be notified once
                    approved.
                  </p>
                </>
              )}
            </motion.div>
          )}

          <div className="min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop Details Pane (Right Column) */}
        <div className="hidden md:flex flex-col bg-white rounded-2xl border border-gray-100/80 shadow-sm overflow-hidden w-[380px] lg:w-[420px] shrink-0 h-full">
            {selectedOrder ? (
              <div className="flex-1 overflow-hidden h-full">
                <OrderDetails
                  orderId={
                    selectedOrder.mongoId ||
                    selectedOrder.orderMongoId ||
                    selectedOrder.orderId
                  }
                  isSidebar={true}
                  onClose={() => setSelectedOrder(null)}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                <div className="w-20 h-20 bg-slate-50/80 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                  <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No order selected</h3>
                <p className="text-sm text-gray-500 max-w-[250px]">
                  Select an order from the list to view detailed information, items, and status
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={notificationSound}
        preload="auto"
        aria-label="New order notification sound"
      />

      {/* Incoming Orders Queue — non-blocking; Live Orders stays usable underneath */}
      {incomingQueueOrders.length > 0 && (
        <>
          {/*
            Keep cards mounted when minimized so countdown/auto-reject keep running.
            Use `hidden` (not opacity/size animation) so Framer never leaves an
            invisible full-screen hit layer that freezes mobile.
          */}
          <div
            className={
              incomingPanelMinimized
                ? "hidden"
                : "fixed inset-0 z-[200] pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-6"
            }
            aria-hidden={incomingPanelMinimized}
          >
            <div
              className="pointer-events-auto w-full max-w-[100vw] flex flex-col items-stretch drop-shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 px-1 sm:px-2">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-bold tracking-wide bg-black/55 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                    Incoming Orders
                  </span>
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-[#0D315B] text-white text-xs font-bold">
                    {incomingQueueOrders.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 rounded-full bg-black/55 hover:bg-black/70 transition-colors backdrop-blur-sm"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncomingPanelMinimized(true);
                      setIsSheetOpen(false);
                    }}
                    className="px-3 py-2 rounded-full bg-white text-gray-900 text-xs font-bold hover:bg-gray-100 transition-colors shadow-md"
                    aria-label="Go to live orders"
                  >
                    Live orders
                  </button>
                </div>
              </div>

              <div
                className="flex flex-row gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scrollbar-hide max-h-[70vh]"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {incomingQueueOrders.map((entry) => (
                  <IncomingOrderCard
                    key={entry.key}
                    order={entry.order}
                    orderKey={entry.key}
                    defaultPrepMinutes={defaultPrepMinutes}
                    rejectTarget={rejectTarget}
                    showRejectPopup={showRejectPopup}
                    setShowRejectPopup={setShowRejectPopup}
                    setRejectTarget={setRejectTarget}
                    setRejectReason={setRejectReason}
                    requestOrdersRefresh={requestOrdersRefresh}
                    isMuted={isMuted}
                    toggleMute={toggleMute}
                    handlePrint={handlePrint}
                    handleRejectClick={handleRejectClick}
                    rejectInFlightRef={rejectInFlightRef}
                    clearOrderTimer={clearOrderTimer}
                    markOrderAsShown={markOrderAsShown}
                    removeIncomingOrder={removeIncomingOrder}
                    stopRinging={stopRinging}
                  />
                ))}
              </div>
            </div>
          </div>

          {incomingPanelMinimized && (
            <button
              type="button"
              onClick={() => {
                setIncomingPanelMinimized(false);
                setIsSheetOpen(false);
              }}
              className="fixed bottom-20 md:bottom-6 right-4 z-[210] flex items-center gap-2 px-4 py-3 rounded-full bg-[#0D315B] text-white text-sm font-bold shadow-xl hover:bg-red-600 active:scale-95 transition-all"
              aria-label="Open incoming orders"
            >
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white text-[#0D315B] text-xs font-black">
                {incomingQueueOrders.length}
              </span>
              Incoming — Open
            </button>
          )}
        </>
      )}

      {/* New Order Popup */}
      <AnimatePresence>
        {showNewOrderPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}>
              <motion.div
                className="w-full max-w-lg max-h-[90vh] bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header Ribbon */}
                <div className="bg-[#0D315B] px-5 py-4 flex justify-between items-center text-white border-b border-red-600/20">
                  <div>
                    <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                      Incoming Order
                    </p>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {currentPopupOrder?.orderId || "#Order"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
                      aria-label="Print">
                      <Printer className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-white/20 active:scale-95 rounded-full transition-all"
                      aria-label={isMuted ? "Unmute" : "Mute"}>
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-4 pb-3 flex-1 overflow-y-auto min-h-0 bg-gray-50 space-y-3">
                  {/* Scheduled Indicator */}
                  {currentPopupOrder?.scheduledAt && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#0D315B] uppercase tracking-wider">
                          Scheduled Order
                        </p>
                        <p className="text-sm font-bold text-[#0D315B]">
                          For{" "}
                          {formatScheduledAtShort(currentPopupOrder.scheduledAt) ||
                            "Scheduled time"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Customer info & Details */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 tracking-tight">
                          {popupPrimaryItem?.name || "New Order"}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {currentPopupOrder?.createdAt
                            ? new Date(
                              currentPopupOrder.createdAt,
                            ).toLocaleString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : "Just now"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-medium text-gray-500">
                          {popupVisibleItems.length || 0} item
                          {popupVisibleItems.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                      className="w-full flex items-center justify-center py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <span className="text-xs font-semibold text-gray-600 mr-1">
                        {isDetailsExpanded ? "Hide Details" : "View Details"}
                      </span>
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isDetailsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-gray-50/30">
                          <div className="px-3 py-3 space-y-2 border-t border-gray-100">
                            {popupVisibleItems.length > 0 ? popupVisibleItems.map(
                              (item, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${item.isVeg ? "bg-green-500" : "bg-red-500"}`}></div>
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                      <p className="text-xs font-semibold text-gray-900 leading-snug">
                                        {item.quantity} × {item.name}
                                      </p>
                                      <p className="text-xs font-bold text-gray-900 ml-2 shrink-0">
                                        ₹{item.price * item.quantity}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ),
                            ) : (
                              <p className="text-xs text-gray-500 text-center">No items</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Customer note for the kitchen */}
                  {Boolean((popupOrder || newOrder)?.restaurantNote) && (
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                        Note for restaurant
                      </p>
                      <p className="text-sm text-amber-900 whitespace-pre-line break-words">
                        {(popupOrder || newOrder)?.restaurantNote}
                      </p>
                    </div>
                  )}

                  {/* Order Summary & Settings Card */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    {/* Cutlery preference & Payment */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Utensils className={`w-4 h-4 ${(popupOrder || newOrder)?.sendCutlery === false ? "text-red-500" : "text-gray-400"}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${(popupOrder || newOrder)?.sendCutlery === false ? "text-red-600" : "text-gray-600"}`}>
                          {(popupOrder || newOrder)?.sendCutlery === false ? "No Cutlery" : "Send Cutlery"}
                        </span>
                      </div>
                      {(() => {
                        const raw = (popupOrder || newOrder)?.paymentMethod || (popupOrder || newOrder)?.payment?.method;
                        const m = raw != null ? String(raw).toLowerCase().trim() : "";
                        const isCod = m === "cash" || m === "cod";
                        return (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${isCod ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200"}`}>
                            {isCod ? "COD" : "Paid"}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Prep Time Row */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">Prep Time</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button
                          onClick={() => setPrepTime(Math.max(1, prepTime - 1))}
                          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95">
                          <Minus className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-8 text-center">
                          {prepTime}m
                        </span>
                        <button
                          onClick={() => setPrepTime(prepTime + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white hover:bg-gray-100 rounded shadow-sm transition-colors active:scale-95">
                          <Plus className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                      </div>
                    </div>

                    {/* Total bill */}
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-b-xl">
                      <span className="text-sm font-bold text-gray-900">
                        Total Bill
                      </span>
                      <span className="text-lg font-black text-gray-900">
                        ₹{getPopupOrderTotal(popupOrder || newOrder)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="space-y-3">
                    <ActionSlider
                      label={isAcceptingOrder ? "Accepting..." : `Slide to accept (${formatTime(countdown)})`}
                      lockedLabel="Accepting..."
                      onConfirm={handleAcceptOrder}
                      disabled={isAcceptingOrder}
                      color="bg-[#0D315B]"
                      successLabel="Accepted ✓"
                      timeProgress={(countdown / 240) * 100}
                    />

                    <button
                      onClick={() => handleRejectClick(popupOrder || newOrder)}
                      disabled={isAcceptingOrder}
                      className="w-full py-3 bg-white border border-[#0D315B]/20 text-[#0D315B] rounded-xl font-bold text-sm hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      Reject Order
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reject Order Popup */}
      <AnimatePresence>
        {showRejectPopup && (
          <>
            <motion.div
              className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleRejectCancel}>
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Reject Order {rejectTarget?.orderId || rejectTarget?.orderMongoId || "#Order"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Please select a reason for rejecting this order
                  </p>
                </div>

                {/* Content */}
                <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setRejectReason(reason)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${rejectReason === reason
                          ? "border-black bg-black/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                          }`}>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium ${rejectReason === reason
                              ? "text-black"
                              : "text-gray-900"
                              }`}>
                            {reason}
                          </span>
                          {rejectReason === reason && (
                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleRejectCancel}
                    disabled={isRejectingOrder}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason || isRejectingOrder}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      rejectReason && !isRejectingOrder
                      ? "!bg-black !text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}>
                    {isRejectingOrder ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cancel Order Popup */}
      <AnimatePresence>
        {showCancelPopup && orderToCancel && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelPopupClose}>
              <motion.div
                className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Cancel Order {orderToCancel.orderId || "#Order"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Please provide a reason for cancelling this order
                  </p>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                  <div className="space-y-3">
                    {rejectReasons.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setCancelReason(reason)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${cancelReason === reason
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 hover:border-gray-300"
                          }`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${cancelReason === reason
                              ? "border-red-500 bg-red-500"
                              : "border-gray-300"
                              }`}>
                            {cancelReason === reason && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm font-medium ${cancelReason === reason
                              ? "text-red-700"
                              : "text-gray-700"
                              }`}>
                            {reason}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleCancelPopupClose}
                    disabled={isCancellingOrder}
                    className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={!cancelReason || isCancellingOrder}
                    className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                      cancelReason && !isCancellingOrder
                      ? "!bg-red-600 !text-white hover:bg-red-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}>
                    {isCancellingOrder ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Sheet for Order Details */}
      <AnimatePresence>
        {isSheetOpen && selectedOrder && (
          <motion.div
            key="mobile-order-sheet"
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            onClick={() => {
              setIsSheetOpen(false);
            }}>
            <motion.div
              className="w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom)+6rem)] shadow-lg"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}>
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Order #{selectedOrder.orderId}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedOrder.customerName}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {selectedOrder.type}
                    {selectedOrder.tableOrToken
                      ? ` • ${selectedOrder.tableOrToken}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${selectedOrder.status === "Ready"
                      ? "border-green-500 text-green-600"
                      : "border-gray-800 text-gray-900"
                      }`}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${selectedOrder.status === "Ready"
                        ? "bg-green-500"
                        : "bg-gray-800"
                        }`}
                    />
                    {selectedOrder.status}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {selectedOrder.timePlaced}
                  </span>
                  {/* Delivery Resend Button - Only for preparing/ready orders with no partner */}
                  {(String(selectedOrder.status).toLowerCase() === "preparing" ||
                    String(selectedOrder.status).toLowerCase() === "ready") &&
                    !selectedOrder.deliveryPartnerId && (
                      <div className="mt-1">
                        <ResendNotificationButton
                          orderId={selectedOrder.orderId}
                          mongoId={selectedOrder.mongoId}
                          onSuccess={() => setIsSheetOpen(false)}
                        />
                      </div>
                    )}
                </div>
              </div>

              <div className="border-t border-gray-100 my-3" />

              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Items</p>
                <p className="text-xs text-gray-600">
                  {selectedOrder.itemsSummary}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-4">
                {/* Hide ETA for ready orders */}
                {selectedOrder.status !== "ready" && selectedOrder.eta && (
                  <span>
                    ETA:{" "}
                    <span className="font-medium text-black">
                      {selectedOrder.eta}
                    </span>
                  </span>
                )}
                {(() => {
                  const raw = selectedOrder.paymentMethod;
                  const normalized =
                    raw != null ? String(raw).toLowerCase().trim() : "";
                  const isCod = normalized === "cash" || normalized === "cod";
                  return (
                    <span>
                      Payment:{" "}
                      <span
                        className={`font-medium ${isCod ? "text-amber-700" : "text-black"}`}>
                        {isCod ? "Cash on Delivery" : "Paid online"}
                      </span>
                    </span>
                  );
                })()}
              </div>

              {/* Delivery Partner Details in Bottom Sheet */}
              {selectedOrder.deliveryPartnerId && typeof selectedOrder.deliveryPartnerId === 'object' && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">Delivery Partner details</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-[#0D315B]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {selectedOrder.deliveryPartnerId.name}
                        </p>
                        {selectedOrder.deliveryPartnerId.rating > 0 && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-[10px] font-semibold text-gray-600">
                              {selectedOrder.deliveryPartnerId.rating}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200/60 pt-2 flex flex-col gap-1.5">
                      {selectedOrder.deliveryPartnerId.phone === "Hidden until photo upload" || !selectedOrder.deliveryPartnerId.phone ? (
                        <div className="flex items-start gap-2 bg-amber-50/50 border border-amber-200/50 rounded-xl p-2">
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-amber-800">Phone Hidden</p>
                            <p className="text-[9px] text-amber-700 leading-tight mt-0.5">
                              Phone number will be shown once rider arrives at your shop and uploads photo.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-green-50/50 border border-green-200/50 rounded-xl p-2">
                          <div className="flex items-start gap-2">
                            <Unlock className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold text-green-800">Phone Unlocked</p>
                              <p className="text-xs font-bold text-gray-900 mt-0.5">{selectedOrder.deliveryPartnerId.phone}</p>
                            </div>
                          </div>
                          <a
                            href={`tel:${selectedOrder.deliveryPartnerId.phone}`}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#0D315B] text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-[#e04a02] transition-colors shrink-0"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="w-full bg-[#0D315B] hover:bg-[#0A2647] text-white py-2.5 rounded-xl text-sm font-medium"
                onClick={() => setIsSheetOpen(false)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation - Sticky (Mobile only) */}
      <div className="md:hidden">
        <BottomNavOrders />
      </div>
    </div>
  );
}


// Order Card Component
const OrderCard = memo(function OrderCard({
  orderId,
  mongoId,
  status,
  customerName,
  type,
  tableOrToken,
  timePlaced,
  eta,
  itemsSummary,
  paymentMethod,
  photoUrl,
  photoAlt,
  deliveryPartnerId,
  dispatchStatus,
  isFoodQuickDelivery = false,
  deliveryMode,
  onSelect,
  onCancel,
  onMarkReady,
  isMarkingReady = false,
}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const isReady = normalizedStatus === "ready";
  const isPreparing = normalizedStatus === "preparing";
  const statusLabel = String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`w-full bg-white rounded-2xl p-4 mb-3 border shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow relative flex flex-col gap-3 cursor-pointer group ${isFoodQuickDelivery ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-100/80"}`}
      onClick={() =>
        onSelect?.({
          orderId,
          mongoId,
          status,
          customerName,
          type,
          tableOrToken,
          timePlaced,
          eta,
          itemsSummary,
          paymentMethod,
          deliveryPartnerId,
          dispatchStatus,
          isFoodQuickDelivery,
          deliveryMode,
        })
      }>
      
      {/* Top Row: Order ID & Status */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <span className="text-sm font-bold text-gray-900 tracking-tight truncate">
            #{orderId}
          </span>
          {isFoodQuickDelivery && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0">
              Quick · Priority
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${isReady ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
             <span className={`w-1 h-1 rounded-full ${isReady ? "bg-green-500" : "bg-gray-400"}`} />
             {statusLabel}
          </span>
          {isPreparing && onCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel({ orderId, mongoId, customerName });
              }}
              className="p-1 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
              title="Cancel Order">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Content */}
      <div className="flex gap-3">
        {/* Photo */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={photoAlt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-1">
              <span className="text-[9px] font-medium text-gray-400 text-center leading-tight truncate w-full">
                {photoAlt}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">{customerName}</p>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{itemsSummary}</p>
          <p className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-widest truncate">
            {type}{tableOrToken ? ` • ${tableOrToken}` : ""} • {timePlaced}
          </p>
        </div>
      </div>

      {/* Bottom Row: Actions & Assignment */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
          {(isPreparing || isReady || normalizedStatus === "confirmed") && (
            <>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${deliveryPartnerId
                  ? "bg-gray-50 text-gray-500 border border-gray-200"
                  : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${deliveryPartnerId ? "bg-gray-400" : "bg-red-500 animate-pulse"
                    }`}
                />
                {deliveryPartnerId ? "Assigned" : "Not Assigned"}
              </span>
              {dispatchStatus !== "accepted" && (
                <ResendNotificationButton
                  orderId={orderId}
                  mongoId={mongoId}
                  onSuccess={() => {}}
                />
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isReady && eta && (
            <div className="flex flex-col items-end mr-1">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">ETA</span>
              <span className="text-xs font-black text-gray-900 leading-none mt-0.5">{eta}</span>
            </div>
          )}
          {isPreparing && onMarkReady && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkReady({ orderId, mongoId, customerName });
              }}
              disabled={isMarkingReady}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0D315B] hover:bg-red-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm">
              {isMarkingReady ? "Marking..." : "Mark Ready"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Preparing Orders List
function PreparingOrders({
  onSelectOrder,
  onCancel,
  refreshToken = 0,
  onStatusChanged,
  searchQuery = ""
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingReadyOrderIds, setMarkingReadyOrderIds] = useState({});

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'preparing' status on frontend
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'preparing' status only
          // 'confirmed' orders should only appear in popup notification, not in preparing list
          // After accepting, order status changes to 'preparing' and then appears here
          const preparingOrders = response.data.data.orders.filter(
            (order) => order.status === "preparing",
          );

          const transformedOrders = preparingOrders.map((order) => {
            const isFoodQuick =
              String(order.deliveryMode || "").toLowerCase() === "quick";
            const initialETA =
              order.etaPromise?.max || order.estimatedDeliveryTime || 30; // in minutes
            const preparingTimestamp = order.tracking?.preparing?.timestamp
              ? new Date(order.tracking.preparing.timestamp)
              : new Date(order.createdAt); // Fallback to createdAt if preparing timestamp not available

            return {
              orderId: order.orderId || order._id,
              mongoId: order._id || order.orderMongoId || null,
              status: order.status || "preparing",
              customerName: order.userId?.name || "Customer",
              type:
                order.deliveryFleet === "standard"
                  ? "Home Delivery"
                  : "Express Delivery",
              tableOrToken: null,
              timePlaced: new Date(order.createdAt).toLocaleTimeString(
                "en-US",
                { hour: "2-digit", minute: "2-digit" },
              ),
              initialETA, // Store initial ETA in minutes
              preparingTimestamp, // Store when order started preparing
              itemsSummary: buildOrderItemsSummary(order.items),
              photoUrl: getOrderPreviewItem(order.items)?.image || null,
              photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
              deliveryPartnerId: order.deliveryPartnerId || null,
              dispatchStatus: order.dispatch?.status || null,
              paymentMethod:
                order.paymentMethod || order.payment?.method || null,
              deliveryMode: order.deliveryMode || "basic",
              isFoodQuickDelivery: isFoodQuick,
              kitchenPriority: isFoodQuick ? 0 : 1,
              sortTimestamp: preparingTimestamp.getTime(),
            };
          }).sort((a, b) => {
              const quickDiff = (a.kitchenPriority ?? 1) - (b.kitchenPriority ?? 1);
              if (quickDiff !== 0) return quickDiff;
              return (b.sortTimestamp || 0) - (a.sortTimestamp || 0);
            });

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors, 404, or 401 errors
        // 401 is handled by axios interceptor (token refresh/redirect)
        // 404 means no orders found (normal)
        // ERR_NETWORK means backend is down (expected in dev)
        if (
          error.code !== "ERR_NETWORK" &&
          error.response?.status !== 404 &&
          error.response?.status !== 401
        ) {
          debugError("Error fetching preparing orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    // Update countdown every second
    const countdownIntervalId = setInterval(() => {
      // Pause while incoming panel is expanded (not when minimized to Live Orders).
      if (
        useIncomingOrderQueueStore.getState().orders.length > 0 &&
        !useIncomingOrderQueueStore.getState().panelMinimized
      )
        return;
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
      }
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  // Track which orders have been marked as ready to avoid duplicate API calls
  const markedReadyOrdersRef = useRef(new Set());
  const preparingOrdersRef = useRef(orders);
  preparingOrdersRef.current = orders;
  const onStatusChangedRef = useRef(onStatusChanged);
  onStatusChangedRef.current = onStatusChanged;

  // Auto-mark orders as ready when ETA reaches 0.
  // Stable interval — do NOT depend on currentTime (avoids recreate every 1s).
  useEffect(() => {
    if (orders.length === 0) return;

    const checkAndMarkReady = async () => {
      const now = Date.now();
      const currentOrders = preparingOrdersRef.current;

      for (const order of currentOrders) {
        const orderKey = order.mongoId || order.orderId;

        if (markedReadyOrdersRef.current.has(orderKey)) {
          continue;
        }

        const elapsedMs = now - new Date(order.preparingTimestamp).getTime();
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes);

        if (remainingMinutes <= 0 && order.status === "preparing") {
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const totalETASeconds = order.initialETA * 60;

          if (elapsedSeconds >= totalETASeconds - 2) {
            try {
              debugLog(
                `?? Auto-marking order ${order.orderId} as ready (ETA reached 0)`,
              );
              markedReadyOrdersRef.current.add(orderKey);
              await restaurantAPI.markOrderReady(
                order.mongoId || order.orderId,
              );
              debugLog(`? Order ${order.orderId} marked as ready`);
              onStatusChangedRef.current?.();
            } catch (error) {
              const status = error.response?.status;
              const msg = (
                error.response?.data?.message ||
                error.message ||
                ""
              ).toLowerCase();
              if (
                status === 400 &&
                (msg.includes("cannot be marked as ready") ||
                  msg.includes("current status"))
              ) {
                // Already ready — keep key so we don't retry
              } else {
                debugError(
                  `? Failed to auto-mark order ${order.orderId} as ready:`,
                  error,
                );
                markedReadyOrdersRef.current.delete(orderKey);
              }
            }
          }
        }
      }
    };

    checkAndMarkReady();
    // Prep countdown UI ticks at 1s; auto-mark only needs coarse checks.
    const readyCheckInterval = setInterval(checkAndMarkReady, 10000);

    return () => {
      clearInterval(readyCheckInterval);
    };
  }, [orders]);

  // Clear marked orders when orders list changes (orders moved to ready)
  useEffect(() => {
    const currentOrderKeys = new Set(orders.map((o) => o.mongoId || o.orderId));
    // Remove keys that are no longer in the preparing orders list
    for (const key of markedReadyOrdersRef.current) {
      if (!currentOrderKeys.has(key)) {
        markedReadyOrdersRef.current.delete(key);
      }
    }
  }, [orders]);

  const handleMarkReady = async ({ orderId, mongoId, customerName }) => {
    const orderKey = mongoId || orderId;
    if (!orderKey || markingReadyOrderIds[orderKey]) return;

    try {
      setMarkingReadyOrderIds((prev) => ({ ...prev, [orderKey]: true }));
      await restaurantAPI.markOrderReady(orderKey);
      setOrders((prev) =>
        prev.filter((order) => (order.mongoId || order.orderId) !== orderKey),
      );
      toast.success(
        `Order ${orderId} marked ready${customerName ? ` for ${customerName}` : ""}`,
      );
      onStatusChanged?.();
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.message || "Failed to mark order as ready";
      if (
        status === 400 &&
        String(message).toLowerCase().includes("current status")
      ) {
        setOrders((prev) =>
          prev.filter((order) => (order.mongoId || order.orderId) !== orderKey),
        );
        toast.success(`Order ${orderId} is already ready`);
        onStatusChanged?.();
      } else {
        toast.error(message);
      }
    } finally {
      setMarkingReadyOrderIds((prev) => {
        const next = { ...prev };
        delete next[orderKey];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Preparing orders
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Preparing orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders in preparation
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            // Calculate remaining ETA (countdown)
            const elapsedMs = currentTime - order.preparingTimestamp;
            const elapsedMinutes = Math.floor(elapsedMs / 60000);
            const remainingMinutes = Math.max(
              0,
              order.initialETA - elapsedMinutes,
            );

            // Format ETA display
            let etaDisplay = "";
            if (remainingMinutes <= 0) {
              const remainingSeconds = Math.max(
                0,
                Math.floor(order.initialETA * 60 - elapsedMs / 1000),
              );
              if (remainingSeconds > 0) {
                etaDisplay = `${remainingSeconds} secs`;
              } else {
                etaDisplay = "0 mins";
              }
            } else {
              etaDisplay = `${remainingMinutes} mins`;
            }

            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                orderId={order.orderId}
                mongoId={order.mongoId}
                status={order.status}
                customerName={order.customerName}
                type={order.type}
                tableOrToken={order.tableOrToken}
                timePlaced={order.timePlaced}
                eta={etaDisplay}
                itemsSummary={order.itemsSummary}
                photoUrl={order.photoUrl}
                photoAlt={order.photoAlt}
                paymentMethod={order.paymentMethod}
                deliveryPartnerId={order.deliveryPartnerId}
                dispatchStatus={order.dispatchStatus}
                onSelect={onSelectOrder}
                onCancel={onCancel}
                onMarkReady={handleMarkReady}
                isMarkingReady={Boolean(
                  markingReadyOrderIds[order.mongoId || order.orderId],
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Ready Orders List
function ReadyOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'ready' status on frontend
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'ready' status
          const readyOrders = response.data.data.orders.filter(
            (order) => order.status === "ready",
          );

          const transformedOrders = readyOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id || order.orderMongoId || null,
            status: order.status || "ready",
            customerName: order.userId?.name || "Customer",
            type:
              order.deliveryFleet === "standard"
                ? "Home Delivery"
                : "Express Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            eta: null, // Don't show ETA for ready orders
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
            deliveryPartnerId: order.deliveryPartnerId || null,
            dispatchStatus: order.dispatch?.status || null,
          }));

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching ready orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Ready for pickup
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Ready orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders ready
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Out for Delivery Orders List
const OutForDeliveryOrders = ({ onSelectOrder, refreshToken = 0, searchQuery = "" }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'out_for_delivery' status on frontend
        const response = await fetchRestaurantOrdersShared();

        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'out_for_delivery' status
          const outForDeliveryOrders = response.data.data.orders.filter(
            (order) => order.status === "out_for_delivery",
          );

          const transformedOrders = outForDeliveryOrders.map((order) => ({
            orderId: order.orderId || order._id,
            mongoId: order._id || order.orderMongoId || null,
            status: order.status || "out_for_delivery",
            customerName: order.userId?.name || "Customer",
            type:
              order.deliveryFleet === "standard"
                ? "Home Delivery"
                : "Express Delivery",
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            eta: null,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
            deliveryPartnerId: order.deliveryPartnerId || null,
            dispatchStatus: order.dispatch?.status || null,
          }));

          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching out for delivery orders:", error);
        }

        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]); // Re-fetch only when parent requests it

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">
            Out for delivery
          </h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Out for delivery</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} active</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders out for delivery
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId || order.mongoId}
              {...order}
              onSelect={onSelectOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Scheduled Orders List
function ScheduledOrders({ onSelectOrder, refreshToken = 0, searchQuery = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      try {
        const response = await fetchRestaurantOrdersShared();
        if (!isMounted) return;

        if (response.data?.success && response.data.data?.orders) {
          const scheduledOrders = response.data.data.orders.filter(
            (order) =>
              String(order.status || order.orderStatus || "").toLowerCase() ===
              "scheduled",
          );

          const transformedOrders = scheduledOrders.map((order) => {
            const scheduledLabel =
              formatScheduledAtShort(order.scheduledAt) || "Scheduled";
            return {
            orderId: order.orderId || order._id,
            mongoId: order._id || order.orderMongoId || null,
            status: order.status || order.orderStatus || "scheduled",
            customerName: order.userId?.name || "Customer",
            type: order.deliveryFleet === "standard" ? "Home Delivery" : "Express Delivery",
            tableOrToken: null,
            timePlaced: `For: ${scheduledLabel}`,
            scheduledAt: order.scheduledAt,
            itemsSummary: buildOrderItemsSummary(order.items),
            photoUrl: getOrderPreviewItem(order.items)?.image || null,
            photoAlt: getOrderPreviewItem(order.items)?.name || "Order",
            paymentMethod: order.paymentMethod || order.payment?.method || null,
          };
          });

          setOrders(transformedOrders);
        } else {
          setOrders([]);
        }
      } catch (error) {
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error fetching scheduled orders:", error);
        }
        setOrders([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrders();
    // Soft poll only — coalesced with popup fallback via shared cache.
    const interval = setInterval(fetchOrders, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshToken]);

  if (loading) {
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold text-black">Scheduled orders</h2>
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(o.orderId || o.mongoId || "").toLowerCase().includes(q) ||
      String(o.customerName || "").toLowerCase().includes(q) ||
      String(o.itemsSummary || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-black">Scheduled orders</h2>
        <span className="text-xs text-gray-500">{filteredOrders.length} total</span>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 flex flex-col items-center">
          <Calendar className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Scheduled orders will appear here</p>
        </div>
      ) : (
        <div>
          {filteredOrders.map((order) => {
            return (
              <OrderCard
                key={order.orderId || order.mongoId}
                {...order}
                onSelect={onSelectOrder}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Empty State Component
function EmptyState({ message = "Temporarily closed" }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      {/* Store Illustration */}
      <div className="mb-6">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="text-gray-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          {/* Storefront */}
          <rect
            x="40"
            y="80"
            width="120"
            height="80"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Awning */}
          <path
            d="M30 80 L100 50 L170 80"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Doors */}
          <rect
            x="60"
            y="100"
            width="30"
            height="60"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          <rect
            x="110"
            y="100"
            width="30"
            height="60"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
          />
          {/* Laptop */}
          <rect
            x="70"
            y="140"
            width="40"
            height="25"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="white"
          />
          <text
            x="85"
            y="155"
            fontSize="8"
            fill="currentColor"
            textAnchor="middle">
            CLOSED
          </text>
          {/* Sign */}
          <rect
            x="80"
            y="170"
            width="40"
            height="20"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="white"
          />
        </svg>
      </div>

      {/* Message */}
      <h2 className="text-lg font-semibold text-gray-600 mb-4 text-center">
        {message}
      </h2>

      {/* View Status Button */}
      <button className="bg-[#0D315B] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#0A2647] transition-colors">
        View status
      </button>
    </div>
  );
}

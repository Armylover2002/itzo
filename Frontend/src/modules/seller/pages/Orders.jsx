import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineEye,
  HiOutlinePrinter,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineTruck,
  HiOutlineBanknotes,
  HiOutlineClock,
  HiOutlineArchiveBoxXMark,
  HiOutlineChartBar,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineInboxStack,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ProductImage from "@shared/components/ProductImage";
import ReturnItemsDetailList from "@shared/components/returns/ReturnItemsDetailList";

// Orders Page

import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";
import { Loader2 } from "lucide-react";
import Pagination from "@shared/components/ui/Pagination";
import { DatePicker } from "@/components/ui/date-picker";
import {
  joinOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";

const AUTO_REFRESH_INTERVAL_MS = 30000;

const resolveSellerReceivable = (order) => {
  const receivable = Number(order?.pricing?.receivable);
  if (Number.isFinite(receivable)) return receivable;

  const subtotal = Number(order?.pricing?.subtotal);
  const commission = Number(order?.pricing?.commission);
  const couponDiscount = Number(order?.pricing?.couponDiscount || 0);
  const packingFee = Number(order?.pricing?.packingFee || 0);
  if (Number.isFinite(subtotal) && Number.isFinite(commission)) {
    return subtotal - commission - Math.max(0, couponDiscount) + Math.max(0, packingFee);
  }

  const fallback = Number(order?.pricing?.total ?? order?.total);
  return Number.isFinite(fallback) ? fallback : 0;
};

const formatSellerOrderAddress = (address) => {
  if (!address || typeof address !== "object") return "";

  const parts = [
    address.street,
    address.address,
    address.additionalDetails,
    address.landmark,
    address.city,
    address.state,
    address.zipCode || address.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const unique = parts.filter((part, index) => index === 0 || part !== parts[index - 1]);
  return unique.join(", ");
};

const formatMoney = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const OrderMobileCard = React.memo(({
  order,
  handleViewDetails,
  getStatusColor,
  canResendDispatch,
  handleResendDispatch,
  handleStatusUpdate,
  setCancellingOrder,
  setCancelReasonPreset,
  setCancelReason,
  setIsCancelModalOpen,
  formatMoney
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white border border-slate-200/80 rounded-lg p-3 shadow-xs active:bg-slate-50/50">
      <div className="flex items-start justify-between gap-2.5">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => handleViewDetails(order)}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-[#1c1c1e] truncate">
              #{order.id}
            </p>
            <Badge
              variant={
                order.orderType === "mixed"
                  ? "secondary"
                  : "primary"
              }
              className="text-[9px] px-1.5 py-0 font-semibold uppercase tracking-wide">
              {order.orderType}
            </Badge>
          </div>
          <p className="text-[11px] font-normal text-slate-500 mt-1 flex items-center gap-1">
            <HiOutlineCalendarDays className="h-3 w-3 shrink-0 text-slate-400" />
            {order.date} • {order.time}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
              {order.customer.avatar}
            </div>
            <p className="text-xs font-medium text-slate-800 truncate">
              {order.customer.name}
            </p>
          </div>
          <p className="text-[11px] font-normal mt-1.5 text-slate-500">
            {order.deliveryPartner
              ? `${order.dispatchStatus === "accepted" ? "Rider accepted" : "Rider notified"}: ${order.deliveryPartner.name} ${order.deliveryPartner.phone === "Hidden until photo upload" ? "(🔒 Hidden)" : ""}`
              : order.dispatchStatus === "assigned"
                ? "Waiting for acceptance"
                : "No rider assigned"}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-[#1c1c1e] mt-1.5">
            {formatMoney(order.total)}
          </p>
          {order.hasReturn || order.returnStatus ? (
            <p className="text-[10px] font-bold text-amber-700 mt-1 uppercase tracking-wider">
              {order.returnStatusLabel || String(order.returnStatus).replace(/_/g, " ")}
              {Number(order.refundedAmount || 0) > 0
                ? ` · customer refund ₹${Number(order.refundedAmount).toLocaleString("en-IN")}`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant={getStatusColor(order.status)}
            className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-md">
            {order.status.replace(/_/g, " ")}
          </Badge>
          {(order.hasReturn || order.returnStatus) ? (
            <Badge
              variant="secondary"
              className="text-[9px] font-black uppercase px-2 py-0 bg-amber-50 text-amber-700 border-amber-200">
              Return
            </Badge>
          ) : null}
          <button
            onClick={() => handleViewDetails(order)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
            <HiOutlineEye className="h-3.5 w-3.5" />
          </button>
          {canResendDispatch(order) && (
            <button
              onClick={() => handleResendDispatch(order.id)}
              className="px-2 py-1 rounded-md bg-red-50 text-red-600 text-[10px] font-semibold uppercase tracking-wider">
              Resend Rider
            </button>
          )}
        </div>
      </div>
      {/* Accept / Cancel actions for Pending orders on mobile */}
      {order.status.toLowerCase() === "pending" && (
        <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStatusUpdate(order.id, "confirmed");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wider shadow-xs active:scale-95 transition-all">
            <HiOutlineCheck className="h-3.5 w-3.5" />
            Accept Order
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCancellingOrder(order);
              setCancelReasonPreset("Out of stock");
              setCancelReason("");
              setIsCancelModalOpen(true);
            }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold uppercase tracking-wider active:scale-95 transition-all">
            <HiOutlineXMark className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}
    </motion.div>
  );
});
OrderMobileCard.displayName = "OrderMobileCard";

const OrderRow = React.memo(({
  order,
  handleViewDetails,
  getStatusColor,
  canResendDispatch,
  handleResendDispatch,
  handleStatusUpdate,
  setCancellingOrder,
  setCancelReasonPreset,
  setCancelReason,
  setIsCancelModalOpen,
  formatMoney
}) => {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-4 lg:px-6 py-3 lg:py-4">
        <div>
          <span
            className="text-xs font-bold text-slate-900 group-hover:text-red-500 transition-colors cursor-pointer"
            onClick={() => handleViewDetails(order)}>
            #{order.id}
          </span>
          <div className="mt-1">
            <Badge
              variant={
                order.orderType === "mixed"
                  ? "secondary"
                  : "primary"
              }
              className="text-[10px] px-2 py-0 font-black uppercase tracking-wider">
              {order.orderType}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mt-1">
            <HiOutlineCalendarDays className="h-3 w-3" />
            {order.date} • {order.time}
          </div>
        </div>
      </td>
      <td className="px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-2 ring-white">
            {order.customer.avatar}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              {order.customer.name}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 lg:px-6 py-3 lg:py-4">
        {order.deliveryPartner ? (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald-700">
              {order.deliveryPartner.name}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {order.deliveryPartner.phone === "Hidden until photo upload"
                ? "🔒 Phone Hidden"
                : (order.deliveryPartner.phone ||
                  (order.dispatchStatus === "accepted"
                    ? "Accepted"
                    : "Notified"))}
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700">
              {order.dispatchStatus === "assigned"
                ? "Waiting for acceptance"
                : "No driver yet"}
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {order.dispatchStatus.replaceAll("_", " ")}
            </span>
          </div>
        )}
      </td>
      <td className="px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-900">
            {formatMoney(order.total)}
          </span>
          <span className="text-xs font-semibold text-slate-600">
            {order.items.length} items
          </span>
        </div>
      </td>
      <td className="px-4 lg:px-6 py-3 lg:py-4">
        <Badge
          variant={getStatusColor(order.status)}
          className="w-full text-[10px] py-1.5 font-black uppercase tracking-widest justify-center border-none shadow-sm">
          {order.status.replace(/_/g, " ")}
        </Badge>
        {(order.hasReturn || order.returnStatus) ? (
          <p className="mt-1 text-center text-[9px] font-black uppercase tracking-wider text-amber-700">
            {order.returnStatusLabel || String(order.returnStatus).replace(/_/g, " ")}
          </p>
        ) : null}
      </td>
      <td className="px-4 lg:px-6 py-3 lg:py-4 text-right">
        <div className="flex items-center justify-end space-x-1.5 flex-wrap">
          {canResendDispatch(order) && (
            <button
              onClick={() =>
                handleResendDispatch(order.id)
              }
              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-all text-[10px] font-black uppercase tracking-wider">
              Resend Rider
            </button>
          )}
          <button
            onClick={() => handleViewDetails(order)}
            className="p-1.5 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100">
            <HiOutlineEye className="h-4 w-4" />
          </button>
          {order.status === "Pending" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate(
                    order.id,
                    "confirmed",
                  );
                }}
                className="p-1.5 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100">
                <HiOutlineCheck className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCancellingOrder(order);
                  setCancelReasonPreset("Out of stock");
                  setCancelReason("");
                  setIsCancelModalOpen(true);
                }}
                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-slate-600 shadow-sm ring-1 ring-slate-100">
                <HiOutlineXMark className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );
});
OrderRow.displayName = "OrderRow";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isQuickViewModalOpen, setIsQuickViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState("Out of stock");
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const canCancelOrder = useCallback((order) => {
    if (!order) return false;
    const sellerStatus = String(order.status || "").toLowerCase();
    return ["pending", "confirmed", "packed", "ready_for_pickup"].includes(sellerStatus);
  }, []);
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const hasMountedRef = useRef(false);
  const statusHandlerRef = useRef(null);

  const getToken = () =>
    localStorage.getItem("auth_seller") ||
    localStorage.getItem("seller_accessToken") ||
    localStorage.getItem("accessToken") ||
    "";

  useEffect(() => {
    // Live updates for seller room + tracking room events.
    const off = onOrderStatusUpdate(getToken, (payload) => {
      const orderId = String(payload?.orderId || "").trim();
      if (!orderId) return;
      const nextWorkflow = String(
        payload?.sellerWorkflowStatus || payload?.workflowStatus || "",
      ).trim();

      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((order) => {
          if (String(order?.orderId || order?.id || "") === orderId) {
            const updatedOrder = {
              ...order,
              ...(payload?.sellerStatus
                ? { status: payload.sellerStatus }
                : {}),
              ...(payload?.orderStatus ? { status: payload.orderStatus } : {}),
              ...(payload?.sellerWorkflowStatus
                ? { workflowStatus: payload.sellerWorkflowStatus }
                : {}),
              ...(payload?.workflowStatus
                ? { workflowStatus: payload.workflowStatus }
                : {}),
              ...(payload?.deliveredAt
                ? { deliveredAt: payload.deliveredAt }
                : {}),
              ...(payload?.deliveryState
                ? { deliveryState: payload.deliveryState }
                : {}),
              ...(payload?.dispatchStatus
                ? { dispatchStatus: payload.dispatchStatus }
                : {}),
              ...(payload?.deliveryPartner !== undefined
                ? { deliveryPartner: payload.deliveryPartner }
                : {}),
            };
            return {
              ...updatedOrder,
              status: getLegacyStatusFromOrder(updatedOrder),
            };
          }
          return order;
        }),
      );

      setSelectedOrder((prev) => {
        if (!prev || String(prev?.orderId || prev?.id || "") !== orderId)
          return prev;
        const updatedOrder = {
          ...prev,
          ...(payload?.sellerStatus ? { status: payload.sellerStatus } : {}),
          ...(payload?.orderStatus ? { status: payload.orderStatus } : {}),
          ...(payload?.sellerWorkflowStatus
            ? { workflowStatus: payload.sellerWorkflowStatus }
            : {}),
          ...(payload?.workflowStatus
            ? { workflowStatus: payload.workflowStatus }
            : {}),
          ...(payload?.deliveredAt ? { deliveredAt: payload.deliveredAt } : {}),
          ...(payload?.deliveryState
            ? { deliveryState: payload.deliveryState }
            : {}),
          ...(payload?.dispatchStatus
            ? { dispatchStatus: payload.dispatchStatus }
            : {}),
          ...(payload?.deliveryPartner !== undefined
            ? { deliveryPartner: payload.deliveryPartner }
            : {}),
        };
        return {
          ...updatedOrder,
          status: getLegacyStatusFromOrder(updatedOrder),
        };
      });
    });
    statusHandlerRef.current = off;
    return () => {
      if (typeof statusHandlerRef.current === "function")
        statusHandlerRef.current();
      statusHandlerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = useCallback(async (
    requestedPage = 1,
    showPageLoader = false,
    { forceRefresh = false } = {},
  ) => {
    try {
      if (showPageLoader) {
        setLoading(true);
      }
      const params = { page: requestedPage, limit: pageSize };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await sellerApi.getOrders(params, { forceRefresh });

      // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
      const payload = response.data.result || response.data.data || {};
      const rawOrders = Array.isArray(payload.orders)
        ? payload.orders
        : Array.isArray(payload.items)
          ? payload.items
          : response.data.results || [];

      const formattedOrders = (rawOrders || []).map((order) => ({
        id: order.orderId,
        _id: order._id,
        orderId: order.orderId,
        customer: {
          name: order.customer?.name || "Unknown",
          phone: order.customer?.phone || "",
          avatar: (order.customer?.name || "U").charAt(0),
        },
        items: (order.items || []).map((item) => ({
          name: item.name,
          price: item.price,
          qty: item.quantity,
          image: item.image || item.mainImage || "",
          mainImage: item.mainImage || item.image || "",
          variantName: item.variantName || item.notes || "",
        })),
        total: resolveSellerReceivable(order),
        pricing: {
          subtotal: Number(order.pricing?.subtotal || 0),
          commission: Number(order.pricing?.commission || 0),
          packingFee: Number(order.pricing?.packingFee || 0),
          couponDiscount: Number(order.pricing?.couponDiscount || 0),
          productEarnings: Number(order.pricing?.productEarnings || 0),
          total: Number(order.pricing?.total || 0),
          receivable: resolveSellerReceivable(order),
        },
        orderType: String(order.orderType || "quick").toLowerCase(),
        status: getLegacyStatusFromOrder(order),
        workflowStatus: order.workflowStatus,
        workflowVersion: order.workflowVersion,
        date: order.createdAt
          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
          : "",
        time: order.createdAt
          ? new Date(order.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "",
        address: formatSellerOrderAddress(order.deliveryAddress || order.address),
        location: (order.deliveryAddress || order.address)?.location || null,
        dispatchStatus: String(
          order.dispatchStatus || "unassigned",
        ).toLowerCase(),
        deliveryPartner: order.deliveryPartner
          ? {
            name: order.deliveryPartner.name || "Delivery Partner",
            phone: order.deliveryPartner.phone || "",
            vehicleType: order.deliveryPartner.vehicleType || "",
            vehicleNumber: order.deliveryPartner.vehicleNumber || "",
          }
          : null,
        payment:
          order.payment?.method === "cash" || order.payment?.method === "cod"
            ? "Cash on Delivery"
            : "Online Paid",
        cancellationReason: order.cancellationReason || "",
        statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
        returnStatus: order.returnStatus || "",
        returnStatusLabel: order.returnStatusLabel || "",
        refundStatus: order.returnSummary?.refundStatus || order.refundStatus || "",
        refundStatusLabel: order.returnSummary?.refundStatusLabel || "",
        hasReturn: Boolean(order.hasReturn || order.returnStatus),
        returnSummary: order.returnSummary || null,
        originalPaidTotal: Number(order.originalPaidTotal || 0),
        refundedAmount: Number(order.refundedAmount || 0),
        netAfterReturn: Number(order.netAfterReturn || 0),
        createdAt: order.createdAt || null,
        updatedAt: order.updatedAt || null,
      }));

      setOrders(formattedOrders);

      // Join tracking rooms for real-time updates
      formattedOrders.forEach((o) => {
        if (o.id) joinOrderRoom(o.id, getToken);
      });
      if (typeof payload.total === "number") {
        setTotal(payload.total);
      } else if (typeof payload.pagination?.total === "number") {
        setTotal(payload.pagination.total);
      } else {
        setTotal(rawOrders.length);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      showToast("Failed to fetch orders", "error");
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  }, [pageSize, startDate, endDate, showToast]);

  // Auto-refresh fallback (like Admin) — forceRefresh bypasses short TTL cache
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (hasMountedRef.current) {
        fetchOrders(page, false, { forceRefresh: true });
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [page, pageSize, startDate, endDate, fetchOrders]);

  // Reactive load: one fetch per page / pageSize / date-filter change
  useEffect(() => {
    fetchOrders(page, !hasMountedRef.current).finally(() => {
      hasMountedRef.current = true;
    });
  }, [page, pageSize, startDate, endDate, fetchOrders]);

  const tabs = [
    "All",
    "Pending",
    "Confirmed",
    "Packed",
    "Ready for Pickup",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];
  const todayStr = new Date().toISOString().split("T")[0];

  const safeOrders = useMemo(
    () => (Array.isArray(orders) ? orders : []),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    return safeOrders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase());
      const statusToMatch =
        activeTab === "Out for Delivery"
          ? "out_for_delivery"
          : activeTab === "Ready for Pickup"
            ? "ready_for_pickup"
            : activeTab.toLowerCase();
      const matchesTab =
        activeTab === "All" || order.status.toLowerCase() === statusToMatch;
      return matchesSearch && matchesTab;
    });
  }, [safeOrders, searchTerm, activeTab]);

  const stats = useMemo(
    () => [
      {
        label: "Total Orders",
        value: safeOrders.length,
        icon: HiOutlineArchiveBoxXMark,
        iconColor: "text-rose-700",
        iconBg: "bg-rose-100/80",
        cardBg: "bg-[#FEF2F2] border-rose-200/60 hover:border-rose-300/80 shadow-xs",
        tab: "All",
      },
      {
        label: "Pending",
        value: safeOrders.filter((o) => o.status.toLowerCase() === "pending")
          .length,
        icon: HiOutlineClock,
        iconColor: "text-amber-700",
        iconBg: "bg-amber-100/80",
        cardBg: "bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80 shadow-xs",
        tab: "Pending",
      },
      {
        label: "Confirmed",
        value: safeOrders.filter((o) => o.status.toLowerCase() === "confirmed")
          .length,
        icon: HiOutlineCheck,
        iconColor: "text-purple-700",
        iconBg: "bg-purple-100/80",
        cardBg: "bg-[#F5F3FF] border-purple-200/60 hover:border-purple-300/80 shadow-xs",
        tab: "Confirmed",
      },
      {
        label: "Delivered",
        value: safeOrders.filter((o) => o.status.toLowerCase() === "delivered")
          .length,
        icon: HiOutlineCheck,
        iconColor: "text-emerald-700",
        iconBg: "bg-emerald-100/80",
        cardBg: "bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80 shadow-xs",
        tab: "Delivered",
      },
    ],
    [safeOrders],
  );

  const getStatusColor = useCallback((status) => {
    const s = status.toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "ready_for_pickup":
        return "info";
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  }, []);

  const handleViewDetails = useCallback((order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  }, []);

  const handleStatusUpdate = useCallback(async (orderId, newStatus) => {
    try {
      await sellerApi.updateOrderStatus(orderId, {
        status: newStatus.toLowerCase(),
      });
      const normalizedStatus = String(newStatus || "").toLowerCase();

      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((order) =>
          order.id === orderId
            ? {
              ...order,
              status: normalizedStatus,
            }
            : order,
        ),
      );

      setSelectedOrder((prev) => {
        if (prev && prev.id === orderId)
          return { ...prev, status: normalizedStatus };
        return prev;
      });

      const nextTabLabel =
        normalizedStatus === "out_for_delivery"
          ? "Out for Delivery"
          : normalizedStatus
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

      setActiveTab((prevTab) => {
        if (prevTab !== "All" && prevTab !== nextTabLabel) {
          return nextTabLabel;
        }
        return prevTab;
      });

      showToast(`Order status updated to ${nextTabLabel}`, "success");
      fetchOrders(page, false, { forceRefresh: true });
    } catch (error) {
      console.error("Failed to update status:", error);
      showToast("Failed to update status", "error");
    }
  }, [page, fetchOrders, showToast]);

  const handleResendDispatch = useCallback(async (orderId) => {
    try {
      const response = await sellerApi.resendOrderDispatch(orderId);
      const partner = response?.data?.result?.notifiedPartner;
      setSelectedOrder((prev) =>
        prev && prev.id === orderId
          ? {
            ...prev,
            dispatchStatus: "assigned",
            deliveryPartner: null,
          }
          : prev,
      );
      showToast(
        partner?.name
          ? `Sent again to ${partner.name}`
          : "Driver notification sent again",
        "success",
      );
      fetchOrders(page, false, { forceRefresh: true });
    } catch (error) {
      console.error("Failed to resend dispatch:", error);
      showToast(
        error?.response?.data?.message ||
        "Failed to resend driver notification",
        "error",
      );
    }
  }, [page, fetchOrders, showToast]);

  const canResendDispatch = useCallback((order) => {
    const sellerStatus = String(order?.status || "").toLowerCase();
    const dispatchStatus = String(order?.dispatchStatus || "").toLowerCase();

    if (order?.deliveryPartner && dispatchStatus === "accepted") return false;
    if (["delivered", "cancelled"].includes(sellerStatus)) return false;

    return ["confirmed", "packed", "out_for_delivery"].includes(sellerStatus);
  }, []);

  const exportOrders = () => {
    const data = filteredOrders;
    if (!data.length) {
      showToast("No orders to export", "warning");
      return;
    }
    const escapeCsv = (v) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const headers = [
      "Order ID",
      "Customer",
      "Phone",
      "Date",
      "Time",
      "Receivable",
      "Status",
      "Address",
      "Payment",
    ];
    const rows = data.map((o) => [
      o.id,
      o.customer?.name ?? "",
      o.customer?.phone ?? "",
      o.date,
      o.time,
      o.total,
      o.status,
      o.address ?? "",
      o.payment ?? "",
    ]);
    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${data.length} order(s) as CSV`, "success");
  };

  return (
    <div className="flex flex-col gap-4 px-3 md:px-4 pb-20 max-w-7xl md:max-w-none mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-0.5">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex flex-wrap items-center gap-2">
            Order Management
            <Badge
              variant="primary"
              className="text-[10px] px-2 py-0.5 font-medium tracking-wide uppercase bg-red-100/80 text-red-700 border-red-200">
              Real-time
            </Badge>
          </h1>
          <p className="text-xs font-normal text-slate-500 mt-0.5">
            Process and track your customer orders with ease.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportOrders}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs transition-all cursor-pointer">
            <HiOutlinePrinter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium">Export</span>
          </button>
          <button
            onClick={() => setIsQuickViewModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50/80 hover:bg-red-100 border border-red-200/80 shadow-xs transition-all cursor-pointer">
            <HiOutlineEye className="h-4 w-4 text-red-600" />
            <span className="text-xs font-semibold">Quick View</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      {loading ? (
        <div className="min-h-[200px] flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
          <p className="text-slate-500 font-medium mt-2 text-xs">
            Fetching Active Orders...
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {stats.map((stat, i) => (
              <div
                key={i}
                onClick={() => setActiveTab(stat.tab)}
                className={cn(
                  "rounded-lg sm:rounded-xl border p-2 sm:p-2.5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-2.5 active:scale-[0.98]",
                  stat.cardBg
                )}>
                <div className={cn("rounded-md p-1.5 shrink-0 flex items-center justify-center shadow-xs", stat.iconBg)}>
                  <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate tracking-tight">{stat.label}</p>
                  <p className="text-sm sm:text-base font-semibold tracking-tight text-[#1c1c1e] truncate leading-tight mt-0.5">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Tabs Bar */}
            <div className="border-b border-slate-200/60 bg-slate-50/50 overflow-x-auto scrollbar-hide">
              <div className="flex px-2 sm:px-4 items-center min-w-max">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative py-2.5 px-3 text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                      activeTab === tab
                        ? "text-red-600 font-semibold"
                        : "text-slate-600 hover:text-slate-900",
                    )}>
                    {tab}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="tab-underline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full mx-2"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbox */}
            <div className="p-2.5 sm:p-3 border-b border-slate-200/60 flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between bg-slate-50/20">
              <div className="relative flex-1 group w-full">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-red-500 transition-all" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by Order ID or Customer Name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
                <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                  <div className="w-full sm:w-32">
                    <DatePicker
                      value={startDate}
                      max={todayStr}
                      align="left"
                      onChange={(value) => {
                        if (!value) {
                          setStartDate("");
                          setPage(1);
                          return;
                        }
                        const today = new Date().toISOString().split("T")[0];
                        if (value > today) {
                          showToast(
                            "Start date cannot be in the future",
                            "error",
                          );
                          return;
                        }
                        if (endDate && value > endDate) {
                          showToast(
                            "Start date cannot be after end date",
                            "error",
                          );
                          return;
                        }
                        setPage(1);
                        setStartDate(value);
                      }}
                      placeholder="From date"
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <DatePicker
                      value={endDate}
                      max={todayStr}
                      min={startDate || undefined}
                      align="right"
                      popupClassName="mt-4"
                      disabled={!startDate}
                      onChange={(value) => {
                        if (!value) {
                          setEndDate("");
                          setPage(1);
                          return;
                        }
                        const today = new Date().toISOString().split("T")[0];
                        if (value > today) {
                          showToast(
                            "End date cannot be in the future",
                            "error",
                          );
                          return;
                        }
                        if (startDate && value < startDate) {
                          showToast(
                            "End date cannot be before start date",
                            "error",
                          );
                          return;
                        }
                        setPage(1);
                        setEndDate(value);
                      }}
                      placeholder="To date"
                    />
                  </div>
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setPage(1);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors self-end sm:self-center py-1">
                    Clear dates
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: Card list */}
            <div className="md:hidden p-2.5 sm:p-4 space-y-2.5">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 px-4">
                  <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 mb-2 border border-slate-100">
                    <HiOutlineInboxStack className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-semibold text-[#1c1c1e]">
                    No orders found
                  </h3>
                  <p className="text-xs text-slate-500 font-normal text-center mt-0.5">
                    Adjust filters or search.
                  </p>
                  <button
                    className="mt-2.5 px-3 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs"
                    onClick={() => {
                      setActiveTab("All");
                      setSearchTerm("");
                      setStartDate("");
                      setEndDate("");
                    }}>
                    Clear filters
                  </button>
                </div>
              ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredOrders
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((order) => (
                        <OrderMobileCard
                          key={order.id}
                          order={order}
                          handleViewDetails={handleViewDetails}
                          getStatusColor={getStatusColor}
                          canResendDispatch={canResendDispatch}
                          handleResendDispatch={handleResendDispatch}
                          handleStatusUpdate={handleStatusUpdate}
                          setCancellingOrder={setCancellingOrder}
                          setCancelReasonPreset={setCancelReasonPreset}
                          setCancelReason={setCancelReason}
                          setIsCancelModalOpen={setIsCancelModalOpen}
                          formatMoney={formatMoney}
                        />
                      ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/60">
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700">
                        Order Details
                      </th>
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700">
                        Customer
                      </th>
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700">
                        Driver
                      </th>
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700">
                        Receivable
                      </th>
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-2.5 text-xs font-semibold text-slate-700 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {filteredOrders
                        .slice((page - 1) * pageSize, page * pageSize)
                        .map((order) => (
                          <OrderRow
                            key={order.id}
                            order={order}
                            handleViewDetails={handleViewDetails}
                            getStatusColor={getStatusColor}
                            canResendDispatch={canResendDispatch}
                            handleResendDispatch={handleResendDispatch}
                            handleStatusUpdate={handleStatusUpdate}
                            setCancellingOrder={setCancellingOrder}
                            setCancelReasonPreset={setCancelReasonPreset}
                            setCancelReason={setCancelReason}
                            setIsCancelModalOpen={setIsCancelModalOpen}
                            formatMoney={formatMoney}
                          />
                        ))}
                    </AnimatePresence>
                  </tbody>
                </table>
                {filteredOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
                      <HiOutlineInboxStack className="h-6 w-6" />
                    </div>
                    <h3 className="text-xs font-semibold text-[#1c1c1e]">
                      No orders found
                    </h3>
                    <p className="text-xs text-slate-500 font-normal max-w-xs text-center mt-1">
                      We couldn't find any orders matching your current filters.
                    </p>
                    <button
                      className="mt-4 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50"
                      onClick={() => {
                        setActiveTab("All");
                        setSearchTerm("");
                      }}>
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              <div className="p-2.5 sm:p-3 border-t border-slate-200/60 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 sm:px-4">
                <p className="text-xs font-medium text-slate-600 text-center sm:text-left">
                  Showing {filteredOrders.length} of {orders.length} Orders
                </p>
              </div>
            </div>

          <div className="mt-3 sm:mt-4 px-2 sm:px-0">
            <Pagination
              page={page}
              totalPages={
                Math.ceil((total || filteredOrders.length) / pageSize) || 1
              }
              total={total || filteredOrders.length}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              loading={loading}
            />
          </div>
        </>
      )}

          {/* Order Details Modal */}
          {/* ... (existing details modal) */}

          {/* Quick View Summary Modal */}
          <AnimatePresence>
            {isQuickViewModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                  onClick={() => setIsQuickViewModalOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-lg relative z-10 bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
                        <HiOutlineChartBar className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                          Quick Snapshot
                        </h3>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                          Today's Performance
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsQuickViewModalOpen(false)}
                      className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 shrink-0">
                      <HiOutlineXMark className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 rounded-2xl bg-red-50 border border-red-100">
                        <p className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-widest mb-1">
                          Total Revenue
                        </p>
                        <p className="text-base sm:text-xl font-black text-red-700 truncate">
                          ₹
                          {safeOrders
                            .reduce((acc, o) => acc + o.total, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
                          Avg. Order Value
                        </p>
                        <p className="text-base sm:text-xl font-black text-emerald-700">
                          ₹
                          {safeOrders.length
                            ? (
                              safeOrders.reduce(
                                (acc, o) => acc + o.total,
                                0,
                              ) / safeOrders.length
                            ).toFixed(0)
                            : "0"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100">
                    <Button
                      onClick={() => {
                        setIsQuickViewModalOpen(false);
                        setActiveTab("Pending");
                      }}
                      className="w-full py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold">
                      VIEW ALL PENDING ORDERS
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isDetailsModalOpen && selectedOrder && (
              <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-3 sm:p-6 lg:p-12">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                  onClick={() => setIsDetailsModalOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                        <HiOutlineTruck className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          Order Details
                        </h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <Badge
                            variant={getStatusColor(selectedOrder.status)}
                            className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0">
                            {selectedOrder.status}
                          </Badge>
                          {(selectedOrder.hasReturn || selectedOrder.returnStatus) ? (
                            <Badge className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                              {selectedOrder.returnStatusLabel ||
                                String(selectedOrder.returnStatus || "Return").replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                            #{selectedOrder.id}
                          </span>
                        </div>
                        {(selectedOrder.date || selectedOrder.time) && (
                          <p className="text-[11px] font-bold text-slate-500 mt-1.5 flex items-center gap-1.5">
                            <HiOutlineCalendarDays className="h-3.5 w-3.5" />
                            {selectedOrder.date}
                            {selectedOrder.time && (
                              <>
                                <span className="text-slate-300">•</span>
                                <HiOutlineClock className="h-3.5 w-3.5" />
                                {selectedOrder.time}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setIsDetailsModalOpen(false)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                      <HiOutlineXMark className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto scrollbar-hide flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                              <HiOutlineMapPin className="h-3 w-3 text-red-500" />{" "}
                              Delivery Address
                            </h4>
                            {selectedOrder.location &&
                              typeof selectedOrder.location.lat === "number" &&
                              typeof selectedOrder.location.lng ===
                              "number" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const { lat, lng } = selectedOrder.location;
                                    window.open(
                                      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                                      "_blank",
                                    );
                                  }}
                                  className="text-[10px] font-bold text-red-500 hover:underline">
                                  View on map
                                </button>
                              )}
                          </div>
                          <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm whitespace-normal break-words">
                            {selectedOrder.address || "Address not available"}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <HiOutlinePhone className="h-3 w-3 text-emerald-500" />{" "}
                            Customer Info
                          </h4>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-xs font-bold text-slate-800">
                              {selectedOrder.customer.name}
                            </p>
                          </div>
                        </div>
                        {String(selectedOrder.status || "").toLowerCase().includes("cancel") &&
                          selectedOrder.cancellationReason ? (
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 sm:p-4">
                            <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2">
                              Cancellation Reason
                            </h4>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                              {selectedOrder.cancellationReason}
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <HiOutlineTruck className="h-3 w-3 text-red-500" />{" "}
                            Driver Status
                          </h4>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                            {selectedOrder.deliveryPartner ? (
                              <>
                                <p className="text-xs font-bold text-slate-800">
                                  {selectedOrder.deliveryPartner.name}
                                </p>
                                {selectedOrder.deliveryPartner.phone === "Hidden until photo upload" ? (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200/50 rounded-xl flex flex-col gap-1 text-[10px] text-amber-800 font-medium">
                                    <span className="font-bold flex items-center gap-1">🔒 Phone Hidden</span>
                                    <span>Rider phone will be visible once they arrive at your shop and upload the photo.</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs font-semibold text-slate-700">
                                      {selectedOrder.deliveryPartner.phone ||
                                        (selectedOrder.dispatchStatus === "accepted"
                                          ? "Accepted rider"
                                          : "Notified rider")}
                                    </p>
                                    {selectedOrder.deliveryPartner.phone && (
                                      <a
                                        href={`tel:${selectedOrder.deliveryPartner.phone}`}
                                        className="text-xs text-red-500 hover:underline font-bold flex items-center gap-0.5 ml-1"
                                      >
                                        Call Rider
                                      </a>
                                    )}
                                  </div>
                                )}
                                {selectedOrder.deliveryPartner.vehicleType && (
                                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                                    {selectedOrder.deliveryPartner.vehicleType}{" "}
                                    {selectedOrder.deliveryPartner.vehicleNumber
                                      ? `• ${selectedOrder.deliveryPartner.vehicleNumber}`
                                      : ""}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs font-bold text-slate-600">
                                {selectedOrder.dispatchStatus === "assigned"
                                  ? "Closest rider notified. Waiting for acceptance."
                                  : "No rider has accepted yet."}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        <div className="bg-red-500/5 p-3 sm:p-4 rounded-3xl border border-red-500/10">
                          <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-3">
                            Order Summary
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600">
                                Product Amount
                              </span>
                              <span className="font-black text-slate-900">
                                {formatMoney(selectedOrder.pricing?.subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600">
                                Admin Commission
                              </span>
                              <span className="font-black text-rose-600">
                                -{formatMoney(selectedOrder.pricing?.commission)}
                              </span>
                            </div>
                            {Number(selectedOrder.pricing?.couponDiscount || 0) > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-slate-600">
                                  Seller Coupon Discount
                                </span>
                                <span className="font-black text-rose-600">
                                  -{formatMoney(selectedOrder.pricing?.couponDiscount)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600">
                                Seller Product Earnings
                              </span>
                              <span className={cn(
                                "font-black",
                                Number(selectedOrder.pricing?.productEarnings ?? 0) < 0
                                  ? "text-rose-600"
                                  : "text-emerald-700",
                              )}>
                                {formatMoney(
                                  Number(
                                    selectedOrder.pricing?.productEarnings ??
                                      (Number(selectedOrder.pricing?.receivable || 0) -
                                        Number(selectedOrder.pricing?.packingFee || 0))
                                  ),
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600">
                                Packing Fee
                              </span>
                              <span className="font-black text-emerald-700">
                                +{formatMoney(selectedOrder.pricing?.packingFee)}
                              </span>
                            </div>
                            <div className="h-px bg-red-500/10 my-2" />
                            <div className="flex justify-between text-sm">
                              <span className="font-black text-slate-900">
                                Total Seller Earnings
                              </span>
                              <span className={cn(
                                "font-black",
                                Number(selectedOrder.pricing?.receivable || 0) < 0
                                  ? "text-rose-600"
                                  : "text-red-500",
                              )}>
                                {formatMoney(selectedOrder.pricing?.receivable)}
                              </span>
                            </div>
                            {(selectedOrder.hasReturn || Number(selectedOrder.refundedAmount || 0) > 0) ? (
                              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                                  After return
                                </p>
                                {(selectedOrder.refundStatusLabel || selectedOrder.refundStatus) ? (
                                  <p className="text-[10px] font-bold text-emerald-700">
                                    Refund status:{" "}
                                    {selectedOrder.refundStatusLabel ||
                                      String(selectedOrder.refundStatus).replace(/_/g, " ")}
                                  </p>
                                ) : null}
                                <div className="flex justify-between text-xs">
                                  <span className="font-bold text-slate-600">Customer paid</span>
                                  <span className="font-black text-slate-800">
                                    {formatMoney(selectedOrder.originalPaidTotal || selectedOrder.pricing?.total)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="font-bold text-rose-600">Customer refunded</span>
                                  <span className="font-black text-rose-600">
                                    -{formatMoney(selectedOrder.refundedAmount)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="font-black text-amber-800">Customer net</span>
                                  <span className="font-black text-amber-800">
                                    {formatMoney(selectedOrder.netAfterReturn)}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="bg-slate-900 p-3 sm:p-4 rounded-3xl text-white shadow-xl shadow-red-500/20">
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                            Payment Status
                          </h4>
                          <div className="flex items-center gap-2">
                            <HiOutlineBanknotes className="h-5 w-5 text-emerald-400" />
                            <span className="text-xs font-bold tracking-tight">
                              {selectedOrder.payment}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 sm:mb-4">
                      Order Status History
                    </h4>
                    <div className="mb-5 sm:mb-6 bg-slate-50 rounded-2xl border border-slate-100 p-4">
                      <div className="relative ml-2">
                        <div className="absolute top-1 bottom-1 left-[5px] w-0.5 bg-slate-200" />
                        <div className="space-y-4">
                          {(Array.isArray(selectedOrder.statusHistory) && selectedOrder.statusHistory.length > 0
                            ? selectedOrder.statusHistory
                            : [
                                {
                                  to: selectedOrder.status || "placed",
                                  at: selectedOrder.createdAt,
                                  byRole: "SYSTEM",
                                  note: "Order recorded",
                                },
                              ]
                          ).map((entry, index) => {
                            const toStatus = String(entry?.to || entry?.status || selectedOrder.status || "").toLowerCase();
                            const isCancel = toStatus.includes("cancel") || toStatus.includes("reject");
                            const label = toStatus
                              ? toStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                              : "Updated";
                            const when = entry?.at || entry?.createdAt || selectedOrder.updatedAt || selectedOrder.createdAt;
                            const whenLabel = when
                              ? new Date(when).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—";
                            return (
                              <div key={`${toStatus}-${index}`} className="relative flex gap-3">
                                <div
                                  className={cn(
                                    "mt-1 h-3 w-3 rounded-full ring-4 ring-slate-50 z-10",
                                    isCancel ? "bg-rose-500" : "bg-emerald-500",
                                  )}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-black text-slate-900">{label}</p>
                                    <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{whenLabel}</p>
                                  </div>
                                  {(entry?.byRole || entry?.note) && (
                                    <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                      {entry?.byRole ? `${entry.byRole}` : ""}
                                      {entry?.byRole && entry?.note ? " • " : ""}
                                      {entry?.note || ""}
                                    </p>
                                  )}
                                  {entry?.from && entry?.to && entry.from !== entry.to ? (
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      From {String(entry.from).replace(/_/g, " ")} to{" "}
                                      {String(entry.to).replace(/_/g, " ")}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {(selectedOrder.hasReturn || selectedOrder.returnSummary?.hasReturn) ? (
                      <>
                        <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 sm:mb-4">
                          Return & Refund History
                        </h4>
                        <div className="mb-5 sm:mb-6 bg-amber-50/60 rounded-2xl border border-amber-100 p-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 border-amber-200">
                              {selectedOrder.returnStatusLabel ||
                                String(selectedOrder.returnStatus || "Return").replace(/_/g, " ")}
                            </Badge>
                            {(selectedOrder.refundStatusLabel || selectedOrder.refundStatus) ? (
                              <Badge className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
                                {selectedOrder.refundStatusLabel ||
                                  String(selectedOrder.refundStatus).replace(/_/g, " ")}
                              </Badge>
                            ) : null}
                            {Number(selectedOrder.refundedAmount || 0) > 0 ? (
                              <span className="text-[11px] font-black text-rose-600">
                                Refunded {formatMoney(selectedOrder.refundedAmount)}
                              </span>
                            ) : null}
                          </div>
                          {(Array.isArray(selectedOrder.returnSummary?.returns)
                            ? selectedOrder.returnSummary.returns
                            : []
                          ).map((ret) => {
                            const history =
                              Array.isArray(ret.returnHistory) && ret.returnHistory.length
                                ? ret.returnHistory
                                : Array.isArray(ret.timeline)
                                  ? ret.timeline
                                  : [];
                            return (
                              <div key={ret.returnId || ret.id} className="space-y-3">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-black uppercase tracking-wider text-slate-700">
                                    {ret.returnStatusLabel ||
                                      String(ret.returnStatus || "").replace(/_/g, " ")}
                                  </span>
                                  <span className="font-bold text-slate-500">
                                    {formatMoney(
                                      ret.returnRefundAmount || ret.pricing?.finalRefundAmount,
                                    )}
                                  </span>
                                </div>
                                {(ret.refundStatusLabel || ret.refundStatus) ? (
                                  <p className="text-[10px] font-bold text-emerald-700">
                                    Refund:{" "}
                                    {ret.refundStatusLabel ||
                                      String(ret.refundStatus).replace(/_/g, " ")}
                                    {ret.refundMethod
                                      ? ` · ${String(ret.refundMethod).toUpperCase()}`
                                      : ""}
                                  </p>
                                ) : null}
                                {Array.isArray(ret.returnItems) && ret.returnItems.length > 0 ? (
                                  <ReturnItemsDetailList
                                    items={ret.returnItems}
                                    variant="compact"
                                    title="Returned items"
                                  />
                                ) : null}
                                <div className="relative ml-2">
                                  <div className="absolute top-1 bottom-1 left-[5px] w-0.5 bg-amber-200" />
                                  <div className="space-y-3">
                                    {(history.length
                                      ? history
                                      : [
                                          {
                                            action: ret.returnStatus || "return_requested",
                                            at: ret.returnRequestedAt,
                                          },
                                        ]
                                    ).map((entry, idx) => {
                                      const label =
                                        String(
                                          entry.action ||
                                            entry.toStatus ||
                                            entry.status ||
                                            entry.label ||
                                            "",
                                        )
                                          .replace(/_/g, " ")
                                          .replace(/\b\w/g, (c) => c.toUpperCase()) || "Update";
                                      const when = entry.at || entry.createdAt || entry.timestamp;
                                      const whenLabel = when
                                        ? new Date(when).toLocaleString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : "—";
                                      return (
                                        <div
                                          key={`${ret.returnId || "ret"}-hist-${idx}`}
                                          className="relative flex gap-3"
                                        >
                                          <div className="mt-1 h-3 w-3 rounded-full ring-4 ring-amber-50 z-10 bg-amber-500" />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                              <p className="text-xs font-black text-slate-900">
                                                {label}
                                              </p>
                                              <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                                {whenLabel}
                                              </p>
                                            </div>
                                            {(entry.byRole || entry.note) && (
                                              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                                                {entry.byRole || entry.role || ""}
                                                {entry.byRole && entry.note ? " • " : ""}
                                                {entry.note || ""}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 sm:mb-4">
                      Items Ordered ({selectedOrder.items.length})
                    </h4>
                    <div className="space-y-3 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
                      {selectedOrder.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white ring-1 ring-slate-100 rounded-2xl group hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200">
                              <ProductImage
                                product={item}
                                alt={item.name}
                                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {item.name}
                              </p>
                              {item.variantName ? (
                                <p className="text-[10px] font-semibold text-red-600 mt-0.5">
                                  {item.variantName}
                                </p>
                              ) : null}
                              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                                ₹{item.price.toFixed(2)} × {item.qty}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-900">
                              ₹{(item.price * item.qty).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-end">
                    <div className="flex gap-2 items-center flex-wrap">
                      {/* Accept button — visible only when order is still Pending */}
                      {selectedOrder.status.toLowerCase() === "pending" && (
                        <button
                          onClick={() => {
                          handleStatusUpdate(selectedOrder.id, "confirmed");
                            setIsDetailsModalOpen(false);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-95">
                          <HiOutlineCheck className="h-3.5 w-3.5" />
                          Accept Order
                        </button>
                      )}
                      {canCancelOrder(selectedOrder) && (
                        <button
                          onClick={() => {
                            setCancellingOrder(selectedOrder);
                            setCancelReasonPreset("Out of stock");
                            setCancelReason("");
                            setIsCancelModalOpen(true);
                          }}
                          className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all">
                          Cancel Order
                        </button>
                      )}
                      {canResendDispatch(selectedOrder) && (
                        <button
                          onClick={() => handleResendDispatch(selectedOrder.id)}
                          className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-red-700 bg-red-50 hover:bg-red-100 transition-all">
                          Resend Rider
                        </button>
                      )}
                      <button
                        onClick={() => setIsDetailsModalOpen(false)}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
                        CLOSE
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

      {/* ── Cancel Order Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {isCancelModalOpen && cancellingOrder && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsCancelModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col"
            >
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <HiOutlineXMark className="h-5 w-5" />
                </span>
                Cancel Order #{cancellingOrder.id}
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                Please select a reason for cancelling this order. This reason will be shared with the customer and recorded in the system.
              </p>

              {/* Presets */}
              <div className="mt-4 space-y-2">
                {[
                  "Out of stock",
                  "Shop closed / busy",
                  "Incorrect item pricing or weight",
                  "Unable to fulfill due to delivery issues",
                  "Other"
                ].map((reason) => (
                  <label
                    key={reason}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all hover:bg-slate-50",
                      cancelReasonPreset === reason
                        ? "border-red-500 bg-red-500/5 text-red-500"
                        : "border-slate-100 text-slate-700 bg-white"
                    )}
                  >
                    <input
                      type="radio"
                      name="cancelPreset"
                      checked={cancelReasonPreset === reason}
                      onChange={() => setCancelReasonPreset(reason)}
                      className="accent-primary h-4 w-4"
                    />
                    {reason}
                  </label>
                ))}
              </div>

              {/* Custom Textarea */}
              {cancelReasonPreset === "Other" && (
                <div className="mt-4">
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Describe your reason in detail..."
                    rows={3}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/5 outline-none transition-all resize-none"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  DISMISS
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const finalReason = cancelReasonPreset === "Other" ? cancelReason.trim() : cancelReasonPreset;
                    if (!finalReason) {
                      showToast("Please provide a reason", "error");
                      return;
                    }
                    try {
                      await sellerApi.updateOrderStatus(cancellingOrder.id, {
                        status: "cancelled",
                        reason: finalReason
                      });
                      showToast(`Order #${cancellingOrder.id} has been cancelled`, "success");
                      setIsCancelModalOpen(false);
                      setIsDetailsModalOpen(false);
                      fetchOrders(page, false, { forceRefresh: true });
                    } catch (error) {
                      showToast(error.response?.data?.message || "Failed to cancel order", "error");
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10 active:scale-95"
                >
                  CONFIRM CANCELLATION
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { getOrderStatusLabel, getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";
import { getQuickCategoriesPath } from "../utils/routes";
import { joinOrderRoom, leaveOrderRoom, onOrderStatusUpdate } from "@/core/services/orderSocket";

const OrdersPage = () => {
  const navigate = useNavigate();
  const categoriesPath = getQuickCategoriesPath();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const getToken = () =>
    localStorage.getItem("auth_customer") ||
    localStorage.getItem("user_accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    "";

  const fetchOrders = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await customerApi.getMyOrders({ page: pageNum, limit: 10 });
      const rawList = response?.data?.result || response?.data?.results || [];
      const pagination = response?.data?.pagination;
      
      // Filter to keep only quick commerce orders in this module
      const list = Array.isArray(rawList) ? rawList.filter(order => {
        const type = order.orderType || order.module || 'quick'
        const orderId = String(order.orderId || order.id || order._id || '')
        return type === 'quick' || orderId.startsWith('QC') || (!orderId.startsWith('FOD') && !orderId.startsWith('ORD') && type !== 'food')
      }) : [];
      
      if (pageNum === 1) {
        setOrders(list);
      } else {
        setOrders((prev) => [...prev, ...list]);
      }

      if (pagination) {
        setHasMore(pagination.hasMore);
      } else {
        setHasMore(list.length === 10);
      }
      setPage(pageNum);

      // Join tracking rooms so status updates work even when userId is missing on the order.
      list.forEach((order) => {
        const orderId = String(order?.orderId || order?.orderNumber || order?.id || order?._id || "").trim();
        if (orderId) joinOrderRoom(orderId, getToken);
      });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      if (pageNum === 1) setOrders([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, []);

  useEffect(() => {
    const off = onOrderStatusUpdate(getToken, (payload) => {
      const orderId = String(payload?.orderId || "").trim();
      if (!orderId) return;
      const nextOrderStatus = payload?.orderStatus ? String(payload.orderStatus).trim() : "";
      const nextWorkflowStatus = payload?.workflowStatus ? String(payload.workflowStatus).trim() : "";
      if (!nextOrderStatus && !nextWorkflowStatus) return;

      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((order) => {
          const existingId = String(order?.orderId || order?.orderNumber || order?.id || order?._id || "").trim();
          if (existingId !== orderId) return order;
          return {
            ...order,
            ...(nextOrderStatus ? { orderStatus: nextOrderStatus } : {}),
            ...(nextWorkflowStatus ? { workflowStatus: nextWorkflowStatus } : {}),
          };
        }),
      );
    });

    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Best-effort: leave rooms on unmount to avoid unbounded joins.
    return () => {
      (Array.isArray(orders) ? orders : []).forEach((order) => {
        const orderId = String(order?.orderId || order?.orderNumber || order?.id || order?._id || "").trim();
        if (orderId) leaveOrderRoom(orderId, getToken);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-card px-4 py-3 shadow-sm transition-colors">
          <Loader2 className="animate-spin text-emerald-600" size={22} />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading your orders...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 transition-colors duration-500">
      <div className="sticky top-0 z-30 mb-4 flex items-center gap-2 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/95 dark:bg-background/95 px-4 pb-3 pt-4 backdrop-blur-sm transition-colors">
        <button
          onClick={() => navigate(-1)}
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10"
        >
          <ChevronLeft size={22} className="text-slate-800 dark:text-slate-200" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          My Orders
        </h1>
      </div>

      <div className="space-y-4 px-4 pb-2">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={56} className="mb-4 text-slate-300 dark:text-slate-700" />
            <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">
              No orders yet
            </h3>
            <p className="mb-6 max-w-[260px] text-sm text-slate-500">
              When you place an order, it will appear here so you can track it
              easily.
            </p>
            <Link
              to={categoriesPath}
              className="rounded-full bg-[#0c831f] px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0a6d19]"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const orderCode = order.orderId || order.orderNumber || order.id || "";
            const orderLookupId = order.orderId || order._id || order.id || orderCode;
            const legacy = getLegacyStatusFromOrder(order);
            const itemSummary = Array.isArray(order.items) && order.items.length > 0
              ? order.items.map((item) => item.name).filter(Boolean).join(", ")
              : `${order.itemCount || 0} item${order.itemCount === 1 ? "" : "s"}`;

            return (
              <article
                key={String(order.id || order._id || orderCode)}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/quick/orders/${encodeURIComponent(String(orderLookupId))}`, {
                  state: {
                    order,
                    prefetchedOrder: order,
                    orderType: "quick",
                  },
                })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/quick/orders/${encodeURIComponent(String(orderLookupId))}`, {
                      state: {
                        order,
                        prefetchedOrder: order,
                        orderType: "quick",
                      },
                    });
                  }
                }}
                className="cursor-pointer rounded-2xl border border-slate-100/80 dark:border-white/5 bg-white dark:bg-card px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-[#0c831f]/20"
              >
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/90">
                      {order.items?.[0]?.image ? (
                        <img
                          src={order.items[0].image}
                          alt={order.items[0]?.name || "Order thumbnail"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package size={22} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 transition-colors">
                        Order #{String(orderCode).slice(-6)}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400 transition-colors">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                        <span className="mx-1 text-slate-400">•</span>
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        legacy === "delivered"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                          : legacy === "cancelled"
                            ? "border-rose-100 bg-rose-50 text-rose-700"
                            : "border-orange-100 bg-orange-50 text-orange-700"
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
                        <CheckCircle
                          size={9}
                          className={
                            legacy === "delivered"
                              ? "text-emerald-600"
                              : legacy === "cancelled"
                                ? "text-rose-500"
                                : "text-primary"
                          }
                        />
                      </span>
                      <span>{getOrderStatusLabel(order).toUpperCase()}</span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Quick order placed
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5 pt-3 transition-colors">
                  <div className="max-w-[230px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 transition-colors">
                    {itemSummary}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">Total</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 transition-colors">
                      {"\u20B9"}
                      {order.pricing?.total ?? order.total ?? 0}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
                  </div>
                </div>
              </article>
            );
          })
        )}

        {hasMore && orders.length > 0 && (
          <div className="flex justify-center mt-6 mb-8">
            <button
              onClick={() => fetchOrders(page + 1)}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-full bg-white dark:bg-card border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingMore && <Loader2 className="animate-spin text-emerald-600" size={16} />}
              {loadingMore ? "Loading more..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Package, ChevronRight, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReturnProgressTracker from "./ReturnProgressTracker";
import ReturnPickupOtpDisplay from "./ReturnPickupOtpDisplay";
import { customerApi } from "../../services/customerApi";
import { mapReturnStatusLabel, RETURN_STATUS, formatRefundStatusLabel } from "@/shared/utils/returnStatus";
import { Truck } from "lucide-react";

const ACTIVE_RETURN_STATUSES = new Set([
  RETURN_STATUS.REQUESTED,
  RETURN_STATUS.APPROVED,
  RETURN_STATUS.PICKUP_ASSIGNED,
  RETURN_STATUS.IN_TRANSIT,
  RETURN_STATUS.RETURNED,
]);

const TERMINAL_RETURN_STATUSES = new Set([
  RETURN_STATUS.REJECTED,
  RETURN_STATUS.CANCELLED,
  RETURN_STATUS.REFUND_COMPLETED,
]);

const ReturnTrackingPanel = ({ orderId, order, onRefresh }) => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState("");

  const loadReturns = useCallback(async (silent = false) => {
    if (!orderId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await customerApi.getReturnStatus(orderId);
      const payload = res?.data?.data || res?.data?.result || {};
      const items = Array.isArray(payload?.returns) ? payload.returns : [];
      setReturns(items);
      onRefresh?.(items, payload);
    } catch (error) {
      if (!silent) {
        toast.error(error?.response?.data?.message || "Failed to load return status");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, onRefresh]);

  useEffect(() => {
    const seeded = Array.isArray(order?.returns)
      ? order.returns
      : Array.isArray(order?.returnSummary?.returns)
        ? order.returnSummary.returns
        : null;
    if (seeded) {
      setReturns(seeded);
      setLoading(false);
      onRefresh?.(seeded, order);
    } else if (order && !order.hasReturn) {
      setReturns([]);
      setLoading(false);
    } else {
      void loadReturns();
    }
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasActive = returns.some((row) => ACTIVE_RETURN_STATUSES.has(row?.returnStatus));
    if (!hasActive) return undefined;
    const poller = window.setInterval(() => {
      if (!document.hidden) void loadReturns(true);
    }, 20000);
    return () => window.clearInterval(poller);
  }, [returns, loadReturns]);

  const handleCancel = async (ret) => {
    if (!window.confirm("Cancel this return request?")) return;
    const cancelKey = String(ret.returnId || ret.id || "");
    setCancellingId(cancelKey);
    try {
      await customerApi.cancelReturnRequest(orderId, {
        reason: "Cancelled by customer",
      });
      toast.success("Return request cancelled");
      await loadReturns(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to cancel return");
    } finally {
      setCancellingId("");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-card rounded-xl p-6 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 border border-transparent dark:border-white/10">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading return status...</span>
      </div>
    );
  }

  const visibleReturns = returns.filter(
    (r) => ACTIVE_RETURN_STATUSES.has(r.returnStatus) || TERMINAL_RETURN_STATUSES.has(r.returnStatus),
  );
  if (!visibleReturns.length) return null;

  return (
    <div className="space-y-4">
      {visibleReturns.map((ret) => {
        const isTerminal = TERMINAL_RETURN_STATUSES.has(ret.returnStatus);
        const showLiveTracking = !isTerminal && [
          RETURN_STATUS.PICKUP_ASSIGNED,
          RETURN_STATUS.IN_TRANSIT,
        ].includes(ret.returnStatus);
        const canCancel = !isTerminal && [
          RETURN_STATUS.REQUESTED,
          RETURN_STATUS.APPROVED,
          RETURN_STATUS.PICKUP_ASSIGNED,
        ].includes(ret.returnStatus);
        const cancelKey = String(ret.returnId || ret.id || "");

        return (
          <motion.div
            key={ret.returnId || ret.id}
            className="bg-white dark:bg-card rounded-xl shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {isTerminal ? "Return update" : "Return in progress"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{mapReturnStatusLabel(ret.returnStatus)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadReturns(true)}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <ReturnProgressTracker returnDoc={ret} />

              {Array.isArray(ret.returnItems) && ret.returnItems.length > 0 && (
                <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Returned items</p>
                  {ret.returnItems.map((item) => {
                    const qty = Number(item.returnedQty ?? item.quantity ?? 0);
                    const unit = Number(item.unitPrice ?? item.price ?? 0);
                    const lineTotal = unit * Math.max(qty, 1);
                    return (
                      <div key={item.itemId || item.name} className="flex items-start justify-between gap-3 text-sm">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 min-w-0">
                          {item.name || item.itemId}
                          {qty > 0 ? ` ×${qty}` : ""}
                        </p>
                        {lineTotal > 0 ? (
                          <p className="text-slate-600 dark:text-slate-400 font-semibold shrink-0">₹{lineTotal.toFixed(2)}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <ReturnPickupOtpDisplay
                orderId={orderId}
                returnDoc={ret}
                sellerId={ret.sellerId}
              />

              {showLiveTracking && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Live return pickup</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Your return pickup rider is en route. Share the pickup OTP when they arrive.
                    </p>
                    {ret.dispatch?.acceptedAt ||
                    ['assigned', 'accepted', 'completed'].includes(
                      String(ret.dispatch?.status || '').toLowerCase(),
                    ) ? (
                      <p className="text-xs text-amber-800 font-semibold mt-2">Rider assigned</p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <p>
                  Refund method:{" "}
                  <span className="font-bold uppercase">{ret.refundMethod || "—"}</span>
                </p>
                {(() => {
                  const pricing = ret.refundPricing || ret.pricing || {};
                  const itemSubtotal = Number(
                    pricing.subtotal ||
                      (Array.isArray(ret.returnItems)
                        ? ret.returnItems.reduce(
                            (sum, item) =>
                              sum +
                              Number(item.unitPrice ?? item.price ?? 0) *
                                Number(item.returnedQty ?? item.quantity ?? 0),
                            0,
                          )
                        : 0),
                  );
                  const couponShare = Number(
                    pricing.couponShare ||
                      (Array.isArray(ret.returnItems)
                        ? ret.returnItems.reduce((sum, item) => sum + Number(item.couponShare || 0), 0)
                        : 0),
                  );
                  const taxShare = Number(
                    pricing.taxShare ||
                      (Array.isArray(ret.returnItems)
                        ? ret.returnItems.reduce((sum, item) => sum + Number(item.taxShare || 0), 0)
                        : 0),
                  );
                  const refundTotal = Number(ret.returnRefundAmount || pricing.finalRefundAmount || 0);
                  const showBreakdown = itemSubtotal > 0 || couponShare > 0 || taxShare > 0;

                  return (
                    <>
                      {showBreakdown ? (
                        <div className="rounded-lg bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 p-2.5 space-y-1 text-slate-600 dark:text-slate-400">
                          <p className="flex justify-between gap-3">
                            <span>Item total</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">₹{itemSubtotal.toFixed(2)}</span>
                          </p>
                          {couponShare > 0 ? (
                            <p className="flex justify-between gap-3 text-rose-600 dark:text-rose-400">
                              <span>Coupon adjusted</span>
                              <span className="font-semibold">−₹{couponShare.toFixed(2)}</span>
                            </p>
                          ) : null}
                          {taxShare > 0 ? (
                            <p className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400">
                              <span>GST refunded</span>
                              <span className="font-semibold">+₹{taxShare.toFixed(2)}</span>
                            </p>
                          ) : null}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                            Delivery, platform and packing fees are not refunded.
                          </p>
                        </div>
                      ) : null}
                      <p className="flex justify-between gap-3 text-sm text-slate-800 dark:text-slate-200 pt-0.5">
                        <span className="font-bold">Refund amount</span>
                        <span className="font-black">₹{refundTotal.toFixed(2)}</span>
                      </p>
                    </>
                  );
                })()}
                {ret.refundStatus && ret.refundStatus !== "none" && (
                  <p>
                    Refund status:{" "}
                    <span className="font-bold">
                      {ret.refundStatusLabel || formatRefundStatusLabel(ret.refundStatus)}
                    </span>
                  </p>
                )}
              </div>

              {canCancel && (
                <button
                  type="button"
                  onClick={() => handleCancel(ret)}
                  disabled={Boolean(cancellingId)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60"
                >
                  <XCircle className="w-4 h-4" />
                  {cancellingId === cancelKey ? "Cancelling..." : "Cancel return request"}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export const ReturnItemsCta = ({ orderId, hasActiveReturn, canReturn = true }) => {
  if (hasActiveReturn || !canReturn) return null;
  return (
    <Link
      to={`/quick/orders/${orderId}/return`}
      className="flex items-center gap-3 p-4 bg-white dark:bg-card rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-transparent dark:border-white/10"
    >
      <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center">
        <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-slate-100">Return items</p>
        <p className="text-sm text-gray-500 dark:text-slate-400">Request a return for eligible items</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0" />
    </Link>
  );
};

export default ReturnTrackingPanel;

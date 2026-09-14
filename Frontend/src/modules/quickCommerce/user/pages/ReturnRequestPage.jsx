import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Check } from "lucide-react";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { Textarea } from "@food/components/ui/textarea";
import ReturnWindowBanner from "../components/return/ReturnWindowBanner";
import { resolveLiveReturnEligibility } from "@/shared/utils/returnWindow";

const RETURN_REASONS = [
  "Received wrong item",
  "Item damaged or defective",
  "Quality not as expected",
  "Missing items in package",
  "Changed my mind",
  "Other",
];

const buildItemKey = (item) => {
  const productId = String(item?.itemId || item?.productId || item?._id || item?.id || "")
    .trim()
    .split("::")[0];
  const variant = String(
    item?.variantName || item?.variantId || item?.variantKey || item?.notes || "",
  ).trim();
  if (!productId) return String(item?.name || "").trim();
  return variant ? `${productId}::${variant}` : productId;
};

const ReturnRequestPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("wallet");
  const [payoutDetails, setPayoutDetails] = useState({
    upiId: "",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
  });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await customerApi.getOrderDetails(orderId);
        const payload =
          res?.data?.result ||
          res?.data?.data?.order ||
          res?.data?.order ||
          res?.data?.data ||
          null;
        setOrder(payload);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load order");
        navigate(`/quick/orders/${orderId}`);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orderId, navigate]);

  const quickItems = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.filter(
      (item) => !item?.type || String(item.type).toLowerCase() === "quick",
    );
  }, [order]);

  const returnEligibility = useMemo(
    () => resolveLiveReturnEligibility(order?.returnEligibility, now),
    [order?.returnEligibility, now],
  );

  const canSubmitReturn = Boolean(returnEligibility?.canReturn);

  const returnedQtyByKey = useMemo(() => {
    const map = {};
    const returns = Array.isArray(order?.returns)
      ? order.returns
      : Array.isArray(order?.returnSummary?.returns)
        ? order.returnSummary.returns
        : [];
    returns.forEach((ret) => {
      (Array.isArray(ret?.returnItems) ? ret.returnItems : []).forEach((row) => {
        const key = String(row?.itemId || "").trim();
        if (!key) return;
        map[key] = Number(map[key] || 0) + Number(row?.returnedQty ?? row?.quantity ?? 0);
      });
    });
    return map;
  }, [order]);

  const getItemEligibility = (item) => {
    const map = returnEligibility?.itemEligibility || order?.itemEligibility || {};
    const key = buildItemKey(item);
    return (
      map[key] ||
      map[String(item?.itemId || "").trim()] ||
      map[String(item?.productId || "").trim()] ||
      null
    );
  };

  const getRemainingQty = (item) => {
    const purchased = Math.max(1, Number(item?.quantity || 1));
    const already = Number(returnedQtyByKey[buildItemKey(item)] || 0);
    return {
      purchased,
      remaining: Math.max(0, purchased - already),
    };
  };

  const isItemReturnable = (item) => {
    const policy = getItemEligibility(item);
    const { remaining } = getRemainingQty(item);
    if (remaining <= 0) return false;
    if (!policy) return canSubmitReturn;
    const expiryMs = policy.returnExpiryAt ? new Date(policy.returnExpiryAt).getTime() : 0;
    const remainingSeconds = expiryMs
      ? Math.max(0, Math.floor((expiryMs - now) / 1000))
      : Math.max(0, Number(policy.remainingSeconds || 0));
    return policy.returnsEnabled !== false && remainingSeconds > 0;
  };

  const toggleItem = (item) => {
    if (!isItemReturnable(item)) return;
    const key = buildItemKey(item);
    if (!key) return;
    const { remaining } = getRemainingQty(item);
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { item, qty: remaining };
      return next;
    });
  };

  const setItemQty = (item, qty) => {
    const key = buildItemKey(item);
    const { remaining } = getRemainingQty(item);
    const nextQty = Math.max(1, Math.min(remaining, Number(qty) || 1));
    setSelectedItems((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], qty: nextQty } };
    });
  };

  const resolvedReason = reason === "Other" ? customReason.trim() : reason;

  const handleSubmit = async () => {
    const selected = Object.values(selectedItems).map((entry) =>
      entry?.item ? entry : { item: entry, qty: Number(entry?.quantity || 1) },
    );
    if (!selected.length) {
      toast.error("Select at least one item to return");
      return;
    }
    if (resolvedReason.length < 3) {
      toast.error("Please provide a return reason (min 3 characters)");
      return;
    }
    if (refundMethod === "upi") {
      if (!payoutDetails.upiId.trim()) {
        toast.error("UPI ID is required for UPI refund");
        return;
      }
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(payoutDetails.upiId.trim())) {
        toast.error("Invalid UPI ID format");
        return;
      }
    }
    if (refundMethod === "bank") {
      if (!payoutDetails.accountHolderName.trim() || !payoutDetails.accountNumber.trim() || !payoutDetails.ifscCode.trim()) {
        toast.error("Complete bank details are required");
        return;
      }
      if (!/^[a-zA-Z\s]{2,50}$/.test(payoutDetails.accountHolderName.trim())) {
        toast.error("Account holder name must contain only letters and spaces");
        return;
      }
      if (!/^\d{9,18}$/.test(payoutDetails.accountNumber.trim())) {
        toast.error("Account number must be 9 to 18 digits");
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payoutDetails.ifscCode.trim().toUpperCase())) {
        toast.error("Invalid IFSC code format");
        return;
      }
    }

    if (!canSubmitReturn) {
      toast.error(
        returnEligibility?.returnsEnabled === false
          ? "Returns are disabled for these products."
          : "Return window has expired.",
      );
      return;
    }
    if (selected.some((row) => !isItemReturnable(row.item))) {
      toast.error("Some selected items are not eligible for return.");
      return;
    }

    setSubmitting(true);
    try {
      await customerApi.createReturnRequest(orderId, {
        reason: resolvedReason,
        refundMethod,
        payoutDetails: refundMethod === "wallet" ? {} : payoutDetails,
        items: selected.map((row) => ({
          itemId: buildItemKey(row.item),
          quantity: Number(row.qty || getRemainingQty(row.item).remaining || 1),
        })),
      });
      toast.success("Return request submitted");
      navigate(`/quick/orders/${orderId}`);
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === "RETURN_WINDOW_EXPIRED") {
        toast.error(error?.response?.data?.message || "Return window has expired.");
      } else if (code === "RETURNS_DISABLED") {
        toast.error(error?.response?.data?.message || "Returns are disabled for these products.");
      } else if (code === "RETURN_ALREADY_EXISTS") {
        toast.error(error?.response?.data?.message || "A return request already exists for this order.");
        navigate(`/quick/orders/${orderId}`);
      } else {
        toast.error(error?.response?.data?.message || "Failed to submit return request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <Link to={`/quick/orders/${orderId}`} className="p-2 rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Return items</h1>
            <p className="text-sm text-slate-500">Order #{order?.orderId || orderId}</p>
          </div>
        </div>

        <ReturnWindowBanner
          eligibility={returnEligibility}
          deliveredAt={returnEligibility?.deliveredAt || order?.deliveryState?.deliveredAt}
        />

        {!canSubmitReturn && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {returnEligibility?.returnsEnabled === false
              ? "Returns are disabled for products in this order."
              : "No items in this order are currently eligible for return."}
          </div>
        )}

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Select items</p>
          <p className="text-xs text-slate-500">Select items and choose how many units to return.</p>
          {quickItems.length === 0 ? (
            <p className="text-sm text-slate-500">No returnable items found on this order.</p>
          ) : (
            quickItems.map((item) => {
              const key = buildItemKey(item);
              const selected = Boolean(selectedItems[key]);
              const returnable = isItemReturnable(item);
              const policy = getItemEligibility(item);
              const { purchased, remaining } = getRemainingQty(item);
              const selectedQty = Number(selectedItems[key]?.qty || remaining);
              const variantLabel = String(item?.variantName || "").trim();
              const itemDisabled = !canSubmitReturn || !returnable;
              const ineligibleReason =
                policy?.returnsEnabled === false
                  ? "Returns disabled for this category"
                  : remaining <= 0
                    ? "Already included in an existing return"
                    : "Return window expired for this item";
              return (
                <div
                  key={key}
                  className={`w-full p-3 rounded-xl border ${
                    itemDisabled
                      ? "border-slate-100 bg-slate-50 opacity-60"
                      : selected
                        ? "border-amber-400 bg-amber-50/50"
                        : "border-slate-100"
                  }`}
                >
                  <button
                    type="button"
                    disabled={itemDisabled}
                    onClick={() => toggleItem(item)}
                    className={`w-full flex items-start gap-3 text-left ${itemDisabled ? "cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 ${
                        selected ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      {variantLabel ? (
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">{variantLabel}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 mt-1">
                        Purchased {purchased} · Returnable {remaining}
                      </p>
                      {!returnable && (
                        <p className="text-xs text-rose-500 mt-1">{ineligibleReason}</p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 shrink-0">
                      ₹{Number(item.price || 0) * purchased}
                    </p>
                  </button>
                  {selected && remaining > 1 && (
                    <div className="mt-3 ml-8 flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500">Return qty</span>
                      <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          className="px-2 py-1 text-sm font-bold text-slate-700 disabled:opacity-40"
                          disabled={selectedQty <= 1}
                          onClick={() => setItemQty(item, selectedQty - 1)}
                        >
                          −
                        </button>
                        <span className="px-3 py-1 text-sm font-bold text-slate-900 min-w-[2rem] text-center">
                          {selectedQty}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-1 text-sm font-bold text-slate-700 disabled:opacity-40"
                          disabled={selectedQty >= remaining}
                          onClick={() => setItemQty(item, selectedQty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reason</p>
          <div className="flex flex-wrap gap-2">
            {RETURN_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  reason === r
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe the issue..."
              className="min-h-[80px]"
            />
          )}
        </section>

        <section className={`bg-white rounded-2xl border border-slate-100 p-4 space-y-3 ${!canSubmitReturn ? "opacity-60 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Refund method</p>
          <div className="grid gap-2">
            {[
              { id: "wallet", label: "Wallet", desc: "Instant credit to app wallet" },
              { id: "upi", label: "UPI", desc: "Refund to your UPI ID" },
              { id: "bank", label: "Bank", desc: "Refund to bank account" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setRefundMethod(method.id)}
                className={`rounded-xl border px-4 py-3 text-left ${
                  refundMethod === method.id
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{method.label}</p>
                <p className="text-xs text-slate-500">{method.desc}</p>
              </button>
            ))}
          </div>

          {refundMethod === "upi" && (
            <input
              type="text"
              placeholder="UPI ID (e.g. name@upi)"
              value={payoutDetails.upiId}
              maxLength={100}
              onChange={(e) => setPayoutDetails((p) => ({ ...p, upiId: e.target.value.replace(/\s/g, "") }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          )}

          {refundMethod === "bank" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Account holder name"
                value={payoutDetails.accountHolderName}
                maxLength={50}
                onChange={(e) =>
                  setPayoutDetails((p) => ({ ...p, accountHolderName: e.target.value.replace(/[^a-zA-Z\s]/g, "") }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="Account number"
                value={payoutDetails.accountNumber}
                maxLength={18}
                onChange={(e) =>
                  setPayoutDetails((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="IFSC code"
                value={payoutDetails.ifscCode}
                maxLength={11}
                onChange={(e) => setPayoutDetails((p) => ({ ...p, ifscCode: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
          )}
        </section>

        <Button
          onClick={handleSubmit}
          disabled={submitting || quickItems.length === 0 || !canSubmitReturn}
          className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              Submit return request
            </>
          )}
        </Button>
      </div>
    </AnimatedPage>
  );
};

export default ReturnRequestPage;

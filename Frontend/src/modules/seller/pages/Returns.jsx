import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import {
    HiOutlineArrowPath,
    HiOutlineInboxStack,
    HiOutlineEye,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineTruck,
} from "react-icons/hi2";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import ReturnPickupImageGallery from "@shared/components/returns/ReturnPickupImageGallery";
import ReturnPayoutDetails from "@shared/components/returns/ReturnPayoutDetails";
import ReturnItemsDetailList from "@shared/components/returns/ReturnItemsDetailList";
import { resolveReturnLifecycleLabel, resolveReturnDispatchUILabel, isReturnDispatchFailed, isReturnWaitingForRider, isReturnRiderAccepted } from "@/shared/utils/returnStatus";
import { useSellerEarnings } from "../context/SellerEarningsContext";

const returnStatConfigs = [
    {
        label: "Pending",
        icon: HiOutlineClock,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-50 border-amber-200/80",
    },
    {
        label: "Approved",
        icon: HiOutlineCheckCircle,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50 border-emerald-200/80",
    },
    {
        label: "Waiting for Rider",
        icon: HiOutlineTruck,
        iconColor: "text-sky-600",
        iconBg: "bg-sky-50 border-sky-200/80",
    },
    {
        label: "Pickup In Progress",
        icon: HiOutlineArrowPath,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-50 border-purple-200/80",
    },
];

const formatReturnAddress = (address) => {
    if (!address) return "";
    return [address.address, address.city].filter(Boolean).join(", ").trim();
};

const shouldShowSellerOtp = (ret) => {
    const otp = String(ret?.sellerOtp || "").trim();
    if (!otp) return false;
    if (isReturnRiderAccepted(ret)) return true;
    if (["return_in_transit", "returned", "refund_completed"].includes(ret?.returnStatus)) {
        return true;
    }
    if (ret?.dispatch?.status === "accepted" || ret?.dispatch?.acceptedAt) {
        return true;
    }
    const deliveryStatus = String(ret?.deliveryState?.status || "").trim();
    return ["picked_up", "reached_drop", "reached_pickup", "accepted"].includes(deliveryStatus);
};

const formatRefundMethodLabel = (method) => {
    const normalized = String(method || "").trim().toLowerCase();
    if (normalized === "wallet") return "Wallet";
    if (normalized === "bank") return "Bank";
    if (normalized === "upi") return "UPI";
    return method ? String(method) : "Not selected";
};

const formatRefundStatusLabel = (status) => {
    const normalized = String(status || "none").trim().toLowerCase();
    if (normalized === "none") return "Not started";
    if (normalized === "pending") return "Pending";
    if (normalized === "processing") return "Processing";
    if (normalized === "completed") return "Completed";
    if (normalized === "failed") return "Failed";
    return normalized;
};

const mapReturnStatusLabel = (ret) => {
    const status = typeof ret === "string" ? ret : ret?.returnStatus;

    if (typeof ret === "object" && ret) {
        const dispatchLabel = resolveReturnDispatchUILabel(ret);
        if (dispatchLabel) return dispatchLabel;
        if (
            ret.returnStatus === "return_pickup_assigned" ||
            ret.returnStatus === "return_in_transit"
        ) {
            return isReturnRiderAccepted(ret)
                ? "Pickup In Progress"
                : "Waiting for Rider";
        }
    }

    switch (status) {
        case "return_requested":
            return "Pending";
        case "return_approved":
            return "Approved";
        case "return_rejected":
            return "Rejected";
        case "return_pickup_assigned":
        case "return_in_transit":
            return "Pickup In Progress";
        case "returned":
            return "Quality Check";
        case "refund_completed":
            return "Refunded";
        default:
            return status || "Unknown";
    }
};

const Returns = () => {
    const { showToast } = useToast();
    const { earningsData } = useSellerEarnings();
    const ledgerBalance = earningsData?.balances?.settledBalance;
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [approveLoading, setApproveLoading] = useState(false);

    const tabs = [
        "All",
        "Pending",
        "Approved",
        "Dispatch Failed",
        "Waiting for Rider",
        "Pickup In Progress",
        "Quality Check",
        "Refunded",
        "Rejected",
    ];

    const getStatusVariant = (ret) => {
        const status = typeof ret === "string" ? ret : ret?.returnStatus;
        if (typeof ret === "object" && isReturnWaitingForRider(ret)) return "warning";

        switch (status) {
            case "return_requested":
                return "warning";
            case "return_approved":
                return "info";
            case "return_rejected":
                return "error";
            case "return_pickup_assigned":
            case "return_in_transit":
                return "secondary";
            case "returned":
                return "warning";
            case "refund_completed":
                return "success";
            default:
                return "secondary";
        }
    };

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const res = await sellerApi.getReturns();
            const payload = res.data.result || {};
            const items = Array.isArray(payload.items)
                ? payload.items
                : res.data.results || [];
            setReturns(items || []);
            return items || [];
        } catch (error) {
            console.error("Failed to fetch returns", error);
            showToast("Failed to fetch return requests", "error");
            return [];
        } finally {
            setLoading(false);
        }
    };

    const syncSelectedReturn = (items = []) => {
        if (!selectedReturn || !items.length) return;
        const fresh = items.find(
            (row) =>
                row.orderId === selectedReturn.orderId ||
                row._id === selectedReturn._id ||
                row.id === selectedReturn.id ||
                row.returnId === selectedReturn.returnId,
        );
        if (fresh) setSelectedReturn(fresh);
    };

    useEffect(() => {
        fetchReturns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncSelectedReturn(returns);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [returns]);

    useEffect(() => {
        if (!isDetailsOpen || !selectedReturn) return undefined;

        const shouldPoll = ["return_pickup_assigned", "return_approved", "return_in_transit"].includes(
            selectedReturn.returnStatus,
        );
        if (!shouldPoll) return undefined;

        const intervalId = window.setInterval(async () => {
            const items = await fetchReturns();
            syncSelectedReturn(items);
        }, 8000);

        return () => window.clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDetailsOpen, selectedReturn?.orderId, selectedReturn?.returnStatus]);

    const filteredReturns = useMemo(() => {
        if (activeTab === "All") return returns;
        return returns.filter((r) => {
            const label = mapReturnStatusLabel(r);
            return label === activeTab;
        });
    }, [returns, activeTab]);

    const openDetails = (ret) => {
        setSelectedReturn(ret);
        setIsDetailsOpen(true);
    };

    const handleApprove = async (orderId) => {
        try {
            setApproveLoading(true);
            const res = await sellerApi.approveReturn(orderId, {});
            const pickupDispatch = res.data?.result?.pickupDispatch;
            if (pickupDispatch?.success === false) {
                showToast(
                    pickupDispatch.message ||
                        "Return approved but dispatch failed — no nearby delivery partner found",
                    "warning"
                );
            } else if (pickupDispatch?.pending) {
                showToast("Return approved — pickup dispatch started", "success");
            } else if ((pickupDispatch?.notifiedCount ?? 0) > 0) {
                showToast(
                    `Return approved — ${pickupDispatch.notifiedCount} rider(s) notified for pickup`,
                    "success"
                );
            } else {
                showToast("Return approved — pickup dispatch started", "success");
            }
            const items = await fetchReturns();
            const fresh = items.find((row) => row.orderId === orderId);
            if (fresh) {
                setSelectedReturn(fresh);
                if (pickupDispatch?.success !== false) {
                    setIsDetailsOpen(true);
                } else {
                    setIsDetailsOpen(false);
                }
            } else {
                setIsDetailsOpen(false);
            }
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            if (status === 422 && data?.result) {
                showToast(
                    data.message ||
                        "Return approved but dispatch failed — no nearby delivery partner found",
                    "warning"
                );
                const items = await fetchReturns();
                const fresh =
                    items.find((row) => row.orderId === orderId) || data.result;
                setSelectedReturn(fresh);
                setIsDetailsOpen(true);
                return;
            }
            console.error("Failed to approve return", error);
            showToast(
                data?.message || "Failed to approve return",
                "error"
            );
        } finally {
            setApproveLoading(false);
        }
    };

    const handleRequestPickup = async (orderId) => {
        try {
            setPickupLoading(true);
            const res = await sellerApi.requestReturnPickup(orderId);
            const result = res.data?.result || {};
            const notified = result.notifiedCount ?? result.renotifiedCount ?? 0;

            if (result.success === false) {
                showToast(
                    result.message ||
                        "Dispatch failed — no nearby delivery partner found",
                    "error"
                );
            } else if (notified > 0) {
                showToast(
                    result.message || `Pickup requested — ${notified} rider(s) notified`,
                    "success"
                );
            } else {
                showToast(
                    result.message ||
                        "No online riders found nearby. Ensure a delivery partner is online and retry.",
                    "warning"
                );
            }
            const items = await fetchReturns();
            syncSelectedReturn(items);
        } catch (error) {
            const data = error.response?.data;
            const dispatchAudit = data?.dispatchAudit || data?.pickupDispatch;
            console.error("Failed to request pickup", error);
            showToast(
                data?.message ||
                    dispatchAudit?.message ||
                    "Dispatch failed — no nearby delivery partner found",
                "error"
            );
            const items = await fetchReturns();
            syncSelectedReturn(items);
        } finally {
            setPickupLoading(false);
        }
    };

    const handleReject = async (orderId) => {
        const reason = window.prompt(
            "Please enter reason for rejecting the return request:"
        );
        if (!reason) return;
        try {
            await sellerApi.rejectReturn(orderId, { reason });
            showToast("Return rejected", "success");
            await fetchReturns();
        } catch (error) {
            console.error("Failed to reject return", error);
            showToast(
                error.response?.data?.message || "Failed to reject return",
                "error"
            );
        }
    };

    return (
        <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
            {/* Header Bar */}
            <BlurFade delay={0.1}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
                            Return Requests
                            <span className="text-[10px] px-2 py-0.5 font-medium uppercase tracking-wider rounded-md bg-amber-100 text-amber-700 border border-amber-200">
                                New Requests
                            </span>
                        </h1>
                        <p className="text-xs font-normal text-slate-500 mt-0.5">
                            Review and manage customer return requests and pickups.
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={fetchReturns}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-all cursor-pointer"
                        >
                            <HiOutlineArrowPath className="h-3.5 w-3.5 text-slate-500" />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </BlurFade>

            {loading ? (
                <div className="min-h-[250px] flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
                    <p className="text-slate-500 font-medium mt-2 text-xs">
                        Loading Return Requests...
                    </p>
                </div>
            ) : (
                <>
                    {/* 2-by-2 Pure White Stat Cards Grid with Distinct Colorful Icon Badges */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                        {returnStatConfigs.map((cfg, i) => {
                            const count = returns.filter(
                                (r) => mapReturnStatusLabel(r) === cfg.label
                            ).length;
                            return (
                                <BlurFade key={cfg.label} delay={0.1 + i * 0.05}>
                                    <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-2.5 transition-all hover:border-slate-300">
                                        <div className="min-w-0">
                                            <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
                                                {cfg.label}
                                            </p>
                                            <h4 className="text-base sm:text-lg font-semibold text-[#1c1c1e] mt-0.5 tracking-tight truncate">
                                                {count}
                                            </h4>
                                        </div>
                                        <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs", cfg.iconBg)}>
                                            <cfg.icon className={cn("h-4 w-4", cfg.iconColor)} />
                                        </div>
                                    </div>
                                </BlurFade>
                            );
                        })}
                    </div>

                    <BlurFade delay={0.2}>
                        <div className="border border-slate-200/80 shadow-xs overflow-hidden rounded-xl bg-white space-y-3 p-3.5 sm:p-4">
                            {/* Filter Tabs */}
                            <div className="border-b border-slate-100 pb-3 overflow-x-auto scrollbar-hide">
                                <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0 min-w-max">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                                                activeTab === tab
                                                    ? "bg-white text-[#1c1c1e] shadow-2xs font-semibold"
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {filteredReturns.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center">
                                        <HiOutlineInboxStack className="h-8 w-8 text-slate-400 mb-2" />
                                        <h3 className="text-xs font-semibold text-[#1c1c1e]">
                                            No return requests found
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                                            Customer return requests will populate here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {filteredReturns.map((ret) => (
                                            <div
                                                key={ret._id}
                                                className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all flex items-start justify-between gap-3 text-xs"
                                            >
                                                <div
                                                    className="min-w-0 flex-1 cursor-pointer"
                                                    onClick={() => openDetails(ret)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-[#1c1c1e] truncate">
                                                            #{ret.orderId}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {ret.returnRequestedAt
                                                                ? new Date(ret.returnRequestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                                                                : ""}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-800 mt-0.5 truncate">
                                                        {ret.customer?.name || "Customer"}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                        Reason: {ret.returnReason || "No reason provided"}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <Badge
                                                        variant={getStatusVariant(ret)}
                                                        className="text-[9px] font-medium uppercase px-1.5 py-0.2 rounded"
                                                    >
                                                        {mapReturnStatusLabel(ret)}
                                                    </Badge>
                                                    <p className="text-xs font-semibold text-slate-900">
                                                        ₹{ret.returnRefundAmount || ret.pricing?.subtotal || 0}
                                                    </p>
                                                    <button
                                                        onClick={() => openDetails(ret)}
                                                        className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-colors cursor-pointer"
                                                    >
                                                        <HiOutlineEye className="h-3.5 w-3.5 text-slate-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </BlurFade>
                </>
            )}

            <AnimatePresence>
                {isDetailsOpen && selectedReturn && (
                    <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-3 sm:p-6 lg:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsDetailsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Return for Order #{selectedReturn.orderId}
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-0.5">
                                        <Badge
                                            variant={getStatusVariant(selectedReturn)}
                                            className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0"
                                        >
                                            {mapReturnStatusLabel(selectedReturn)}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto scrollbar-hide flex-1 space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Customer
                                    </p>
                                    <p className="text-sm font-bold text-slate-900">
                                        {selectedReturn.customer?.name || "Customer"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {selectedReturn.customer?.phone || ""}
                                    </p>
                                    {formatReturnAddress(selectedReturn.address) ? (
                                        <p className="text-xs text-slate-600 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                            {formatReturnAddress(selectedReturn.address)}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">
                                            Delivery address not available
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Return Reason
                                    </p>
                                    <p className="text-sm text-slate-800 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                        {selectedReturn.returnReason ||
                                            "No reason provided by customer."}
                                    </p>
                                    {selectedReturn.returnRejectedReason && (
                                        <p className="text-xs text-rose-600 font-semibold">
                                            Rejection reason:{" "}
                                            {selectedReturn.returnRejectedReason}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Refund
                                    </p>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
                                        <p>
                                            Refund method:{" "}
                                            <span className="font-black text-slate-900">
                                                {selectedReturn.refundMethodLabel ||
                                                    formatRefundMethodLabel(selectedReturn.refundMethod)}
                                            </span>
                                        </p>
                                        <p>
                                            Refund status:{" "}
                                            <span className="font-black text-slate-900 capitalize">
                                                {selectedReturn.lifecycleLabel ||
                                                    resolveReturnLifecycleLabel(selectedReturn) ||
                                                    selectedReturn.refundStatusLabel ||
                                                    formatRefundStatusLabel(selectedReturn.refundStatus)}
                                            </span>
                                        </p>
                                    </div>
                                    <ReturnPayoutDetails
                                        payoutDetails={selectedReturn.payoutDetails}
                                        refundMethod={selectedReturn.refundMethod}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        OTP & Pickup
                                    </p>
                                    {isReturnRiderAccepted(selectedReturn) && selectedReturn.deliveryPartner?.name ? (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 space-y-1">
                                            <p className="text-xs font-bold text-emerald-800">
                                                Rider assigned:{" "}
                                                {selectedReturn.deliveryPartner.name}
                                            </p>
                                            {selectedReturn.deliveryPartner.phone && (
                                                <p className="text-xs text-emerald-700">
                                                    {selectedReturn.deliveryPartner.phone}
                                                </p>
                                            )}
                                        </div>
                                    ) : isReturnRiderAccepted(selectedReturn) ? (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                            <p className="text-xs font-bold text-emerald-800">
                                                Rider assigned for return pickup
                                            </p>
                                        </div>
                                    ) : String(selectedReturn.dispatch?.status || "").toLowerCase() === "assigned" ? (
                                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                                            <p className="text-xs font-bold text-sky-800">
                                                Pickup assigned — waiting for rider acceptance
                                            </p>
                                        </div>
                                    ) : isReturnWaitingForRider(selectedReturn) ? (
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                                            <p className="text-xs font-bold text-amber-800">
                                                Waiting for a delivery partner to accept pickup
                                            </p>
                                            <p className="text-xs text-amber-700 mt-1">
                                                Nearby online riders are notified automatically.
                                                If none accept, use Retry Dispatch below.
                                            </p>
                                        </div>
                                    ) : isReturnDispatchFailed(selectedReturn) ? (
                                        <div
                                            role="alert"
                                            className="rounded-2xl border border-rose-200 bg-rose-50 p-3 space-y-2"
                                        >
                                            <p className="text-xs font-bold text-rose-800">
                                                Dispatch Failed
                                            </p>
                                            <p className="text-xs text-rose-700">
                                                No nearby delivery partner found. Ensure riders
                                                are online and tap Retry below.
                                            </p>
                                        </div>
                                    ) : null}
                                    {shouldShowSellerOtp(selectedReturn) && (
                                        <p className="text-sm text-slate-800">
                                            Seller handover OTP:{" "}
                                            <span className="font-black tracking-widest text-lg">
                                                {selectedReturn.sellerOtp}
                                            </span>
                                        </p>
                                    )}
                                    {selectedReturn.dispatch?.deliveryPartnerId &&
                                        !isReturnRiderAccepted(selectedReturn) && (
                                        <p className="text-xs text-slate-600">
                                            Rider notified for return pickup
                                        </p>
                                    )}
                                    {selectedReturn.qualityCheck?.status && (
                                        <p className="text-xs text-slate-600 capitalize">
                                            Quality check: {selectedReturn.qualityCheck.status}
                                        </p>
                                    )}
                                </div>

                                <ReturnPickupImageGallery entries={selectedReturn.pickupImageEntries} />

                                <ReturnItemsDetailList items={selectedReturn.returnItems} />

                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Seller Finance
                                    </p>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
                                        <p>
                                            Refund deduction:{" "}
                                            <span className="font-black">
                                                ₹
                                                {Number(
                                                    (selectedReturn.finance?.preSettlementDeducted || 0) +
                                                        (selectedReturn.finance?.postSettlementDebited || 0)
                                                ).toFixed(2)}
                                            </span>
                                        </p>
                                        {Number(selectedReturn.finance?.pickupFeeDebited || 0) > 0 ? (
                                            <p>
                                                Pickup fee deduction:{" "}
                                                <span className="font-black">
                                                    ₹{Number(selectedReturn.finance.pickupFeeDebited).toFixed(2)}
                                                </span>
                                            </p>
                                        ) : (
                                            <p>
                                                Return pickup fee:{" "}
                                                <span className="font-black">Paid by admin</span>
                                            </p>
                                        )}
                                        {selectedReturn.finance?.settlementMode && (
                                            <p>
                                                Settlement impact:{" "}
                                                <span className="font-black capitalize">
                                                    {selectedReturn.finance.settlementMode.replace(/_/g, " ")}
                                                </span>
                                            </p>
                                        )}
                                        <p>
                                            Ledger applied:{" "}
                                            <span className="font-black">
                                                {selectedReturn.finance?.sellerLedgerApplied ? "Yes" : "No"}
                                            </span>
                                        </p>
                                        {ledgerBalance != null && (
                                            <p className="pt-1 font-bold text-slate-900">
                                                Current ledger balance:{" "}
                                                <span className="font-black">
                                                    ₹{Number(ledgerBalance).toFixed(2)}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Payment Breakdown
                                    </p>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
                                        <p>
                                            Item price:{" "}
                                            <span className="font-black">
                                                ₹
                                                {Number(
                                                    selectedReturn.refundPricing?.subtotal ??
                                                        selectedReturn.pricing?.subtotal ??
                                                        0
                                                ).toFixed(2)}
                                            </span>
                                        </p>
                                        {Number(
                                            selectedReturn.refundPricing?.couponShare ??
                                                selectedReturn.pricing?.couponShare ??
                                                0
                                        ) > 0 && (
                                            <p>
                                                Coupon adjustment:{" "}
                                                <span className="font-black">
                                                    -₹
                                                    {Number(
                                                        selectedReturn.refundPricing?.couponShare ??
                                                            selectedReturn.pricing?.couponShare ??
                                                            0
                                                    ).toFixed(2)}
                                                </span>
                                            </p>
                                        )}
                                        {Number(
                                            selectedReturn.refundPricing?.taxShare ??
                                                selectedReturn.pricing?.taxShare ??
                                                0
                                        ) > 0 && (
                                            <p>
                                                GST (included in refund):{" "}
                                                <span className="font-black">
                                                    +₹
                                                    {Number(
                                                        selectedReturn.refundPricing?.taxShare ??
                                                            selectedReturn.pricing?.taxShare ??
                                                            0
                                                    ).toFixed(2)}
                                                </span>
                                            </p>
                                        )}
                                        <p className="pt-1 font-bold text-slate-900">
                                            Product refund:{" "}
                                            <span className="font-black">
                                                ₹
                                                {Number(
                                                    selectedReturn.returnRefundAmount ??
                                                        selectedReturn.refundPricing?.finalRefundAmount ??
                                                        selectedReturn.pricing?.finalRefundAmount ??
                                                        0
                                                ).toFixed(2)}
                                            </span>
                                        </p>
                                        <p>
                                            Return pickup charge (calculated):{" "}
                                            <span className="font-black">
                                                ₹
                                                {Number(
                                                    selectedReturn.calculatedPickupCharge ??
                                                        selectedReturn.returnPickupCharge ??
                                                        selectedReturn.pricing?.pickupFee ??
                                                        selectedReturn.returnDeliveryCommission ??
                                                        0
                                                ).toFixed(2)}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-end">
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setIsDetailsOpen(false)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                        Close
                                    </button>
                                    {selectedReturn.returnStatus ===
                                        "return_approved" && (
                                        <Button
                                            className="text-xs font-bold"
                                            disabled={pickupLoading}
                                            onClick={() =>
                                                handleRequestPickup(
                                                    selectedReturn.orderId
                                                )
                                            }
                                        >
                                            {pickupLoading
                                                ? "Requesting..."
                                                : "Request Pickup"}
                                        </Button>
                                    )}
                                    {(isReturnDispatchFailed(selectedReturn) ||
                                        isReturnWaitingForRider(selectedReturn)) && (
                                        <Button
                                            className="text-xs font-bold"
                                            disabled={pickupLoading}
                                            onClick={() =>
                                                handleRequestPickup(
                                                    selectedReturn.orderId
                                                )
                                            }
                                        >
                                            {pickupLoading
                                                ? "Retrying..."
                                                : isReturnDispatchFailed(selectedReturn)
                                                  ? "Retry"
                                                  : "Retry Dispatch"}
                                        </Button>
                                    )}
                                    {selectedReturn.returnStatus ===
                                        "return_requested" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="text-xs font-bold"
                                                disabled={approveLoading}
                                                onClick={() =>
                                                    handleReject(
                                                        selectedReturn.orderId
                                                    )
                                                }
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                className="text-xs font-bold"
                                                disabled={approveLoading}
                                                onClick={() =>
                                                    handleApprove(
                                                        selectedReturn.orderId
                                                    )
                                                }
                                            >
                                                {approveLoading ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                                                        Approving...
                                                    </>
                                                ) : (
                                                    "Approve"
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Returns;


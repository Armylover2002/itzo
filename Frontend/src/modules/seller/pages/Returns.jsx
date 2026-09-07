import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { useAuth } from "@core/context/AuthContext";
import { onSellerReturnUpdate, onSellerHandoffOtp } from "@core/services/orderSocket";
import {
    HiOutlineArrowPath,
    HiOutlineInboxStack,
    HiOutlineEye,
    HiOutlineCalendarDays,
    HiOutlineCheckCircle,
    HiOutlineTruck,
    HiOutlineDocumentText,
    HiOutlineXCircle,
    HiOutlineMapPin,
    HiOutlineKey
} from "react-icons/hi2";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const Returns = () => {
    const { showToast } = useToast();
    const { getToken } = useAuth();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    // Lightbox & OTP State
    const [activeImage, setActiveImage] = useState(null);
    const [handoffOtp, setHandoffOtp] = useState(null);
    const [loadingOtp, setLoadingOtp] = useState(false);

    const tabs = [
        "All",
        "Requested",
        "Approved",
        "Pickup",
        "OTP Pending",
        "Completed",
        "Rejected"
    ];

    const mapReturnStatusLabel = (status) => {
        if (!status) return "Unknown";
        switch (status) {
            case "return_requested":
            case "under_review":
                return "Requested";
            case "return_approved":
            case "partially_approved":
                return "Approved";
            case "return_rejected":
                return "Rejected";
            case "return_pickup_assigned":
            case "pickup_pending":
            case "pickup_en_route":
            case "pickup_reached":
            case "pickup_otp_pending":
            case "picked_up":
            case "return_en_route":
            case "return_in_transit":
                return "Pickup";
            case "return_reached_seller":
            case "seller_otp_pending":
                return "OTP Pending";
            case "returned":
            case "return_completed":
            case "refund_pending":
            case "refund_completed":
                return "Completed";
            case "cancelled":
                return "Cancelled";
            default:
                return "Unknown";
        }
    };

    const getStatusVariant = (status) => {
        const label = mapReturnStatusLabel(status);
        switch (label) {
            case "Requested": return "warning";
            case "Approved": return "info";
            case "Rejected": return "error";
            case "Cancelled": return "error";
            case "Pickup": return "secondary";
            case "OTP Pending": return "warning";
            case "Completed": return "success";
            default: return "secondary";
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
        } catch (error) {
            console.error("Failed to fetch returns", error);
            showToast("Failed to fetch return requests", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Socket Real-time listener
    useEffect(() => {
        const cleanup = onSellerReturnUpdate(getToken, (payload) => {
            console.log("Seller Return Socket Update:", payload);
            if (payload && payload._id) {
                setReturns(prev => {
                    const existingIdx = prev.findIndex(r => String(r._id) === String(payload._id));
                    if (existingIdx !== -1) {
                        const newReturns = [...prev];
                        // Merge the updated fields
                        newReturns[existingIdx] = { ...newReturns[existingIdx], ...payload };
                        
                        // Update selected return if open
                        if (selectedReturn && String(selectedReturn._id) === String(payload._id)) {
                            setSelectedReturn(newReturns[existingIdx]);
                        }
                        
                        return newReturns;
                    } else {
                        return [payload, ...prev];
                    }
                });
            }
        });
        return cleanup;
    }, [getToken, selectedReturn]);

    // Socket listener for real-time OTP updates
    useEffect(() => {
        const cleanup = onSellerHandoffOtp(getToken, (payload) => {
            console.log("Seller Handoff OTP Socket:", payload);
            if (payload && payload.otp) {
                // Set it directly, and optionally check if it belongs to the active return
                setHandoffOtp(payload.otp);
            }
        });
        return cleanup;
    }, [getToken]);

    // Fetch OTP when status is seller_otp_pending
    useEffect(() => {
        if (selectedReturn && selectedReturn.returnStatus === 'seller_otp_pending' && isDetailsOpen) {
            if (selectedReturn.handoffOtp) {
                setHandoffOtp(selectedReturn.handoffOtp);
            } else {
                fetchDropOtp(selectedReturn._id);
            }
        } else {
            setHandoffOtp(null);
        }
    }, [selectedReturn?.returnStatus, selectedReturn?.handoffOtp, isDetailsOpen, selectedReturn?._id]);

    const fetchDropOtp = async (id) => {
        try {
            setLoadingOtp(true);
            const res = await sellerApi.getReturnOtp(id);
            if (res.data?.result?.otp) {
                setHandoffOtp(res.data.result.otp);
            }
        } catch (error) {
            console.error("Failed to fetch OTP", error);
            // Don't toast to avoid spamming if not ready
        } finally {
            setLoadingOtp(false);
        }
    };

    const filteredReturns = useMemo(() => {
        if (activeTab === "All") return returns;
        return returns.filter((r) => {
            const label = mapReturnStatusLabel(r.returnStatus);
            return label === activeTab;
        });
    }, [returns, activeTab]);

    const openDetails = (ret) => {
        setSelectedReturn(ret);
        setIsDetailsOpen(true);
    };

    const handleApprove = async (orderId) => {
        try {
            await sellerApi.approveReturn(orderId, {});
            showToast("Return approved", "success");
            await fetchReturns();
        } catch (error) {
            console.error("Failed to approve return", error);
            showToast(
                error.response?.data?.message || "Failed to approve return",
                "error"
            );
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
    
    const renderTimeline = (ret) => {
        const milestones = [
            { label: "Requested", status: "return_requested", time: ret.returnRequestedAt, icon: HiOutlineDocumentText },
            { label: "Approved", status: "return_approved", time: ret.itemApprovals?.length > 0 ? ret.itemApprovals[0].decidedAt : null, icon: HiOutlineCheckCircle },
            { label: "Pickup Started", status: "pickup_en_route", time: ret.pickupEnRouteAt, icon: HiOutlineTruck },
            { label: "Items Picked Up", status: "picked_up", time: ret.pickedUpAt, icon: HiOutlineInboxStack },
            { label: "Heading to Store", status: "return_en_route", time: ret.returnEnRouteAt, icon: HiOutlineMapPin },
            { label: "Completed", status: "return_completed", time: ret.returnCompletedAt, icon: HiOutlineCheckCircle },
        ];
        
        return (
            <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent mt-4">
                {milestones.map((m, idx) => {
                    const isPassed = !!m.time || (ret.returnStatus === 'return_completed' && idx < milestones.length);
                    const isRejected = ret.returnStatus === 'return_rejected' || ret.returnStatus === 'cancelled';
                    const isCurrent = ret.returnStatus === m.status;
                    
                    if (isRejected && idx > 0 && !m.time) return null; // Don't show future steps if rejected

                    return (
                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-full border-4 border-white shadow shrink-0 absolute -left-6",
                                isPassed ? "bg-primary text-white" : "bg-slate-200 text-slate-400",
                                isRejected && idx === 1 ? "bg-rose-500" : ""
                            )}>
                                <m.icon className="w-3 h-3" />
                            </div>
                            <div className={cn(
                                "pl-4 w-full",
                                !isPassed ? "opacity-50" : ""
                            )}>
                                <h4 className="text-sm font-bold text-slate-900">
                                    {isRejected && idx === 1 ? "Rejected" : m.label}
                                </h4>
                                {m.time ? (
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                        {new Date(m.time).toLocaleString('en-IN', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                        Pending
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-16">
            <BlurFade delay={0.1}>
                <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                            Return Requests
                            <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-bold tracking-widest uppercase"
                            >
                                New
                            </Badge>
                        </h1>
                        <p className="text-slate-600 text-xs sm:text-sm mt-1 font-medium">
                            Review and manage customer return requests.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <Button
                            onClick={fetchReturns}
                            variant="outline"
                            className="flex items-center space-x-1.5 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <HiOutlineArrowPath className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", loading && "animate-spin")} />
                            <span className="hidden sm:inline">REFRESH</span>
                        </Button>
                    </div>
                </div>
            </BlurFade>

            {loading && returns.length === 0 ? (
                <div className="min-h-[320px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-slate-600 font-bold mt-4 uppercase tracking-widest text-xs">
                        Loading Return Requests...
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {[
                            {
                                label: "Requested",
                                cardBg: "bg-amber-50/80 border-amber-200/90 hover:bg-amber-100/70 hover:border-amber-300",
                                iconBg: "bg-amber-500 text-white shadow-md shadow-amber-500/25",
                                labelColor: "text-amber-800 font-bold",
                                countColor: "text-amber-950 font-black",
                                icon: HiOutlineDocumentText
                            },
                            {
                                label: "Approved",
                                cardBg: "bg-blue-50/80 border-blue-200/90 hover:bg-blue-100/70 hover:border-blue-300",
                                iconBg: "bg-blue-500 text-white shadow-md shadow-blue-500/25",
                                labelColor: "text-blue-800 font-bold",
                                countColor: "text-blue-950 font-black",
                                icon: HiOutlineCheckCircle
                            },
                            {
                                label: "Pickup",
                                cardBg: "bg-purple-50/80 border-purple-200/90 hover:bg-purple-100/70 hover:border-purple-300",
                                iconBg: "bg-purple-500 text-white shadow-md shadow-purple-500/25",
                                labelColor: "text-purple-800 font-bold",
                                countColor: "text-purple-950 font-black",
                                icon: HiOutlineTruck
                            },
                            {
                                label: "Completed",
                                cardBg: "bg-emerald-50/80 border-emerald-200/90 hover:bg-emerald-100/70 hover:border-emerald-300",
                                iconBg: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25",
                                labelColor: "text-emerald-800 font-bold",
                                countColor: "text-emerald-950 font-black",
                                icon: HiOutlineInboxStack
                            }
                        ].map((stat, i) => {
                            const count = returns.filter(
                                (r) => mapReturnStatusLabel(r.returnStatus) === stat.label || 
                                       (stat.label === "Pickup" && mapReturnStatusLabel(r.returnStatus) === "OTP Pending")
                            ).length;
                            const StatIcon = stat.icon;
                            return (
                                <BlurFade key={stat.label} delay={0.1 + i * 0.05}>
                                    <div
                                        className={cn(
                                            "border rounded-2xl p-3 sm:p-4 transition-all duration-200 shadow-xs hover:shadow-md flex items-center gap-3 sm:gap-4 relative overflow-hidden",
                                            stat.cardBg
                                        )}
                                    >
                                        <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shadow-sm shrink-0", stat.iconBg)}>
                                            <StatIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={cn("text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate", stat.labelColor)}>
                                                {stat.label}
                                            </p>
                                            <h4 className={cn("text-lg sm:text-2xl font-black tracking-tight mt-0.5", stat.countColor)}>
                                                {count}
                                            </h4>
                                        </div>
                                    </div>
                                </BlurFade>
                            );
                        })}
                    </div>

                    <BlurFade delay={0.2}>
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-lg bg-white overflow-hidden">
                            <div className="border-b border-slate-100 bg-slate-50/30 overflow-x-auto scrollbar-hide">
                                <div className="flex px-3 sm:px-6 items-center min-w-max">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "relative py-3 sm:py-4 px-2.5 sm:px-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300",
                                                activeTab === tab
                                                    ? "text-primary scale-105"
                                                    : "text-slate-600 hover:text-slate-700"
                                            )}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="returns-tab-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E71D28] rounded-full mx-2 sm:mx-4"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 sm:p-4">
                                {filteredReturns.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                                            <HiOutlineInboxStack className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            No return requests found
                                        </h3>
                                        <p className="text-xs text-slate-600 font-medium text-center mt-1">
                                            You will see customer return requests here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredReturns.map((ret) => {
                                            const statusLabel = mapReturnStatusLabel(ret.returnStatus);
                                            const itemCardBg = 
                                                statusLabel === "Requested"
                                                    ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-100/50"
                                                    : statusLabel === "Approved"
                                                    ? "bg-blue-50/40 border-blue-200/80 hover:bg-blue-100/50"
                                                    : statusLabel === "Pickup" || statusLabel === "OTP Pending"
                                                    ? "bg-purple-50/40 border-purple-200/80 hover:bg-purple-100/50"
                                                    : statusLabel === "Completed"
                                                    ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-100/50"
                                                    : statusLabel === "Rejected" || statusLabel === "Cancelled"
                                                    ? "bg-rose-50/40 border-rose-200/80 hover:bg-rose-100/50"
                                                    : "bg-slate-50/40 border-slate-200/80 hover:bg-slate-100/50";

                                            return (
                                                <div
                                                    key={ret._id}
                                                    className={cn(
                                                        "border rounded-xl p-4 shadow-xs transition-all flex items-start justify-between gap-3",
                                                        itemCardBg
                                                    )}
                                                >
                                                    <div
                                                        className="min-w-0 flex-1 cursor-pointer"
                                                        onClick={() => openDetails(ret)}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-xs font-black text-slate-900 truncate">
                                                                #{ret.orderId}
                                                            </p>
                                                            {ret.returnStatus === 'seller_otp_pending' && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                                                    <span className="relative flex h-2 w-2">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                                    </span>
                                                                    Rider Waiting
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                                                            <HiOutlineCalendarDays className="h-3 w-3 shrink-0" />
                                                            {ret.returnRequestedAt
                                                                ? new Date(
                                                                      ret.returnRequestedAt
                                                                  ).toLocaleString("en-IN", {
                                                                      day: "2-digit",
                                                                      month: "short",
                                                                      hour: "2-digit",
                                                                      minute: "2-digit",
                                                                  })
                                                                : "N/A"}
                                                        </p>
                                                        <p className="text-xs font-bold text-slate-800 mt-1">
                                                            {ret.customer?.name || "Customer"}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                            {ret.returnReason ||
                                                                "No reason provided"}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <Badge
                                                            variant={getStatusVariant(ret.returnStatus)}
                                                            className="text-[10px] font-black uppercase px-2 py-0"
                                                        >
                                                            {mapReturnStatusLabel(ret.returnStatus)}
                                                        </Badge>
                                                        <p className="text-xs font-black text-slate-900">
                                                            ₹{ret.returnRefundAmount || ret.pricing?.subtotal || 0}
                                                        </p>
                                                        <button
                                                            onClick={() => openDetails(ret)}
                                                            className="p-2 hover:bg-slate-100/80 rounded-lg text-slate-600"
                                                        >
                                                            <HiOutlineEye className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </Card>
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Return for Order #{selectedReturn.orderId}
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <Badge
                                            variant={getStatusVariant(selectedReturn.returnStatus)}
                                            className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0"
                                        >
                                            {mapReturnStatusLabel(selectedReturn.returnStatus)}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 shrink-0 self-end sm:self-auto"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto scrollbar-hide flex-1 space-y-6">
                                
                                {selectedReturn.returnStatus === 'seller_otp_pending' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <HiOutlineKey className="h-5 w-5 text-amber-600" />
                                                <h4 className="text-sm font-black text-amber-900">Rider arrived!</h4>
                                            </div>
                                            <p className="text-xs text-amber-700 font-medium">Provide this OTP to the delivery partner to receive the return items.</p>
                                        </div>
                                        <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-amber-100 flex items-center justify-center min-w-[120px]">
                                            {loadingOtp ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                                            ) : handoffOtp ? (
                                                <span className="text-2xl font-black text-amber-600 tracking-[0.2em]">{handoffOtp}</span>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400">Failed</span>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Left Column */}
                                    <div className="space-y-6">
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
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                Return Reason
                                            </p>
                                            <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                {selectedReturn.returnReason || "No reason provided by customer."}
                                            </p>
                                            {selectedReturn.returnRejectedReason && (
                                                <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg">
                                                    Rejection reason: {selectedReturn.returnRejectedReason}
                                                </p>
                                            )}
                                        </div>

                                        {selectedReturn.returnRequestId?.evidenceImages && selectedReturn.returnRequestId.evidenceImages.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                    Customer Images
                                                </p>
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {selectedReturn.returnRequestId.evidenceImages.map((img, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={() => setActiveImage(img)}
                                                        >
                                                            <img src={img} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                Items to Return
                                            </p>
                                            <div className="space-y-2">
                                                {(selectedReturn.returnItems || []).map(
                                                    (item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                                                        >
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-900">
                                                                    {item.name}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    Qty: {item.quantity}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs font-black text-slate-900">
                                                                ₹{item.price * item.quantity}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Timeline & Rider info */}
                                    <div className="space-y-6">
                                        {selectedReturn.assignment?.deliveryPartnerId && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                    Delivery Partner
                                                </p>
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-[#fde8ea] text-[#c41922] rounded-full flex items-center justify-center shrink-0">
                                                        <HiOutlineTruck className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{selectedReturn.assignment.deliveryPartnerId.name}</p>
                                                        <p className="text-[10px] text-slate-500">{selectedReturn.assignment.deliveryPartnerId.phone}</p>
                                                        {selectedReturn.assignment.deliveryPartnerId.vehicleNumber && (
                                                            <Badge variant="outline" className="mt-1 text-[9px] px-1 py-0">{selectedReturn.assignment.deliveryPartnerId.vehicleNumber}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                Return Timeline
                                            </p>
                                            {renderTimeline(selectedReturn)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-end">
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setIsDetailsOpen(false)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all"
                                    >
                                        Close
                                    </button>
                                    {(selectedReturn.returnStatus === "return_requested" || selectedReturn.returnStatus === "under_review") && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                                                onClick={() => handleReject(selectedReturn.orderId)}
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                className="text-xs font-bold bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white transition-colors shadow-md"
                                                onClick={() => handleApprove(selectedReturn.orderId)}
                                            >
                                                Approve
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Lightbox for Images */}
            <AnimatePresence>
                {activeImage && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm cursor-pointer"
                            onClick={() => setActiveImage(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative z-10 max-w-3xl max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl"
                        >
                            <img src={activeImage} alt="Evidence Full" className="w-full h-full object-contain" />
                            <button 
                                onClick={() => setActiveImage(null)}
                                className="absolute top-4 right-4 h-8 w-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 backdrop-blur-md"
                            >
                                ✕
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Returns;

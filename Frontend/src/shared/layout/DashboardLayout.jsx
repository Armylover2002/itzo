import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { useAuth } from '@/core/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SellerOrdersContext from '@/modules/seller/context/SellerOrdersContext';
import SellerEarningsContext, { defaultEarnings } from '@/modules/seller/context/SellerEarningsContext';
import { getOrderSocket, onSellerOrderNew, onOrderStatusUpdate, onOrderCancelled, onSellerHandoffOtp } from '@/core/services/orderSocket';
import alertSound from '@/modules/Food/assets/audio/alert.mp3';

const POLL_INTERVAL_MS = 30000;

const resolveAudioSource = (source, cacheKey = 'seller-alert') => {
    if (!source) return source;
    if (!import.meta.env.DEV) return source;
    const separator = source.includes('?') ? '&' : '?';
    return `${source}${separator}devcache=${cacheKey}`;
};

const resolveSellerReceivable = (order) => {
    const receivable = Number(order?.pricing?.receivable);
    if (Number.isFinite(receivable)) return receivable;

    const subtotal = Number(order?.pricing?.subtotal);
    const commission = Number(order?.pricing?.commission);
    if (Number.isFinite(subtotal) && Number.isFinite(commission)) {
        return Math.max(0, subtotal - commission);
    }

    const fallback = Number(order?.total ?? order?.pricing?.total);
    return Number.isFinite(fallback) ? fallback : 0;
};

/** Match server `sellerPendingExpiresAt` — never reset to a full 60s when the modal opens late. */
function secondsLeftUntilSellerExpiry(order) {
    if (!order) return 0;
    const raw = order.sellerPendingExpiresAt ?? order.expiresAt;
    if (!raw) return 60;
    const ms = new Date(raw).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
}

const isEarningsRoute = (path) =>
    path.includes('earnings') || path.includes('withdrawals') || path.includes('transactions');

const DashboardLayout = ({ children, navItems, title }) => {
    const [newOrderAlert, setNewOrderAlert] = useState(null);
    const [shownOrderIds, setShownOrderIds] = useState(() => new Set());
    const [timeLeft, setTimeLeft] = useState(0);
    /** Total seconds in this acceptance window (for progress bar), set when modal opens */
    const acceptWindowTotalRef = useRef(60);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { user, logout, role } = useAuth();
    const location = useLocation();

    const handleToggleSidebar = useCallback(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsSidebarOpen((prev) => !prev);
        } else {
            setIsSidebarCollapsed((prev) => !prev);
        }
    }, []);

    // Shared data for seller – single source, avoids duplicate API calls
    const [sellerOrders, setSellerOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [sellerEarningsData, setSellerEarningsData] = useState(defaultEarnings);
    const [earningsLoading, setEarningsLoading] = useState(false);

    const shownOrderIdsRef = useRef(new Set());
    const isFirstLoadRef = useRef(true);
    const newOrderAlertRef = useRef(null);
    const fetchOrdersRef = useRef(null);
    const earningsFetchedRef = useRef(false);
    const lastEarningsErrorToastAtRef = useRef(0);

    useEffect(() => {
        shownOrderIdsRef.current = shownOrderIds;
    }, [shownOrderIds]);
    useEffect(() => {
        newOrderAlertRef.current = newOrderAlert;
    }, [newOrderAlert]);

    useEffect(() => {
        if (role !== 'seller') {
            setSellerOrders([]);
            setOrdersLoading(false);
            return;
        }

        const fetchOrders = async (isInitial = false) => {
            try {
                if (isInitial) setOrdersLoading(true);
                const res = await sellerApi.getOrders();
                if (!res?.data?.success) return;

                const payload = res.data.result || {};
                const rawOrders = Array.isArray(payload.items)
                    ? payload.items
                    : (res.data.results || []);
                const allOrders = Array.isArray(rawOrders) ? rawOrders : [];
                setSellerOrders(allOrders);

                const pendingOrders = allOrders.filter((o) => {
                    const ws = (o.workflowStatus || '').toUpperCase();
                    if (ws === 'SELLER_PENDING') return true;
                    return (o?.status || '').toLowerCase() === 'pending';
                });

                if (isFirstLoadRef.current) {
                    const existingIds = new Set(pendingOrders.map((o) => o.orderId).filter(Boolean));
                    shownOrderIdsRef.current = existingIds;
                    isFirstLoadRef.current = false;
                    setShownOrderIds(existingIds);
                    return;
                }

                const newOrder = pendingOrders.find((o) => !shownOrderIdsRef.current.has(o.orderId));
                // CRITICAL FIX: If a modal is showing, but the order is no longer in the pending list, clear it.
                // This handles cases where the parent (restaurant) rejected the mixed order and it disappeared from polling.
                if (newOrderAlertRef.current) {
                    const currentId = String(newOrderAlertRef.current.orderId);
                    const stillPending = pendingOrders.some(o => String(o.orderId) === currentId);
                    if (!stillPending) {
                        console.log(`[DashboardLayout] Clearing stale order modal: #${currentId} is no longer pending.`);
                        setNewOrderAlert(null);
                        newOrderAlertRef.current = null;
                    }
                }

                if (!newOrder || newOrderAlertRef.current) return;

                setNewOrderAlert(newOrder);
                setShownOrderIds((prev) => new Set(prev).add(newOrder.orderId));
                shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(newOrder.orderId);
                newOrderAlertRef.current = newOrder;

                const audio = new Audio(resolveAudioSource(alertSound));
                audio.play().catch(() => {});
            } catch (error) {
                console.error("Polling Error:", error);
            } finally {
                if (isInitial) setOrdersLoading(false);
            }
        };

        fetchOrdersRef.current = () => fetchOrders(false);
        fetchOrders(true);
        const pollInterval = setInterval(() => fetchOrders(false), POLL_INTERVAL_MS);
        return () => clearInterval(pollInterval);
    }, [role]);

    useEffect(() => {
        if (role !== 'seller') return undefined;
        const getToken = () => localStorage.getItem('auth_seller');
        getOrderSocket(getToken);

        const offNew = onSellerOrderNew(getToken, () => {
            if (fetchOrdersRef.current) fetchOrdersRef.current();
        });

        const offStatus = onOrderStatusUpdate(getToken, (payload) => {
            const orderId = String(payload?.orderId || '').trim();
            if (!orderId) return;
            const raw = String(payload?.sellerStatus || payload?.orderStatus || '').trim().toLowerCase();
            if (!raw) return;

            // Terminal cancellation check – clear modal if this specific order is cancelled
            if (raw.includes('cancel')) {
                if (newOrderAlertRef.current && String(newOrderAlertRef.current.orderId) === orderId) {
                    setNewOrderAlert(null);
                    toast.error(`Order #${orderId} was cancelled by the customer/system.`);
                }
            }

            const nextStatus =
                raw === 'picked_up' ? 'out_for_delivery' :
                    raw === 'placed' || raw === 'created' ? 'pending' :
                        raw;
            const nextWorkflow = String(payload?.sellerWorkflowStatus || '').trim();

            setSellerOrders((prev) =>
                (Array.isArray(prev) ? prev : []).map((order) =>
                    String(order?.orderId || '') === orderId
                        ? {
                            ...order,
                            status: nextStatus,
                            ...(nextWorkflow ? { workflowStatus: nextWorkflow } : {}),
                        }
                        : order
                )
            );
        });

        const offCancel = onOrderCancelled(getToken, (payload) => {
            const orderId = String(payload?.orderId || '').trim();
            if (!orderId) return;
            
            if (newOrderAlertRef.current && String(newOrderAlertRef.current.orderId) === orderId) {
                setNewOrderAlert(null);
                toast.error(`Order #${orderId} has been cancelled.`);
            }
            
            // Also refresh orders to update list
            if (fetchOrdersRef.current) fetchOrdersRef.current();
        });

        const offHandoffOtp = onSellerHandoffOtp(getToken, (payload) => {
            if (payload && payload.otp) {
                toast.success(`Return Rider Arrived! Handoff OTP: ${payload.otp}`, {
                    description: "Share this OTP with the rider to receive the return items.",
                    duration: 30000,
                });
                
                const audio = new Audio(resolveAudioSource(alertSound));
                audio.play().catch(() => {});
            }
        });

        return () => {
            offNew?.();
            offStatus?.();
            offCancel?.();
            offHandoffOtp?.();
        };
    }, [role]);

    // Single earnings fetch when seller is on earnings/withdrawals/transactions – no duplicate calls
    useEffect(() => {
        if (role !== 'seller' || !isEarningsRoute(location.pathname)) {
            if (!isEarningsRoute(location.pathname)) earningsFetchedRef.current = false;
            return;
        }
        if (earningsFetchedRef.current) return;
        earningsFetchedRef.current = true;
        setEarningsLoading(true);

        sellerApi
            .getEarnings()
            .then((response) => {
                const raw = response?.data?.result ?? response?.data?.data;
                if (response?.data?.success && raw && typeof raw === 'object') {
                    setSellerEarningsData({
                        balances: raw.balances ?? {},
                        ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
                        monthlyChart: Array.isArray(raw.monthlyChart) ? raw.monthlyChart : [],
                    });
                }
            })
            .catch((err) => console.error("Earnings Fetch Error:", err))
            .finally(() => setEarningsLoading(false));
    }, [role, location.pathname]);

    // Keep earnings fresh while seller is on earnings-related pages (delivery updates can land after initial load).
    useEffect(() => {
        if (role !== 'seller') return undefined;
        if (!isEarningsRoute(location.pathname)) return undefined;

        const timer = setInterval(() => {
            refreshEarnings(true);
        }, 45000);

        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, location.pathname]);

    const refreshOrders = useCallback(() => {
        if (fetchOrdersRef.current) fetchOrdersRef.current();
    }, []);

    const refreshEarnings = useCallback((isSilent = false) => {
        earningsFetchedRef.current = false;
        if (!isSilent) setEarningsLoading(true);
        sellerApi
            .getEarnings()
            .then((response) => {
                const raw = response?.data?.result ?? response?.data?.data;
                if (response?.data?.success && raw && typeof raw === 'object') {
                    setSellerEarningsData({
                        balances: raw.balances ?? {},
                        ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
                        monthlyChart: Array.isArray(raw.monthlyChart) ? raw.monthlyChart : [],
                    });
                }
            })
            .catch((err) => {
                console.error("Earnings Fetch Error:", err);
                const msg = err?.response?.data?.message || "Failed to refresh earnings";
                // Avoid toast spam if the tab stays open and backend is down.
                const now = Date.now();
                if (now - lastEarningsErrorToastAtRef.current > 30000) {
                    lastEarningsErrorToastAtRef.current = now;
                    toast.error(msg, { duration: 2500 });
                }
            })
            .finally(() => {
                if (!isSilent) setEarningsLoading(false);
                earningsFetchedRef.current = true;
            });
    }, []);

    const sellerOrdersValue = useMemo(() => ({
        orders: role === 'seller' ? sellerOrders : [],
        ordersLoading: role === 'seller' ? ordersLoading : false,
        refreshOrders,
    }), [role, sellerOrders, ordersLoading, refreshOrders]);

    const sellerEarningsValue = useMemo(() => ({
        earningsData: role === 'seller' ? sellerEarningsData : defaultEarnings,
        earningsLoading: role === 'seller' ? earningsLoading : false,
        refreshEarnings,
    }), [role, sellerEarningsData, earningsLoading, refreshEarnings]);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Timer: driven by server expiry (sellerPendingExpiresAt), not a local 60s from modal open
    useEffect(() => {
        if (newOrderAlert) {
            const rawSec = newOrderAlert.acceptanceWindowSeconds ?? newOrderAlert.acceptanceWindow ?? 60;
            const validSec = Math.max(5, Math.min(180, Number(rawSec) || 60));
            acceptWindowTotalRef.current = validSec;
            setTimeLeft(validSec);

            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setNewOrderAlert(null);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [newOrderAlert]);

    const handleAcceptOrder = async (orderId) => {
        try {
            await sellerApi.updateOrderStatus(orderId, { status: 'confirmed' });
            toast.success(`Order #${orderId} Accepted!`);
            setNewOrderAlert(null);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                "Failed to accept order";
            toast.error(msg);
        }
    };

    const handleDeclineOrder = async (orderId) => {
        try {
            await sellerApi.updateOrderStatus(orderId, { status: 'cancelled' });
            toast.error(`Order #${orderId} Declined`);
            setNewOrderAlert(null);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                "Failed to update order";
            toast.error(msg);
        }
    };

    return (
        <div className="min-h-screen mesh-gradient-light relative" style={{ overflowX: 'clip' }}>
            {/* Background Blobs for depth */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

            <Sidebar
                items={navItems}
                title={title}
                isOpen={isSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                onClose={() => setIsSidebarOpen(false)}
                onToggleCollapse={handleToggleSidebar}
            />
            <div className={cn(
                "transition-all duration-300", 
                (role === "admin" || role === "seller") 
                    ? (isSidebarCollapsed ? "pl-0 md:pl-20" : "pl-0 md:pl-64") 
                    : (isSidebarCollapsed ? "pl-20" : "pl-64")
            )}>
                <Topbar 
                    onMenuClick={handleToggleSidebar} 
                    isSidebarCollapsed={isSidebarCollapsed} 
                />
                <main className={cn("min-h-[calc(100vh-4rem)]", (role === "admin" || role === "seller") ? "pb-20 md:pb-8" : "pb-20")}>
                    <div className="w-full px-2 sm:px-6 md:px-8 py-2.5 sm:py-6 md:py-8">
                        <SellerOrdersContext.Provider value={sellerOrdersValue}>
                            <SellerEarningsContext.Provider value={sellerEarningsValue}>
                                {children}
                            </SellerEarningsContext.Provider>
                        </SellerOrdersContext.Provider>
                    </div>
                </main>
            </div>

            {/* Global Order Alert Modal */}
            <AnimatePresence>
                {newOrderAlert && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="h-20 w-20 bg-[#fef4f4] rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <BellRing className="h-10 w-10 text-[#c41922]" />
                                </div>

                                <h2 className="text-2xl font-black text-slate-900 mb-2">New Order Received!</h2>
                                <p className="text-slate-600 font-medium mb-6">
                                    You have a new order <span className="text-[#c41922] font-bold">#{newOrderAlert.orderId}</span> for <span className="text-slate-900 font-bold">Rs {resolveSellerReceivable(newOrderAlert).toFixed(2)}</span>
                                </p>

                                {/* Timer Bar — width from real server deadline */}
                                <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-[width] duration-1000 ease-linear",
                                            timeLeft < 15 ? "bg-rose-500" : "bg-[#c41922]",
                                        )}
                                        style={{
                                            width: `${acceptWindowTotalRef.current > 0 ? (timeLeft / acceptWindowTotalRef.current) * 100 : 0}%`,
                                        }}
                                    />
                                </div>

                                <div className="flex items-center gap-4 text-sm font-bold mb-8">
                                    <Clock className={cn("h-4 w-4", timeLeft < 15 ? "text-rose-500 animate-pulse" : "text-slate-600")} />
                                    <span className={timeLeft < 15 ? "text-rose-500" : "text-slate-600"}>
                                        Accept within {timeLeft} {timeLeft === 1 ? "second" : "seconds"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <button
                                        onClick={() => handleDeclineOrder(newOrderAlert.orderId)}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleAcceptOrder(newOrderAlert.orderId)}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#c41922] text-white font-bold hover:bg-[#a2141c] shadow-xl shadow-[#e71d28]/20 transition-all active:scale-95"
                                    >
                                        <Check className="h-5 w-5" />
                                        Accept
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {(role === "admin" || role === "seller") && <BottomNav navItems={navItems} />}
        </div>
    );
};

export default DashboardLayout;

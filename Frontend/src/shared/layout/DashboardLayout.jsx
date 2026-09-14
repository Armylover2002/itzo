import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getOrderSocket, onSellerOrderNew, onOrderStatusUpdate, onOrderCancelled } from '@/core/services/orderSocket';
import alertSound from '@/modules/Food/assets/audio/alert.mp3';

const SELLER_DECLINE_REASONS = [
    'Out of stock',
    'Shop closed / busy',
    'Incorrect item pricing or weight',
    'Unable to fulfill due to delivery issues',
    'Other',
];

/** Socket is primary; HTTP poll is only a safety net. */
const POLL_WHEN_SOCKET_OK_MS = 60000;
const POLL_WHEN_SOCKET_DOWN_MS = 20000;
const SOCKET_REFRESH_DEBOUNCE_MS = 2000;
const EARNINGS_POLL_MS = 60000;

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
    path.includes('earnings') ||
    path.includes('withdrawals') ||
    path.includes('transactions') ||
    path.includes('returns');

const DashboardLayout = ({ children, navItems, title }) => {
    const [newOrderAlert, setNewOrderAlert] = useState(null);
    const [shownOrderIds, setShownOrderIds] = useState(() => new Set());
    const [declineModalOpen, setDeclineModalOpen] = useState(false);
    const [declineReasonPreset, setDeclineReasonPreset] = useState(SELLER_DECLINE_REASONS[0]);
    const [declineReasonOther, setDeclineReasonOther] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    /** Total seconds in this acceptance window (for progress bar), set when modal opens */
    const acceptWindowTotalRef = useRef(60);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('dashboard-sidebar-collapsed') === '1';
        } catch {
            return false;
        }
    });
    const { user, logout, role } = useAuth();
    const location = useLocation();

    useEffect(() => {
        try {
            localStorage.setItem('dashboard-sidebar-collapsed', isSidebarCollapsed ? '1' : '0');
        } catch {
            /* ignore */
        }
    }, [isSidebarCollapsed]);

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
    const socketRefreshTimerRef = useRef(null);
    const pollTimerRef = useRef(null);
    const socketConnectedRef = useRef(false);
    const alertAudioRef = useRef(null);

    const stopSellerOrderRing = useCallback(() => {
        const audio = alertAudioRef.current;
        if (audio) {
            try {
                audio.pause();
                audio.loop = false;
                audio.currentTime = 0;
            } catch {
                /* ignore */
            }
        }
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(0);
        }
        if (typeof window !== 'undefined' && window.flutter_inappwebview?.callHandler) {
            ['stopNotificationSound', 'stopRinging', 'stopAlertSound'].forEach((handlerName) => {
                try {
                    const result = window.flutter_inappwebview.callHandler(handlerName);
                    if (result && typeof result.catch === 'function') result.catch(() => {});
                } catch {
                    /* handler not implemented */
                }
            });
        }
    }, []);

    const startSellerOrderRing = useCallback(() => {
        if (!alertAudioRef.current) {
            const audio = new Audio(resolveAudioSource(alertSound));
            audio.preload = 'auto';
            audio.volume = 1;
            alertAudioRef.current = audio;
        }
        const audio = alertAudioRef.current;
        audio.loop = true;
        audio.muted = false;
        audio.volume = 1;
        try {
            audio.currentTime = 0;
        } catch {
            /* ignore */
        }
        audio.play().catch(() => {});
    }, []);

    useEffect(() => {
        shownOrderIdsRef.current = shownOrderIds;
    }, [shownOrderIds]);
    useEffect(() => {
        newOrderAlertRef.current = newOrderAlert;
    }, [newOrderAlert]);

    const scheduleOrdersPoll = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        if (role !== 'seller') return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        const intervalMs = socketConnectedRef.current
            ? POLL_WHEN_SOCKET_OK_MS
            : POLL_WHEN_SOCKET_DOWN_MS;

        pollTimerRef.current = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            fetchOrdersRef.current?.({ silent: true });
        }, intervalMs);
    }, [role]);

    const queueSocketOrdersRefresh = useCallback(() => {
        if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
        socketRefreshTimerRef.current = setTimeout(() => {
            socketRefreshTimerRef.current = null;
            fetchOrdersRef.current?.({ silent: true, forceRefresh: true });
        }, SOCKET_REFRESH_DEBOUNCE_MS);
    }, []);

    useEffect(() => {
        if (role !== 'seller') {
            setSellerOrders([]);
            setOrdersLoading(false);
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            return undefined;
        }

        const fetchOrders = async ({ silent = false, forceRefresh = false } = {}) => {
            if (!silent && isFirstLoadRef.current) setOrdersLoading(true);

            try {
                const res = await sellerApi.getOrders({}, { forceRefresh });
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
                const pendingId = (o) => String(o?.orderId || '').trim();

                if (isFirstLoadRef.current) {
                    const existingIds = new Set(pendingOrders.map(pendingId).filter(Boolean));
                    shownOrderIdsRef.current = existingIds;
                    isFirstLoadRef.current = false;
                    setShownOrderIds(existingIds);
                    return;
                }

                const newOrder = pendingOrders.find((o) => {
                    const id = pendingId(o);
                    return id && !shownOrderIdsRef.current.has(id);
                });
                // If a modal is showing but the order left pending, clear it (e.g. parent rejected).
                if (newOrderAlertRef.current) {
                    const currentId = String(newOrderAlertRef.current.orderId);
                    const stillPending = pendingOrders.some((o) => pendingId(o) === currentId);
                    if (!stillPending) {
                        setNewOrderAlert(null);
                        newOrderAlertRef.current = null;
                        setDeclineModalOpen(false);
                    }
                }

                if (!newOrder || newOrderAlertRef.current) return;

                const newOrderId = pendingId(newOrder);
                setNewOrderAlert(newOrder);
                setShownOrderIds((prev) => new Set(prev).add(newOrderId));
                shownOrderIdsRef.current = new Set(shownOrderIdsRef.current).add(newOrderId);
                newOrderAlertRef.current = newOrder;
            } catch (error) {
                console.error("Polling Error:", error);
            } finally {
                setOrdersLoading(false);
            }
        };

        fetchOrdersRef.current = fetchOrders;
        fetchOrders({ silent: false });
        scheduleOrdersPoll();

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchOrdersRef.current?.({ silent: true });
                scheduleOrdersPoll();
            } else if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            if (socketRefreshTimerRef.current) {
                clearTimeout(socketRefreshTimerRef.current);
                socketRefreshTimerRef.current = null;
            }
            stopSellerOrderRing();
        };
    }, [role, scheduleOrdersPoll, stopSellerOrderRing]);

    useEffect(() => {
        if (!newOrderAlert) {
            stopSellerOrderRing();
            return undefined;
        }
        startSellerOrderRing();
        return () => stopSellerOrderRing();
    }, [newOrderAlert, startSellerOrderRing, stopSellerOrderRing]);

    useEffect(() => {
        if (role !== 'seller') return undefined;
        const getToken = () => localStorage.getItem('auth_seller');
        const socket = getOrderSocket(getToken);

        const syncSocketState = () => {
            socketConnectedRef.current = Boolean(socket?.connected);
            scheduleOrdersPoll();
        };
        syncSocketState();
        socket?.on('connect', syncSocketState);
        socket?.on('disconnect', syncSocketState);

        const offNew = onSellerOrderNew(getToken, () => {
            queueSocketOrdersRefresh();
        });

        const offStatus = onOrderStatusUpdate(getToken, (payload) => {
            const orderId = String(payload?.orderId || '').trim();
            if (!orderId) return;
            const raw = String(payload?.sellerStatus || payload?.orderStatus || '').trim().toLowerCase();
            if (!raw) return;

            // Terminal cancellation check – clear modal if this specific order is cancelled
            if (raw.includes('cancel')) {
                if (newOrderAlertRef.current && String(newOrderAlertRef.current.orderId) === orderId) {
                    stopSellerOrderRing();
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
                            ...(payload?.dispatchStatus ? { dispatchStatus: payload.dispatchStatus } : {}),
                            ...(payload?.deliveryPartner !== undefined ? { deliveryPartner: payload.deliveryPartner } : {}),
                            ...(payload?.deliveryState ? { deliveryState: payload.deliveryState } : {}),
                            ...(payload?.deliveryVerification ? { deliveryVerification: payload.deliveryVerification } : {}),
                        }
                        : order
                )
            );
        });

        const offCancel = onOrderCancelled(getToken, (payload) => {
            const orderId = String(payload?.orderId || '').trim();
            if (!orderId) return;
            
            if (newOrderAlertRef.current && String(newOrderAlertRef.current.orderId) === orderId) {
                stopSellerOrderRing();
                setNewOrderAlert(null);
                toast.error(`Order #${orderId} has been cancelled.`);
            }
            
            queueSocketOrdersRefresh();
        });

        return () => {
            socket?.off('connect', syncSocketState);
            socket?.off('disconnect', syncSocketState);
            offNew?.();
            offStatus?.();
            offCancel?.();
        };
    }, [role, scheduleOrdersPoll, queueSocketOrdersRefresh, stopSellerOrderRing]);

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
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            refreshEarnings();
        }, EARNINGS_POLL_MS);

        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, location.pathname]);

    const refreshOrders = () => {
        fetchOrdersRef.current?.({ silent: true, forceRefresh: true });
    };
    const refreshEarnings = () => {
        setEarningsLoading(true);
        sellerApi
            .getEarnings({ forceRefresh: true })
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
                setEarningsLoading(false);
                earningsFetchedRef.current = true;
            });
    };

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Timer: driven by server expiry (sellerPendingExpiresAt), not a local 60s from modal open
    useEffect(() => {
        if (!newOrderAlert) return undefined;

        const left = secondsLeftUntilSellerExpiry(newOrderAlert);
        if (left <= 0) {
            stopSellerOrderRing();
            setNewOrderAlert(null);
            toast.error("This order has already expired — you can no longer accept it.");
            return undefined;
        }

        acceptWindowTotalRef.current = left;
        setTimeLeft(left);

        const timer = setInterval(() => {
            const next = secondsLeftUntilSellerExpiry(newOrderAlertRef.current);
            setTimeLeft(next);
            if (next <= 0) {
                clearInterval(timer);
                stopSellerOrderRing();
                setNewOrderAlert(null);
                toast.error("Order timed out!");
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [newOrderAlert, stopSellerOrderRing]);

    const handleAcceptOrder = async (orderId) => {
        stopSellerOrderRing();
        setNewOrderAlert(null);
        setSellerOrders((prev) =>
            (Array.isArray(prev) ? prev : []).map((order) =>
                String(order?.orderId || '') === String(orderId)
                    ? { ...order, status: 'confirmed', workflowStatus: 'SELLER_ACCEPTED' }
                    : order
            )
        );
        try {
            await sellerApi.updateOrderStatus(orderId, { status: 'confirmed' });
            toast.success(`Order #${orderId} Accepted!`);
            refreshOrders();
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                "Failed to accept order";
            toast.error(msg);
        }
    };

    const openDeclineModal = () => {
        setDeclineReasonPreset(SELLER_DECLINE_REASONS[0]);
        setDeclineReasonOther('');
        setDeclineModalOpen(true);
    };

    const closeDeclineModal = () => {
        if (isDeclining) return;
        setDeclineModalOpen(false);
        setDeclineReasonOther('');
        setDeclineReasonPreset(SELLER_DECLINE_REASONS[0]);
    };

    const handleDeclineOrder = async () => {
        const orderId = newOrderAlert?.orderId;
        if (!orderId) return;

        const finalReason =
            declineReasonPreset === 'Other'
                ? String(declineReasonOther || '').trim()
                : declineReasonPreset;

        if (!finalReason) {
            toast.error('Please provide a cancellation reason');
            return;
        }

        setIsDeclining(true);
        stopSellerOrderRing();
        try {
            await sellerApi.updateOrderStatus(orderId, {
                status: 'cancelled',
                reason: finalReason,
            });
            toast.error(`Order #${orderId} Declined`);
            setDeclineModalOpen(false);
            setDeclineReasonOther('');
            setDeclineReasonPreset(SELLER_DECLINE_REASONS[0]);
            setNewOrderAlert(null);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                "Failed to update order";
            toast.error(msg);
        } finally {
            setIsDeclining(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-x-hidden seller-theme-scope">
            {/* Premium Ambient Background Glow */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-500/15 rounded-full blur-[140px] -z-10 animate-pulse pointer-events-none" style={{ animationDuration: '8s' }}></div>
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-500/15 rounded-full blur-[140px] -z-10 animate-pulse pointer-events-none" style={{ animationDelay: '4s', animationDuration: '10s' }}></div>

            <Sidebar
                items={navItems}
                title={title}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                collapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
            />
            <div className={cn(
                "transition-all duration-300",
                (role === "admin" || role === "seller")
                    ? (isSidebarCollapsed ? "pl-0 md:pl-[4.5rem]" : "pl-0 md:pl-80")
                    : "pl-80"
            )}>
                <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                <main className={cn("min-h-screen", (role === "admin" || role === "seller") ? (role === "seller" ? "pt-[7.25rem] md:pt-6 pb-28 md:pb-8" : "pt-20 md:pt-6 pb-28 md:pb-8") : "pt-20")}>
                    <div className="w-full ">
                        <SellerOrdersContext.Provider
                            value={{
                                orders: role === 'seller' ? sellerOrders : [],
                                ordersLoading: role === 'seller' ? ordersLoading : false,
                                refreshOrders,
                            }}>
                            <SellerEarningsContext.Provider
                                value={{
                                    earningsData: role === 'seller' ? sellerEarningsData : defaultEarnings,
                                    earningsLoading: role === 'seller' ? earningsLoading : false,
                                    refreshEarnings,
                                }}>
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
                                <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <BellRing className="h-10 w-10 text-red-500" />
                                </div>

                                <h2 className="text-2xl font-black text-slate-900 mb-2">New Order Received!</h2>
                                <p className="text-slate-600 font-medium mb-6">
                                    You have a new order <span className="text-red-500 font-bold">#{newOrderAlert.orderId}</span> for <span className="text-slate-900 font-bold">Rs {resolveSellerReceivable(newOrderAlert).toFixed(2)}</span>
                                </p>

                                {/* Timer Bar — width from real server deadline */}
                                <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-[width] duration-1000 ease-linear",
                                            timeLeft < 15 ? "bg-rose-500" : "bg-red-500",
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
                                        type="button"
                                        onClick={openDeclineModal}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                        Decline
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAcceptOrder(newOrderAlert.orderId)}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-500/90 shadow-xl shadow-red-500/20 transition-all active:scale-95"
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

            <AnimatePresence>
                {declineModalOpen && newOrderAlert && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 12 }}
                            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
                        >
                            <h3 className="text-lg font-black text-slate-900">
                                Decline Order #{newOrderAlert.orderId}
                            </h3>
                            <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                                Please select a reason for declining this order. This reason will be shared with the customer and recorded in the system.
                            </p>

                            <div className="mt-4 space-y-2">
                                {SELLER_DECLINE_REASONS.map((reason) => (
                                    <label
                                        key={reason}
                                        className={cn(
                                            'flex items-center gap-3 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all hover:bg-slate-50',
                                            declineReasonPreset === reason
                                                ? 'border-red-500 bg-red-500/5 text-red-500'
                                                : 'border-slate-100 text-slate-700 bg-white',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="sellerDeclinePreset"
                                            checked={declineReasonPreset === reason}
                                            onChange={() => setDeclineReasonPreset(reason)}
                                            className="accent-primary h-4 w-4"
                                        />
                                        {reason}
                                    </label>
                                ))}
                            </div>

                            {declineReasonPreset === 'Other' && (
                                <div className="mt-4">
                                    <textarea
                                        value={declineReasonOther}
                                        onChange={(e) => setDeclineReasonOther(e.target.value)}
                                        placeholder="Describe your reason in detail..."
                                        rows={3}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/5 outline-none transition-all resize-none"
                                    />
                                </div>
                            )}

                            <div className="mt-6 flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={closeDeclineModal}
                                    disabled={isDeclining}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-60"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeclineOrder}
                                    disabled={isDeclining}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-60"
                                >
                                    {isDeclining ? 'Declining...' : 'Confirm Decline'}
                                </button>
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

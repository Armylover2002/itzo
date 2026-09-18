import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu
} from 'react-icons/hi';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';
import { SELLER_LIVE_UPDATE_EVENT } from '@/modules/seller/components/SellerLiveUpdates';
import {
    getAppLogo,
    getCompanyName,
    subscribeBusinessSettings,
} from '@/modules/common/utils/businessSettings';
import { onSellerNotification, onSellerOrderNew } from '@/core/services/orderSocket';

const NOTIF_POLL_MS = 15000;

const Topbar = ({ onMenuClick }) => {
    const { user, logout, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchQuery, setSearchQuery] = React.useState('');
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const notificationRef = React.useRef(null);
    const pollTimerRef = React.useRef(null);

    const isSeller = location.pathname.startsWith('/seller');
    const [logoUrl, setLogoUrl] = React.useState(() => (isSeller ? getAppLogo('seller') : ''));
    const [companyName, setCompanyName] = React.useState(() => getCompanyName());

    React.useEffect(() => {
        if (!isSeller) return undefined;
        const apply = () => {
            setLogoUrl(getAppLogo('seller'));
            setCompanyName(getCompanyName());
        };
        apply();
        return subscribeBusinessSettings(apply);
    }, [isSeller]);

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        if (isSeller) {
            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = React.useCallback(async ({ forceRefresh = false } = {}) => {
        try {
            if (!isSeller) return;

            const response = await sellerApi.getNotifications({ forceRefresh });
            const payload = response?.data?.result ?? response?.data?.data ?? {};
            if (response?.data?.success) {
                setNotifications(payload.notifications || payload.items || []);
                setUnreadCount(Number(payload.unreadCount || 0));
            }
        } catch (error) {
            console.error("Notif Fetch Error:", error);
        }
    }, [isSeller]);

    const startNotifPoll = React.useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        if (!isSeller) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        pollTimerRef.current = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            fetchNotifications({ forceRefresh: true });
        }, NOTIF_POLL_MS);
    }, [isSeller, fetchNotifications]);

    React.useEffect(() => {
        if (!isSeller) {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            return undefined;
        }

        fetchNotifications({ forceRefresh: true });
        startNotifPoll();

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchNotifications({ forceRefresh: true });
                startNotifPoll();
            } else if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
        const onLiveUpdate = () => {
            fetchNotifications({ forceRefresh: true });
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener(SELLER_LIVE_UPDATE_EVENT, onLiveUpdate);

        const getToken = () =>
            localStorage.getItem('auth_seller') ||
            localStorage.getItem('seller_accessToken') ||
            localStorage.getItem('accessToken');

        const refresh = () => fetchNotifications({ forceRefresh: true });
        const offNotif = onSellerNotification(getToken, refresh);
        const offNew = onSellerOrderNew(getToken, refresh);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener(SELLER_LIVE_UPDATE_EVENT, onLiveUpdate);
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            offNotif?.();
            offNew?.();
        };
    }, [isSeller, fetchNotifications, startNotifPoll]);

    // Close the seller notification sheet on outside tap or dashboard scroll.
    React.useEffect(() => {
        if (!showNotifications) return undefined;

        const isInsideSheet = (target) =>
            Boolean(notificationRef.current && notificationRef.current.contains(target));

        const handlePointerOutside = (event) => {
            if (isInsideSheet(event.target)) return;
            setShowNotifications(false);
        };

        document.addEventListener('pointerdown', handlePointerOutside, true);
        document.addEventListener('touchstart', handlePointerOutside, { capture: true, passive: true });

        if (!isSeller) {
            return () => {
                document.removeEventListener('pointerdown', handlePointerOutside, true);
                document.removeEventListener('touchstart', handlePointerOutside, true);
            };
        }

        const handleDashboardScroll = (event) => {
            if (isInsideSheet(event.target)) return;
            setShowNotifications(false);
        };

        window.addEventListener('scroll', handleDashboardScroll, true);
        document.addEventListener('wheel', handleDashboardScroll, { capture: true, passive: true });
        document.addEventListener('touchmove', handleDashboardScroll, { capture: true, passive: true });

        return () => {
            document.removeEventListener('pointerdown', handlePointerOutside, true);
            document.removeEventListener('touchstart', handlePointerOutside, true);
            window.removeEventListener('scroll', handleDashboardScroll, true);
            document.removeEventListener('wheel', handleDashboardScroll, true);
            document.removeEventListener('touchmove', handleDashboardScroll, true);
        };
    }, [showNotifications, isSeller]);

    const handleMarkAsRead = async (id) => {
        try {
            await sellerApi.markNotificationRead(id);
            fetchNotifications({ forceRefresh: true });
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    const handleOpenNotification = (notif) => {
        if (!notif) return;
        if (!notif.isRead && notif._id) {
            handleMarkAsRead(notif._id);
        }
        const link = notif.metadata?.link || notif.link;
        if (link) {
            setShowNotifications(false);
            navigate(link);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await sellerApi.markAllNotificationsRead();
            fetchNotifications({ forceRefresh: true });
            toast.success("All caught up!");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const handleLogout = () => {
        logout();
    };

    const toggleNotifications = () => {
        const next = !showNotifications;
        setShowNotifications(next);
        if (next) fetchNotifications({ forceRefresh: true });
    };

    const handleViewAll = () => {
        setShowNotifications(false);
        navigate('/seller/notifications');
    };

    React.useEffect(() => {
        setShowNotifications(false);
    }, [location.pathname]);

    return (
        <header className={cn(
            "bg-white/80 backdrop-blur-xl transition-all duration-300 z-50 relative",
            (role === 'admin' || role === 'seller')
                ? cn(
                    "fixed top-2 left-2 right-2 rounded-2xl border border-gray-200/60 shadow-sm px-3 md:sticky md:top-0 md:left-0 md:right-0 md:rounded-none md:border-t-0 md:border-x-0 md:border-b md:border-gray-100/50 md:shadow-[0_4px_30px_rgba(0,0,0,0.02)] md:h-16 md:px-4",
                    isSeller ? "h-auto py-2 md:py-0" : "h-14"
                  )
                : "fixed top-2 left-2 right-2 rounded-2xl border border-gray-200/60 shadow-sm h-14 px-4 md:top-0 md:left-56 md:right-0 md:rounded-none md:border-t-0 md:border-x-0 md:border-b md:h-16 md:px-6"
        )}>
            <div className={cn(
                "w-full h-full",
                isSeller ? "flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-0" : "flex items-center justify-between",
                role === 'seller' ? "" : "max-w-7xl mx-auto"
            )}>
                <div className={cn(
                    "flex items-center",
                    isSeller ? "w-full min-h-8 pr-[5.5rem] md:pr-0 md:flex-1 md:mr-4 md:overflow-hidden" : "flex-1 mr-4 overflow-hidden"
                )}>
                    <button
                        onClick={onMenuClick}
                        className={cn(
                            "p-2 mr-1.5 rounded-xl text-gray-600 transition-all duration-300 md:hidden shrink-0",
                            isSeller ? "hover:text-red-500" : "hover:text-primary"
                        )}
                    >
                        <HiOutlineMenu className="h-5 w-5" />
                    </button>

                    {isSeller ? (
                        <button
                            type="button"
                            onClick={() => navigate('/seller')}
                            className="shrink-0 mr-2 flex items-center"
                            aria-label={companyName || 'ItzoFood'}
                        >
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={companyName || 'ItzoFood'}
                                    className="h-8 w-auto max-w-[120px] object-contain object-left"
                                />
                            ) : (
                                <span className="h-8 w-8 rounded-lg bg-red-600 text-white font-bold text-sm flex items-center justify-center">
                                    {(companyName || 'B').charAt(0)}
                                </span>
                            )}
                        </button>
                    ) : null}

                    <form onSubmit={handleSearchSubmit} className={cn(
                        "relative group",
                        isSeller ? "hidden md:block md:w-[320px] lg:w-[380px] md:flex-1 md:max-w-[380px]" : "w-full md:w-[320px] lg:w-[380px]"
                    )}>
                        <HiOutlineSearch className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 transition-all duration-300", isSeller ? "group-focus-within:text-red-500" : "group-focus-within:text-primary")} />
                        <input
                            type="text"
                            placeholder={isSeller ? "Search products by name or SKU" : "Search anything..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                            className={cn("w-full pl-10 pr-4 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white transition-all duration-500 outline-none", isSeller ? "focus:ring-2 focus:ring-red-500/10 focus:border-red-500/20" : "focus:ring-2 focus:ring-primary/10 focus:border-primary/20")}
                        />
                    </form>

                </div>

                {isSeller ? (
                    <form onSubmit={handleSearchSubmit} className="relative w-full group md:hidden">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-red-500 transition-all" />
                        <input
                            type="search"
                            enterKeyHint="search"
                            placeholder="Search products by name or SKU"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                            className="w-full min-w-0 pl-10 pr-3 py-2 bg-gray-100/70 border border-transparent rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-red-500/10 focus:border-red-500/20 transition-all outline-none"
                        />
                    </form>
                ) : null}

                <div className={cn("flex items-center gap-3 shrink-0", isSeller && "absolute right-3 top-2 md:static md:right-auto md:top-auto")}>
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={toggleNotifications}
                            className={cn(
                                "p-2 text-gray-500 rounded-xl transition-all duration-300 relative group",
                                isSeller ? "hover:bg-red-500/5 hover:text-red-500" : "hover:bg-primary/5 hover:text-primary",
                                showNotifications && (isSeller ? "bg-red-500/5 text-red-500" : "bg-primary/5 text-primary")
                            )}
                        >
                            <HiOutlineBell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white shadow-sm"></span>
                            )}
                        </button>

                        <AnimatePresence>
                            {showNotifications && (
                                <NotificationPopup
                                    notifications={notifications}
                                    onMarkAsRead={handleMarkAsRead}
                                    onMarkAllAsRead={handleMarkAllAsRead}
                                    onOpenNotification={handleOpenNotification}
                                    onClose={() => setShowNotifications(false)}
                                    onViewAll={isSeller ? handleViewAll : undefined}
                                    isSeller={isSeller}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>
                    
                    <button
                        onClick={() => {
                            if (location.pathname.startsWith('/ecs')) {
                                navigate('/ecs/profile');
                            } else if (location.pathname.startsWith('/seller')) {
                                navigate('/seller/profile');
                            } else if (location.pathname.startsWith('/delivery')) {
                                navigate('/delivery/profile');
                            } else {
                                navigate('/profile');
                            }
                        }}
                    >
                        <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg hover:scale-105 transition-transform overflow-hidden",
                            isSeller
                                ? "bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/20"
                                : "bg-gradient-to-br from-primary to-indigo-600 shadow-primary/20"
                        )}>
                            {isSeller && user?.shopInfo?.shopImage ? (
                                <img src={user.shopInfo.shopImage} alt="Shop" className="h-full w-full object-cover" />
                            ) : (
                                user?.name?.[0]?.toUpperCase() || 'A'
                            )}
                        </div>
                    </button>
                    
                    <button
                        onClick={handleLogout}
                        className="hidden md:flex items-center space-x-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 font-bold text-xs shadow-sm hover:shadow-rose-100/50"
                    >
                        <HiOutlineLogout className="h-4 w-4" />
                        <span className="hidden lg:block">Sign Out</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Topbar;

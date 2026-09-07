import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineUserCircle,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu
} from 'react-icons/hi';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { AnimatePresence } from 'framer-motion';
import { Store, PanelLeftOpen, PanelLeftClose, ChevronLeft, ChevronRight } from 'lucide-react';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';

const Topbar = ({ onMenuClick, isSidebarCollapsed }) => {
    const { user, logout, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchQuery, setSearchQuery] = React.useState('');
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const notificationRef = React.useRef(null);

    const isSeller = location.pathname.startsWith('/seller');

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        if (isSeller) {
            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = async () => {
        try {
            // Only fetch for sellers for now as per request
            if (!isSeller) return;

            const response = await sellerApi.getNotifications();
            if (response.data.success) {
                setNotifications(response.data.result.notifications);
                setUnreadCount(response.data.result.unreadCount);
            }
        } catch (error) {
            console.error("Notif Fetch Error:", error);
        }
    };

    React.useEffect(() => {
        fetchNotifications();
        // Polling every 60 seconds
        const interval = setInterval(fetchNotifications, 60000);
        const onUpdate = () => fetchNotifications();
        window.addEventListener('sellerNotificationsUpdated', onUpdate);
        return () => {
            clearInterval(interval);
            window.removeEventListener('sellerNotificationsUpdated', onUpdate);
        };
    }, [isSeller]);

    // Handle Click Outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await sellerApi.markNotificationRead(id);
            fetchNotifications();
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await sellerApi.markAllNotificationsRead();
            fetchNotifications();
            toast.success("All caught up!");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const [sellerProfile, setSellerProfile] = React.useState(null);

    React.useEffect(() => {
        if (!isSeller) return;
        let isMounted = true;

        const loadSellerProfile = async () => {
            try {
                const res = await sellerApi.getProfile();
                const data = res?.data?.result || res?.data?.data;
                if (isMounted && data) {
                    setSellerProfile(data);
                }
            } catch (err) {
                // Fallback gracefully to user from auth context
            }
        };

        loadSellerProfile();

        const handleProfileUpdate = () => {
            loadSellerProfile();
        };
        window.addEventListener('sellerProfileUpdated', handleProfileUpdate);
        window.addEventListener('userAuthChanged', handleProfileUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('sellerProfileUpdated', handleProfileUpdate);
            window.removeEventListener('userAuthChanged', handleProfileUpdate);
        };
    }, [isSeller]);

    const shopName =
        sellerProfile?.shopName ||
        user?.shopName ||
        user?.storeName ||
        (user?.name ? `${user.name}'s Shop` : 'My Store');

    const shopImage =
        sellerProfile?.shopInfo?.shopImage ||
        sellerProfile?.shopPhoto ||
        sellerProfile?.shopImage ||
        sellerProfile?.logo ||
        user?.shopInfo?.shopImage ||
        user?.shopPhoto ||
        user?.shopImage ||
        user?.avatar ||
        '';

    const ownerName = sellerProfile?.name || user?.name || '';
    const businessType = sellerProfile?.shopInfo?.businessType || 'Quick Commerce';

    const handleLogout = () => {
        logout();
    };

    return (
        <header className={cn(
            "bg-white/85 backdrop-blur-xl border-b border-gray-200/70 flex items-center justify-between shadow-sm transition-all duration-300 sticky top-0 z-40 w-full h-16 px-4 md:px-6"
        )}>
            <div className="flex items-center flex-1 mr-4 overflow-hidden">
                <button
                    onClick={onMenuClick}
                    className="p-1.5 mr-2 text-slate-700 hover:text-[#E71D28] hover:bg-slate-100/80 rounded-lg transition-all duration-200 border-0 bg-transparent flex items-center justify-center cursor-pointer"
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Close Sidebar"}
                >
                    {isSidebarCollapsed ? (
                        <ChevronRight className="h-5 w-5 stroke-[2.5] text-[#E71D28]" />
                    ) : (
                        <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
                    )}
                </button>

                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-[400px] group">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-all duration-300" />
                    <input
                        type="text"
                        placeholder={isSeller ? "Search products by name or SKU..." : "Search anything..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/20 transition-all duration-500 outline-none"
                    />
                </form>
            </div>

            <div className="flex items-center space-x-3 md:space-x-4">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={cn(
                            "p-2 hover:bg-primary/5 text-gray-500 hover:text-primary rounded-xl transition-all duration-300 relative group",
                            showNotifications && "bg-primary/5 text-primary"
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
                                onClose={() => setShowNotifications(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-8 w-px bg-gray-200/80 mx-1"></div>

                {isSeller ? (
                    <button
                        onClick={() => navigate('/seller/profile')}
                        className="flex items-center space-x-2.5 p-1.5 pr-3 hover:bg-slate-100/80 rounded-2xl transition-all duration-200 group border border-transparent hover:border-slate-200/80 shadow-sm"
                        title="View Store Profile"
                    >
                        <div className="relative flex-shrink-0">
                            {shopImage ? (
                                <img
                                    src={shopImage}
                                    alt={shopName}
                                    className="h-10 w-10 rounded-xl object-cover border border-slate-200 shadow-sm group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                            ) : null}
                            <div className={cn(
                                "h-10 w-10 rounded-xl bg-gradient-to-br from-[#E71D28] to-[#a2141c] flex items-center justify-center text-white shadow-md shadow-[#E71D28]/20 group-hover:scale-105 transition-transform",
                                shopImage ? "hidden" : "flex"
                            )}>
                                <Store className="h-5 w-5 text-white" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-xs md:text-sm font-bold text-slate-900 leading-tight group-hover:text-[#E71D28] transition-colors truncate max-w-[130px] md:max-w-[180px]">
                                {shopName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight truncate max-w-[130px] md:max-w-[180px] mt-0.5">
                                {ownerName ? `${ownerName} • Store` : businessType}
                            </p>
                        </div>
                    </button>
                ) : (
                    <button
                        onClick={() => {
                            if (location.pathname.startsWith('/ecs')) {
                                navigate('/ecs/profile');
                            } else if (location.pathname.startsWith('/delivery')) {
                                navigate('/delivery/profile');
                            } else {
                                navigate('/profile');
                            }
                        }}
                        className="flex items-center space-x-2.5 p-1 pr-3 hover:bg-gray-50 rounded-xl transition-all duration-300 group ring-1 ring-transparent hover:ring-gray-100 shadow-sm hover:shadow-md"
                    >
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg group-hover:scale-105 transition-transform bg-gradient-to-br from-primary to-[#c41922] shadow-primary/20">
                            {user?.name?.[0] || 'A'}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-900 leading-tight">{user?.name || 'Demo User'}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{user?.role || 'Member'}</p>
                        </div>
                    </button>
                )}

                {/* Sign out button shown only when not seller (seller has it in sidebar bottom) */}
                {!isSeller && (
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 font-bold text-xs shadow-sm hover:shadow-rose-100/50"
                    >
                        <HiOutlineLogout className="h-4 w-4" />
                        <span className="hidden lg:block">Sign Out</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Topbar;


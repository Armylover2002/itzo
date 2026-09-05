import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    HiOutlineBell,
    HiOutlineTruck,
    HiOutlineCurrencyDollar,
    HiOutlineArrowPath,
    HiOutlineCheck
} from 'react-icons/hi2';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BlurFade } from '@/components/ui/blur-fade';

const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

const getNotificationIcon = (type) => {
    switch (type) {
        case 'order':
            return {
                icon: HiOutlineTruck,
                bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            };
        case 'payment':
            return {
                icon: HiOutlineCurrencyDollar,
                bg: 'bg-amber-50 text-amber-600 border-amber-100',
            };
        default:
            return {
                icon: HiOutlineBell,
                bg: 'bg-rose-50 text-[#E71D28] border-rose-100',
            };
    }
};

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    const fetchNotifications = async (showToast = false) => {
        try {
            setLoading(true);
            const response = await sellerApi.getNotifications();
            if (response.data.success) {
                const list = Array.isArray(response.data.result?.notifications)
                    ? response.data.result.notifications
                    : [];
                setNotifications(list);
                setUnreadCount(Number(response.data.result?.unreadCount) || 0);
                if (showToast) toast.success('Notifications refreshed');
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
            if (showToast) toast.error('Failed to refresh notifications');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await sellerApi.markNotificationRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            window.dispatchEvent(new CustomEvent('sellerNotificationsUpdated'));
        } catch (error) {
            toast.error('Failed to mark as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;
        try {
            await sellerApi.markAllNotificationsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
            toast.success('All marked as read');
            window.dispatchEvent(new CustomEvent('sellerNotificationsUpdated'));
        } catch (error) {
            toast.error('Failed to mark all as read');
        }
    };

    const filteredNotifications = useMemo(() => {
        if (activeTab === 'unread') {
            return notifications.filter((n) => !n.isRead);
        }
        if (activeTab === 'order') {
            return notifications.filter((n) => n.type === 'order');
        }
        if (activeTab === 'payment') {
            return notifications.filter((n) => n.type === 'payment');
        }
        return notifications;
    }, [notifications, activeTab]);

    const orderCount = useMemo(
        () => notifications.filter((n) => n.type === 'order').length,
        [notifications]
    );
    const paymentCount = useMemo(
        () => notifications.filter((n) => n.type === 'payment').length,
        [notifications]
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-16">
            <BlurFade delay={0.05}>
                {/* Header */}
                <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#E71D28] to-[#a2141c] flex items-center justify-center text-white shadow-md shadow-[#E71D28]/20">
                                <HiOutlineBell className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                                    Notifications
                                    {unreadCount > 0 && (
                                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#E71D28] text-white">
                                            {unreadCount} new
                                        </span>
                                    )}
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">
                                    Track orders, payouts, status updates, and announcements
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchNotifications(true)}
                            className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all active:scale-95"
                            title="Refresh"
                        >
                            <HiOutlineArrowPath className={cn('h-4 w-4', loading && 'animate-spin')} />
                        </button>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                                <HiOutlineCheck className="h-4 w-4" />
                                <span>Mark all as read</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 scrollbar-none">
                    {[
                        { key: 'all', label: 'All', count: notifications.length },
                        { key: 'unread', label: 'Unread', count: unreadCount },
                        { key: 'order', label: 'Orders', count: orderCount },
                        { key: 'payment', label: 'Payments', count: paymentCount },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                                activeTab === tab.key
                                    ? 'bg-[#E71D28] text-white shadow-md shadow-[#E71D28]/20'
                                    : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/60'
                            )}
                        >
                            <span>{tab.label}</span>
                            <span
                                className={cn(
                                    'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                                    activeTab === tab.key
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                )}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </BlurFade>

            {/* Notification List */}
            <div className="space-y-2.5">
                {loading && notifications.length === 0 ? (
                    <div className="p-12 text-center bg-white/70 rounded-3xl border border-slate-100">
                        <div className="h-6 w-6 border-2 border-[#E71D28] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-500">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notif) => {
                        const iconData = getNotificationIcon(notif.type);
                        const IconComponent = iconData.icon;

                        return (
                            <motion.div
                                key={notif._id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                                className={cn(
                                    'group p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative cursor-pointer',
                                    notif.isRead
                                        ? 'bg-white/70 hover:bg-white border-slate-100/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
                                        : 'bg-white border-rose-200/60 shadow-md shadow-rose-500/5 hover:border-rose-300'
                                )}
                            >
                                {!notif.isRead && (
                                    <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#E71D28] rounded-r-full" />
                                )}

                                <div className="flex items-start gap-3.5 sm:gap-4 pl-1">
                                    <div
                                        className={cn(
                                            'h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105',
                                            iconData.bg
                                        )}
                                    >
                                        <IconComponent className="h-5 w-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h3
                                                    className={cn(
                                                        'text-xs sm:text-sm font-black truncate',
                                                        notif.isRead ? 'text-slate-800' : 'text-slate-900'
                                                    )}
                                                >
                                                    {notif.title}
                                                </h3>
                                                {!notif.isRead && (
                                                    <span className="h-2 w-2 rounded-full bg-[#E71D28] shrink-0" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                                {formatTimeAgo(notif.createdAt)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                            {notif.message}
                                        </p>

                                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                {notif.type || 'Alert'}
                                            </span>
                                            {!notif.isRead && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsRead(notif._id);
                                                    }}
                                                    className="text-[10px] font-black text-[#E71D28] hover:text-[#a2141c] uppercase tracking-wider flex items-center gap-1"
                                                >
                                                    <HiOutlineCheck className="h-3 w-3" />
                                                    Mark read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-16 px-6 text-center bg-white/70 rounded-3xl border border-slate-100">
                        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-300">
                            <HiOutlineBell className="h-8 w-8" />
                        </div>
                        <h3 className="text-base font-black text-slate-900 mb-1">
                            No notifications in this view
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                            {activeTab === 'unread'
                                ? "You're all caught up! No unread notifications."
                                : "We'll notify you as soon as an order or update arrives."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;

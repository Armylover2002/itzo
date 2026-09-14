import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineBell, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineClock } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const formatNotifTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const diffMs = Date.now() - parsed.getTime();
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return parsed.toLocaleDateString('en-IN');
};

const NotificationPopup = ({ notifications, onMarkAsRead, onMarkAllAsRead, onOpenNotification, onClose, onViewAll, isSeller }) => {
    const navigate = useNavigate();
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleNotificationClick = (notif) => {
        if (!notif.isRead) onMarkAsRead(notif._id);
        if (isSeller) {
            navigate('/seller/notifications');
        }
        onClose();
    };

    const handleViewAll = () => {
        if (isSeller) {
            navigate('/seller/notifications');
        }
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 350 }}
            className="fixed md:absolute top-16 md:top-full left-3 right-3 md:left-auto md:right-0 mt-0 md:mt-2.5 w-auto md:w-[360px] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden z-50 max-h-[78vh] md:h-auto flex flex-col"
        >
            {/* Card Header */}
            <div className="p-2.5 px-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shadow-xs shrink-0", isSeller ? "bg-red-500 text-white shadow-red-500/20" : "bg-primary text-white")}>
                        <HiOutlineBell className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-1.5">
                        Notifications
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.2 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </h3>
                </div>
                {notifications.length > 0 && (
                    <button
                        onClick={onMarkAllAsRead}
                        className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-md transition-all cursor-pointer",
                            isSeller ? "text-red-600 hover:bg-red-50 hover:text-red-700" : "text-primary hover:bg-primary/5"
                        )}
                    >
                        Mark all read
                    </button>
                )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 max-h-[340px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                    <div className={cn(isSeller ? "p-2.5 space-y-2" : "divide-y divide-slate-100/80")}>
                        {notifications.map((notif) => (
                            <div
                                key={notif._id}
                                className={cn(
                                    "hover:bg-slate-50/80 transition-all cursor-pointer group relative flex items-start gap-2.5",
                                    isSeller
                                        ? cn(
                                            "p-3 rounded-xl border",
                                            notif.isRead ? "border-slate-100 bg-white" : "border-red-100 bg-red-50/40"
                                          )
                                        : cn(
                                            "p-2.5 px-3.5",
                                            !notif.isRead && "bg-primary/5"
                                          )
                                )}
                                onClick={() => {
                                    if (typeof onOpenNotification === 'function') {
                                        onOpenNotification(notif);
                                        return;
                                    }
                                    handleNotificationClick(notif);
                                }}
                            >
                                {!notif.isRead && !isSeller && (
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-md bg-primary" />
                                )}
                                <div className={cn(
                                    "flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105 border",
                                    isSeller ? "h-9 w-9 rounded-full" : "h-8 w-8 rounded-lg",
                                    notif.type === 'order' ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" :
                                        notif.type === 'payment' ? "bg-amber-50 text-amber-600 border-amber-200/60" :
                                            (isSeller ? "bg-red-50 text-red-600 border-red-200/60" : "bg-blue-50 text-blue-600 border-blue-200/60")
                                )}>
                                    {notif.type === 'order' ? <HiOutlineCheckCircle className="h-4 w-4" /> :
                                        notif.type === 'payment' ? <HiOutlineClock className="h-4 w-4" /> :
                                            <HiOutlineExclamationCircle className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-0.5">
                                        <p className={cn(
                                            "text-xs font-semibold tracking-tight leading-snug",
                                            notif.isRead ? "text-slate-600" : "text-[#1c1c1e]"
                                        )}>
                                            {notif.title}
                                            {isSeller && !notif.isRead ? (
                                                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                                            ) : null}
                                        </p>
                                        <span className="text-[10px] font-normal text-slate-400 shrink-0 pt-0.5">
                                            {formatNotifTime(notif.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed line-clamp-2">
                                        {notif.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 px-4 text-center">
                        <div className="h-11 w-11 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-100 text-slate-400">
                            <HiOutlineBell className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-semibold text-[#1c1c1e] mb-0.5">No Notifications</p>
                        <p className="text-[11px] text-slate-400 font-normal">We'll alert you when something happens.</p>
                    </div>
                )}
            </div>

            {/* Card Footer */}
            <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                    type="button"
                    onClick={() => {
                        if (typeof onViewAll === 'function') {
                            onViewAll();
                            return;
                        }
                        handleViewAll();
                    }}
                    className={cn(
                        "text-xs font-semibold transition-colors py-1.5 px-3 rounded-lg cursor-pointer",
                        isSeller ? "text-red-600 hover:bg-red-100/50" : "text-primary hover:bg-primary/10"
                    )}
                >
                    View all
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-200/50 cursor-pointer"
                >
                    Close
                </button>
            </div>
        </motion.div>
    );
};

export default NotificationPopup;

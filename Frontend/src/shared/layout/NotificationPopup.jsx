import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineBell, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineClock } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import Button from '@shared/components/ui/Button';

const NotificationPopup = ({ notifications, onMarkAsRead, onMarkAllAsRead, onClose }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed md:absolute top-14 md:top-full left-0 md:left-auto md:right-0 mt-0 md:mt-4 w-full md:w-[380px] bg-white rounded-b-2xl md:rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.25)] md:border border-gray-200 overflow-hidden z-[100] max-h-[80vh] md:h-auto flex flex-col"
        >
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <HiOutlineBell className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Notifications</h3>
                </div>
                {notifications.length > 0 && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest transition-colors"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="flex-1 md:max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {notifications.map((notif) => (
                            <div
                                key={notif._id}
                                className={cn(
                                    "p-4 hover:bg-slate-50 transition-all cursor-pointer group relative",
                                    !notif.isRead && "bg-primary/[0.02]"
                                )}
                                onClick={() => !notif.isRead && onMarkAsRead(notif._id)}
                            >
                                {!notif.isRead && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                                )}
                                <div className="flex gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                        notif.type === 'order' ? "bg-emerald-50 text-emerald-600" :
                                            notif.type === 'payment' ? "bg-amber-50 text-amber-600" :
                                                "bg-[#fef4f4] text-primary"
                                    )}>
                                        {notif.type === 'order' ? <HiOutlineCheckCircle size={20} /> :
                                            notif.type === 'payment' ? <HiOutlineClock size={20} /> :
                                                <HiOutlineExclamationCircle size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className={cn(
                                                "text-xs font-black tracking-tight",
                                                notif.isRead ? "text-slate-600" : "text-slate-900"
                                            )}>
                                                {notif.title}
                                            </p>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                {new Date(notif.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">
                                            {notif.message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 px-6 text-center">
                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <HiOutlineBell className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-black text-slate-900 mb-1">No New Notifications</p>
                        <p className="text-xs text-slate-400 font-medium">We'll alert you when something happens.</p>
                    </div>
                )}
            </div>

            <div className="p-3 bg-slate-50/50 border-t border-gray-50 text-center flex-shrink-0">
                <button
                    onClick={onClose}
                    className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                >
                    Close Panel
                </button>
            </div>
        </motion.div>
    );
};

export default NotificationPopup;

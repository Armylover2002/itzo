import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { SELLER_LIVE_UPDATE_EVENT } from "../components/SellerLiveUpdates";

const formatNotifTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const typeStyles = (type) => {
  if (type === "order") {
    return {
      wrap: "bg-emerald-50 text-emerald-600 border-emerald-200/70",
      Icon: HiOutlineCheckCircle,
    };
  }
  if (type === "payment") {
    return {
      wrap: "bg-amber-50 text-amber-600 border-amber-200/70",
      Icon: HiOutlineClock,
    };
  }
  if (type === "inventory") {
    return {
      wrap: "bg-amber-50 text-amber-700 border-amber-200/70",
      Icon: HiOutlineExclamationCircle,
    };
  }
  return {
    wrap: "bg-red-50 text-red-600 border-red-200/70",
    Icon: HiOutlineExclamationCircle,
  };
};

const SellerNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await sellerApi.getNotifications({ forceRefresh: true });
      const payload = response?.data?.result ?? response?.data?.data ?? {};
      if (response?.data?.success) {
        setNotifications(payload.notifications || payload.items || []);
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error("Failed to load notifications");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const onLive = () => fetchNotifications();
    window.addEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
    return () => window.removeEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const openNotification = async (notif) => {
    if (!notif) return;
    if (!notif.isRead && notif._id) {
      try {
        await sellerApi.markNotificationRead(notif._id);
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notif._id ? { ...item, isRead: true } : item,
          ),
        );
      } catch {
        toast.error("Failed to mark as read");
      }
    }
    const link = notif.metadata?.link || notif.link;
    if (link) navigate(link);
  };

  const markAllRead = async () => {
    try {
      await sellerApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      toast.success("All caught up!");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 md:px-5 pb-24 max-w-3xl md:max-w-none mx-auto w-full pt-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70">
        <div className="min-w-0 pr-2">
          <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">
            Notifications
          </h1>
          <p className="text-xs font-normal text-slate-500 mt-0.5 leading-snug">
            View all your alerts and messages
          </p>
        </div>
        {notifications.length > 0 && unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="shrink-0 mt-0.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100/80 active:scale-[0.98] transition-all"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-red-500 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400">
            <HiOutlineBell className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[#1c1c1e]">No notifications</p>
          <p className="mt-1 text-xs text-slate-400">We will alert you when something happens.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notif) => {
            const style = typeStyles(notif.type);
            const Icon = style.Icon;
            return (
              <button
                key={notif._id}
                type="button"
                onClick={() => openNotification(notif)}
                className={cn(
                  "w-full text-left rounded-2xl border bg-white p-3.5 shadow-xs transition-all active:scale-[0.995]",
                  notif.isRead
                    ? "border-slate-200/80"
                    : "border-red-100 bg-red-50/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full border flex items-center justify-center shrink-0",
                      style.wrap,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm font-semibold tracking-tight leading-snug",
                          notif.isRead ? "text-slate-600" : "text-[#1c1c1e]",
                        )}
                      >
                        {notif.title}
                        {!notif.isRead ? (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                        ) : null}
                      </p>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400 pt-0.5">
                        {formatNotifTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-normal text-slate-500 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerNotifications;

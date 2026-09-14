import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Clock, Trash2 } from "lucide-react";
import {
  getDeliveryNotifications,
  saveDeliveryNotifications,
  markDeliveryNotificationAsRead,
} from "@food/utils/deliveryNotifications";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const toTimeLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const normalizeNotifications = (items = []) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    id: String(item?.id || item?._id || `delivery-notification-${index}`),
    title: String(item?.title || "Notification").trim(),
    message: String(item?.message || item?.body || "").trim(),
    read: Boolean(item?.read),
    createdAt: item?.createdAt || item?.timestamp || Date.now(),
  }));

export default function NotificationsV2() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(() =>
    normalizeNotifications(getDeliveryNotifications())
  );
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    loading: broadcastLoading,
    markAsRead: markBroadcastAsRead,
    dismiss: dismissBroadcastNotification,
    dismissAll: dismissAllBroadcastNotifications,
  } = useNotificationInbox("delivery", { limit: 100 });

  useEffect(() => {
    const syncNotifications = () => {
      setNotifications(normalizeNotifications(getDeliveryNotifications()));
    };

    window.addEventListener("deliveryNotificationsUpdated", syncNotifications);
    window.addEventListener("storage", syncNotifications);
    return () => {
      window.removeEventListener("deliveryNotificationsUpdated", syncNotifications);
      window.removeEventListener("storage", syncNotifications);
    };
  }, []);

  const mergedNotifications = [
    ...(broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
    })),
    ...(notifications || []).map((item) => ({
      ...item,
      source: "local",
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const unreadCount = notifications.filter((item) => !item.read).length + broadcastUnreadCount;

  const handleMarkAsRead = (id, source = "local") => {
    if (source === "broadcast") {
      markBroadcastAsRead(id);
      return;
    }
    markDeliveryNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
    window.dispatchEvent(new CustomEvent("deliveryNotificationsUpdated"));
  };

  const handleDismissAll = () => {
    setNotifications([]);
    saveDeliveryNotifications([]);
    dismissAllBroadcastNotifications();
    window.dispatchEvent(new CustomEvent("deliveryNotificationsUpdated"));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={() => navigate("/food/delivery/profile")}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Bell className="w-5 h-5 text-[#EB590E]" />
          <h1 className="text-base font-semibold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#EB590E] text-white text-[10px] font-semibold">
              {unreadCount}
            </span>
          )}
        </div>
        {mergedNotifications.length > 0 && (
          <button
            onClick={handleDismissAll}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            aria-label="Clear all"
          >
            <Trash2 className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 px-4 pt-4 pb-28">
        {broadcastLoading ? (
          <div className="text-center text-sm text-gray-600 py-12">Loading notifications...</div>
        ) : mergedNotifications.length === 0 ? (
          <div className="text-center text-sm text-gray-600 py-12">No notifications</div>
        ) : (
          <div className="space-y-2">
            {mergedNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleMarkAsRead(item.id, item.source)}
                className={`border rounded-lg p-3 flex items-start justify-between gap-3 cursor-pointer ${
                  item.read ? "border-gray-200" : "border-red-200 bg-red-50/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{item.message || "Delivery notification"}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {toTimeLabel(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

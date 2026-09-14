const DELIVERY_NOTIFICATIONS_KEY = "delivery_notifications";
const MAX_LOCAL_NOTIFICATIONS = 100;

const safeRead = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELIVERY_NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const notifyUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("deliveryNotificationsUpdated"));
};

/**
 * Get all notifications from local storage.
 */
export const getDeliveryNotifications = () => safeRead();

/**
 * Save notifications and broadcast update event.
 */
export const saveDeliveryNotifications = (notifications) => {
  if (typeof window === "undefined") return;
  const normalized = Array.isArray(notifications) ? notifications : [];
  try {
    window.localStorage.setItem(
      DELIVERY_NOTIFICATIONS_KEY,
      JSON.stringify(normalized.slice(0, MAX_LOCAL_NOTIFICATIONS))
    );
  } catch {
    // ignore storage quota / private mode failures
  }
  notifyUpdated();
};

/**
 * Get local unread notification count.
 */
export const getUnreadDeliveryNotificationCount = () =>
  safeRead().filter((item) => !item?.read).length;

/**
 * Add a new local notification and mark it unread.
 */
export const addDeliveryNotification = (notification = {}) => {
  const list = safeRead();
  const item = {
    id: String(
      notification?.id ||
        notification?._id ||
        `delivery-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    ),
    title: String(notification?.title || "Notification").trim(),
    message: String(notification?.message || "").trim(),
    createdAt: notification?.createdAt || new Date().toISOString(),
    read: false,
  };
  saveDeliveryNotifications([item, ...list]);
  return item;
};

/**
 * Mark a local notification as read.
 */
export const markDeliveryNotificationAsRead = (notificationId) => {
  const id = String(notificationId || "").trim();
  if (!id) return;
  const next = safeRead().map((item) =>
    String(item?.id) === id ? { ...item, read: true } : item
  );
  saveDeliveryNotifications(next);
};



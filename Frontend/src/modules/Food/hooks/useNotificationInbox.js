import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationAPI } from "@food/api";

const normalizeInboxItems = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: String(item?._id || item?.id || `broadcast-${index}`),
    source: "broadcast",
    title: String(item?.title || "Notification").trim(),
    message: String(item?.message || "").trim(),
    link: String(item?.link || "").trim(),
    read: Boolean(item?.isRead),
    createdAt: item?.createdAt || item?.updatedAt || new Date().toISOString(),
    category: String(item?.category || "broadcast"),
  }));

const REFRESH_EVENT = "foodNotificationInboxRefresh";

export const dispatchNotificationInboxRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
};

export default function useNotificationInbox(module, options = {}) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(options?.autoload !== false));

  const fetchInbox = useCallback(async () => {
    if (!module) return;

    // Check if user is logged in before fetching to prevent 403 Forbidden
    const hasToken = localStorage.getItem('user_accessToken') || 
                     localStorage.getItem('accessToken') || 
                     localStorage.getItem('admin_accessToken') ||
                     localStorage.getItem('auth_customer');
                     
    if (!hasToken) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await notificationAPI.getInbox(
        { page: 1, limit: options?.limit || 50 },
        { contextModule: module }
      );
      const payload = response?.data?.data || {};
      setItems(normalizeInboxItems(payload?.items));
      setUnreadCount(Number(payload?.unreadCount || 0));
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [module, options?.limit]);

  useEffect(() => {
    if (options?.autoload === false || !module) return;
    fetchInbox();
  }, [fetchInbox, module, options?.autoload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => {
      fetchInbox();
    };
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [fetchInbox]);

  useEffect(() => {
    const pollMs = Number(options?.pollMs || 0);
    if (!pollMs || pollMs < 1000 || !module) return undefined;
    const timer = window.setInterval(() => {
      fetchInbox();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [fetchInbox, module, options?.pollMs]);

  const markAsRead = useCallback(
    async (id) => {
      if (!id || !module) return;
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await notificationAPI.markAsRead(id, { contextModule: module });
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox, module]
  );

  const dismiss = useCallback(
    async (id) => {
      if (!id || !module) return;
      const removed = items.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (removed && !removed.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      try {
        await notificationAPI.dismiss(id, { contextModule: module });
      } catch {
        fetchInbox();
      }
    },
    [fetchInbox, items, module]
  );

  const dismissAll = useCallback(async () => {
    if (!module) return;
    setItems([]);
    setUnreadCount(0);
    try {
      await notificationAPI.dismissAll({ contextModule: module });
    } catch {
      fetchInbox();
    }
  }, [fetchInbox, module]);

  return useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      refresh: fetchInbox,
      markAsRead,
      dismiss,
      dismissAll,
    }),
    [dismiss, dismissAll, fetchInbox, items, loading, markAsRead, unreadCount]
  );
}

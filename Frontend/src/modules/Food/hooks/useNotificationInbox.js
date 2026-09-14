import { useCallback, useEffect, useMemo, useState } from "react";
import { notificationAPI } from "@food/api";
import { isModuleAuthenticated } from "@food/utils/auth";

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

// Module-level in-flight + short-TTL cache, keyed by module+limit. Home mounts
// more than one useNotificationInbox("user", {limit:100}) consumer at once (e.g.
// HomeHeader plus its category-modal copy), and StrictMode double-invokes the
// mount effect in dev — without this, each of those fires its own GET
// /food/notifications/inbox. The TTL is short so the poll/manual-refresh/socket
// -driven refresh path still gets near-live data.
const INBOX_CACHE_TTL_MS = 2000;
const inboxCache = new Map(); // key -> { ts, payload }
const inboxInFlight = new Map(); // key -> Promise<payload>

const fetchInboxDeduped = (module, limit) => {
  const key = `${module}:${limit}`;
  const now = Date.now();

  const cached = inboxCache.get(key);
  if (cached && now - cached.ts < INBOX_CACHE_TTL_MS) {
    return Promise.resolve(cached.payload);
  }

  const inFlight = inboxInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = notificationAPI
    .getInbox({ page: 1, limit }, { contextModule: module })
    .then((response) => {
      const payload = response?.data?.data || {};
      inboxCache.set(key, { ts: Date.now(), payload });
      return payload;
    })
    .finally(() => {
      inboxInFlight.delete(key);
    });

  inboxInFlight.set(key, promise);
  return promise;
};

export default function useNotificationInbox(module, options = {}) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(options?.autoload !== false));

  const fetchInbox = useCallback(async () => {
    if (!module || !isModuleAuthenticated(module)) return;

    try {
      setLoading(true);
      const payload = await fetchInboxDeduped(module, options?.limit || 50);
      setItems(normalizeInboxItems(payload?.items));
      setUnreadCount(Number(payload?.unreadCount || 0));
    } catch (error) {
      console.error("[useNotificationInbox] fetch failed:", error?.message || error);
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

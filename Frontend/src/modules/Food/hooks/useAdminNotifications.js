import { useCallback, useEffect, useMemo, useState } from "react";
import { adminAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import io from "socket.io-client";

const STORAGE_KEY = "admin_notifications_dismissed_v1";
const UPDATE_EVENT = "adminNotificationsUpdated";

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDismissedIds = () => {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY) || "[]", []);
  return Array.isArray(parsed) ? parsed : [];
};

const saveDismissedIds = (ids) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
};

export const dispatchAdminNotificationsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPDATE_EVENT));
};

export const refreshAdminAlerts = dispatchAdminNotificationsUpdated;

const toDateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const toDateLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const uniqueById = (items = []) => {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return [...map.values()];
};

const joinMeta = (...parts) => parts.filter(Boolean).join(" • ");

const mapPendingRestaurants = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((item) => ({
    id: `approval-restaurant-${String(item?._id || item?.id || "")}`,
    title: "Restaurant Approval Pending",
    message: `${item?.restaurantName || "Restaurant"} submitted a restaurant approval request. Owner: ${item?.ownerName || "N/A"}. Contact: ${item?.ownerPhone || "N/A"}.`,
    type: "approval",
    category: "restaurant_approval",
    path: "/ecs/food/restaurants/joining-request",
    createdAt: item?.createdAt || item?.updatedAt,
    timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
    metaLabel: joinMeta(item?.restaurantName, item?.ownerName, item?.ownerPhone),
  }));

const mapDeliveryJoinRequests = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.partners ||
    payload?.data ||
    payload?.items ||
    response?.data?.partners ||
    [];

  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: `approval-delivery-${String(item?._id || item?.id || "")}`,
    title: "Delivery Partner Approval Pending",
    message: `${item?.name || "Delivery partner"} submitted a joining request. Phone: ${item?.phone || "N/A"}. Email: ${item?.email || "N/A"}.`,
    type: "approval",
    category: "delivery_approval",
    path: "/ecs/food/delivery-partners/join-request",
    createdAt: item?.createdAt || item?.updatedAt,
    timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
    metaLabel: joinMeta(item?.name, item?.phone, item?.email),
  }));
};

const mapFoodApprovals = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.requests ||
    payload?.items ||
    payload?.data ||
    response?.data?.requests ||
    [];

  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: `approval-food-${String(item?._id || item?.id || "")}`,
    title: "Food Approval Pending",
    message: `${item?.itemName || "Food item"} from ${item?.restaurantName || "Restaurant"} is waiting for review. Category: ${item?.category || item?.type || "N/A"}.`,
    type: "approval",
    category: "food_approval",
    path: "/ecs/food/food-approval",
    createdAt: item?.requestedAt || item?.createdAt || item?.updatedAt,
    timeLabel: toDateLabel(item?.requestedAt || item?.createdAt || item?.updatedAt),
    metaLabel: joinMeta(item?.restaurantName, item?.itemName, item?.category || item?.type),
  }));
};

const mapUserRestaurantSupport = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.tickets ||
    payload?.items ||
    payload?.data ||
    response?.data?.tickets ||
    [];

  return (Array.isArray(rows) ? rows : [])
    .filter((item) => !["resolved", "closed"].includes(String(item?.status || "").toLowerCase()))
    .map((item) => {
      const isRestaurantTicket = item?.source === "restaurant";
      const title = isRestaurantTicket ? "Restaurant Support Ticket" : "User Support Ticket";
      const message = isRestaurantTicket
        ? `${item?.restaurantName || "Restaurant"} raised a support ticket. Subject: ${item?.subject || item?.issueType || "N/A"}. Status: ${item?.status || "open"}.`
        : `${item?.user?.name || "User"} raised a support ticket${item?.restaurantName ? ` for ${item.restaurantName}` : ""}. Issue: ${item?.issueType || item?.type || "N/A"}. Status: ${item?.status || "open"}.`;

      const metaLabel = isRestaurantTicket
        ? joinMeta(item?.restaurantName, item?.subject || item?.issueType, item?.status)
        : joinMeta(item?.user?.name, item?.user?.phone, item?.issueType || item?.type, item?.status);

      return {
        id: `support-main-${String(item?._id || item?.id || "")}`,
        title,
        message,
        type: "support",
        category: "support",
        path: "/ecs/food/support-tickets",
        createdAt: item?.createdAt || item?.updatedAt,
        timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
        metaLabel,
      };
    });
};

const mapDeliverySupport = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.tickets ||
    payload?.items ||
    payload?.data ||
    response?.data?.tickets ||
    [];

  return (Array.isArray(rows) ? rows : [])
    .filter((item) => !["resolved", "closed"].includes(String(item?.status || "").toLowerCase()))
    .map((item) => ({
      id: `support-delivery-${String(item?._id || item?.id || "")}`,
      title: "Delivery Support Ticket",
      message: `${item?.deliveryPartner?.name || "Delivery partner"} raised a support ticket. Subject: ${item?.subject || "N/A"}. Priority: ${item?.priority || "medium"}. Status: ${item?.status || "open"}.`,
      type: "support",
      category: "delivery_support",
      path: "/ecs/food/delivery-support-tickets",
      createdAt: item?.createdAt || item?.updatedAt,
      timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
      metaLabel: joinMeta(item?.deliveryPartner?.name, item?.deliveryPartner?.phone, item?.priority, item?.status),
    }));
};

const mapExpiredFssai = (response) => {
  const payload = response?.data?.data;
  const rows = payload?.items || payload?.data || response?.data?.items || [];

  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: String(item?.id || `fssai-expired-${item?.restaurantId || ""}`),
    title: item?.title || "FSSAI License Expired",
    message:
      item?.message ||
      `${item?.restaurantName || "Restaurant"} FSSAI license has expired.`,
    type: "compliance",
    category: "fssai_expired",
    path: "/ecs/food/restaurants",
    createdAt: item?.createdAt || item?.fssaiExpiry,
    timeLabel: toDateLabel(item?.createdAt || item?.fssaiExpiry),
    metaLabel: joinMeta(item?.restaurantName, item?.ownerName, item?.ownerPhone, item?.fssaiNumber),
  }));
};

const mapDiningApprovalRequests = (response) => {
  const payload = response?.data?.data;
  const rows = payload?.restaurants || payload?.items || response?.data?.restaurants || [];

  return (Array.isArray(rows) ? rows : [])
    .filter((item) => item?.pendingDiningRequest?.requestedAt)
    .map((item) => {
      const categories = Array.isArray(item?.pendingDiningRequest?.categories)
        ? item.pendingDiningRequest.categories.map((category) => category?.name).filter(Boolean)
        : [];

      return {
        id: `approval-dining-${String(item?._id || item?.id || "")}-${String(item?.pendingDiningRequest?.requestedAt || item?.updatedAt || "")}`,
        title: "Dining Approval Pending",
        message: `${item?.restaurantName || item?.name || "Restaurant"} requested dining changes. Guests: ${Number(item?.pendingDiningRequest?.maxGuests ?? 0)}, Dining: ${item?.pendingDiningRequest?.isEnabled ? "On" : "Off"}.`,
        type: "approval",
        category: "dining_approval",
        path: "/ecs/food/dining-list",
        createdAt: item?.pendingDiningRequest?.requestedAt || item?.updatedAt,
        timeLabel: toDateLabel(item?.pendingDiningRequest?.requestedAt || item?.updatedAt),
        metaLabel: joinMeta(item?.restaurantName || item?.name, categories.join(", "), item?.ownerPhone),
      };
    });
};

const resolveSocketOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return raw
      .replace(/\/api\/v\d+\/?$/i, "")
      .replace(/\/api(\/v1)?\/?$/i, "")
      .replace(/\/+$/, "");
  }
};

export default function useAdminNotifications(options = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(options?.autoload !== false));

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const dismissed = new Set(getDismissedIds());

      const [
        restaurantsRes,
        deliveryJoinRes,
        foodApprovalRes,
        supportRes,
        deliverySupportRes,
        fssaiExpiredRes,
        diningApprovalRes,
      ] = await Promise.all([
        adminAPI.getPendingRestaurants(),
        adminAPI.getDeliveryPartnerJoinRequests({ page: 1, limit: 50 }),
        adminAPI.getPendingFoodApprovals({ page: 1, limit: 50 }),
        adminAPI.getSupportTicketsAdmin({ page: 1, limit: 50, source: "all" }),
        adminAPI.getDeliverySupportTickets({ page: 1, limit: 50 }),
        adminAPI.getExpiredFssaiNotifications(),
        adminAPI.getDiningRestaurants(),
      ]);

      const restaurantRows =
        restaurantsRes?.data?.data ||
        restaurantsRes?.data?.restaurants ||
        [];

      const aggregated = uniqueById([
        ...mapPendingRestaurants(restaurantRows),
        ...mapDeliveryJoinRequests(deliveryJoinRes),
        ...mapFoodApprovals(foodApprovalRes),
        ...mapUserRestaurantSupport(supportRes),
        ...mapDeliverySupport(deliverySupportRes),
        ...mapExpiredFssai(fssaiExpiredRes),
        ...mapDiningApprovalRequests(diningApprovalRes),
      ])
        .filter((item) => !dismissed.has(item.id))
        .sort((a, b) => toDateValue(b.createdAt) - toDateValue(a.createdAt));

      setItems(aggregated);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.autoload === false) return;
    loadNotifications();
  }, [loadNotifications, options?.autoload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => {
      loadNotifications();
    };
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, [loadNotifications]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    const token = localStorage.getItem("admin_accessToken") || localStorage.getItem("accessToken");
    const socketOrigin = resolveSocketOrigin(API_BASE_URL);
    if (!token || !socketOrigin) return undefined;

    const socket = io(socketOrigin, {
      path: "/socket.io/",
      transports: ["polling"],
      auth: { token },
    });

    socket.on("admin_notification", () => {
      loadNotifications();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadNotifications]);

  const dismissOne = useCallback((id) => {
    if (!id) return;
    const dismissed = [...new Set([...getDismissedIds(), id])];
    saveDismissedIds(dismissed);
    setItems((prev) => prev.filter((item) => item.id !== id));
    dispatchAdminNotificationsUpdated();
  }, []);

  const clearAll = useCallback(() => {
    const ids = items.map((item) => item.id).filter(Boolean);
    saveDismissedIds([...new Set([...getDismissedIds(), ...ids])]);
    setItems([]);
    dispatchAdminNotificationsUpdated();
  }, [items]);

  return useMemo(
    () => ({
      items,
      loading,
      unreadCount: items.length,
      refresh: loadNotifications,
      dismissOne,
      clearAll,
    }),
    [clearAll, dismissOne, items, loadNotifications, loading]
  );
}

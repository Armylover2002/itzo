import { useCallback, useEffect, useMemo, useState } from "react";
import { adminAPI, supportAPI } from "@food/api";
import { adminApi as qcAdminApi } from "../../quickCommerce/admin/services/adminApi";
import { useAdminBadgeStore } from "@food/store/adminBadgeStore";
import { API_BASE_URL } from "@food/api/config";
import io from "socket.io-client";
import { getCurrentUser } from "@food/utils/auth";
import {
  resolveAdminPermissionsForUser,
  canPerformAdminPermissionAction,
} from "@food/utils/adminPermissions";

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

export const refreshAdminAlerts = () => {
  dispatchAdminNotificationsUpdated();
  useAdminBadgeStore.getState().fetchBadges(true);
};

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

const mapPendingSellers = (response) => {
  const payload = response?.data?.result;
  const rows = payload?.items || [];
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const isProfileUpdate = item?.hasPendingProfileUpdate === true;
    const isReapplied = !isProfileUpdate && item?.approvalStatus === "pending" && item?.approvalNotes;
    return {
      id: isProfileUpdate
        ? `profile-update-seller-${String(item?._id || item?.id || "")}`
        : `approval-seller-${String(item?._id || item?.id || "")}`,
      title: isProfileUpdate
        ? "Seller Profile Update Pending"
        : isReapplied
          ? "Seller Re-applied for Approval"
          : "Seller Approval Pending",
      message: isProfileUpdate
        ? `${item?.shopName || "Seller"} (existing approved seller) updated their profile. Review the requested changes in seller requests.`
        : `${item?.shopName || "Seller"} is waiting for review. Owner: ${item?.ownerName || "N/A"}. Phone: ${item?.phone || "N/A"}.`,
      type: "approval",
      category: isProfileUpdate ? "seller_profile_update" : "seller_approval",
      path: "/ecs/quick-commerce/sellers/pending",
      createdAt:
        item?.profileUpdateRequestedAt ||
        item?.pendingProfileChanges?.requestedAt ||
        item?.applicationDate ||
        item?.createdAt ||
        item?.updatedAt,
      timeLabel: toDateLabel(
        item?.profileUpdateRequestedAt ||
          item?.pendingProfileChanges?.requestedAt ||
          item?.applicationDate ||
          item?.createdAt ||
          item?.updatedAt,
      ),
      metaLabel: joinMeta(
        item?.shopName,
        isProfileUpdate ? "Profile update" : item?.ownerName,
        item?.category,
      ),
    };
  });
};

const mapSellerWithdrawals = (response) => {
  const payload = response?.data?.result || response?.data?.data || response?.data;
  const rows =
    payload?.items ||
    payload?.withdrawals ||
    payload?.transactions ||
    (Array.isArray(payload) ? payload : []);
  return (Array.isArray(rows) ? rows : [])
    .filter((item) => {
      const status = String(item?.status || "").toLowerCase();
      return status === "pending" || status === "processing";
    })
    .map((item) => ({
      id: `seller-withdrawal-${String(item?._id || item?.id || "")}`,
      title: "Seller Withdrawal Pending",
      message: `₹${Math.abs(Number(item?.amount || 0))} withdrawal from ${item?.seller?.shopName || item?.shopName || "seller"} needs review.`,
      type: "finance",
      category: "seller_withdrawal",
      path: "/ecs/quick-commerce/withdrawals",
      createdAt: item?.createdAt || item?.requestedAt || item?.updatedAt,
      timeLabel: toDateLabel(item?.createdAt || item?.requestedAt || item?.updatedAt),
      metaLabel: joinMeta(item?.seller?.shopName || item?.shopName, item?.status),
    }));
};

const mapExpiredSellerLicenses = (response) => {
  const payload = response?.data?.result || response?.data?.data || response?.data;
  const rows = Array.isArray(payload) ? payload : payload?.items || [];
  return (Array.isArray(rows) ? rows : []).map((item) => ({
    id: `seller-license-${String(item?.id || `${item?.sellerId}-${item?.licenseType}`)}`,
    title: item?.title || "Seller License Expired",
    message: item?.message || `${item?.sellerName || "Seller"} license expired.`,
    type: "compliance",
    category: "seller_license_expiry",
    path: item?.path || "/ecs/quick-commerce/sellers",
    createdAt: item?.createdAt || item?.expiryDate,
    timeLabel: toDateLabel(item?.createdAt || item?.expiryDate),
    metaLabel: joinMeta(item?.sellerName, item?.licenseName, item?.expiryLabel),
  }));
};

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

const resolveCategoryRestaurantLabel = (item) => {
  const fromPopulated = (value) => {
    if (!value || typeof value !== "object") return "";
    return String(value.restaurantName || value.name || "").trim();
  };
  return (
    String(item?.restaurantName || "").trim() ||
    fromPopulated(item?.restaurantId) ||
    fromPopulated(item?.createdByRestaurantId) ||
    "Restaurant"
  );
};

const mapPendingCategories = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.categories ||
    payload?.items ||
    payload?.data ||
    response?.data?.categories ||
    [];

  return (Array.isArray(rows) ? rows : [])
    .filter((item) => {
      const status = String(item?.approvalStatus || "").toLowerCase();
      if (status === "pending") return true;
      if (!status && item?.isApproved === false) return true;
      return false;
    })
    .map((item) => ({
      id: `approval-category-${String(item?._id || item?.id || "")}`,
      title: "Category Approval Pending",
      message: `${item?.name || "Category"} from ${resolveCategoryRestaurantLabel(item)} is waiting for review.`,
      type: "approval",
      category: "category_approval",
      path: "/ecs/food/categories",
      createdAt: item?.requestedAt || item?.createdAt || item?.updatedAt,
      timeLabel: toDateLabel(item?.requestedAt || item?.createdAt || item?.updatedAt),
      metaLabel: joinMeta(
        item?.name,
        resolveCategoryRestaurantLabel(item),
        item?.foodTypeScope
      ),
    }));
};

const resolveSocketOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return raw
      .replace(/\/api\/v\d+\/?$/i, "")
      .replace(/\/api\/?$/i, "")
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

      const user = getCurrentUser("admin");
      const permissions = await resolveAdminPermissionsForUser(user);

      const hasRestaurantApprovalPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::restaurant_management::restaurants::joining_request",
        "view"
      );

      const hasDeliveryJoinPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::deliveryman_management::deliveryman::join_request",
        "view"
      );

      const hasFoodApprovalPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::food_management::food_approval",
        "view"
      );

      const hasSupportPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::customer_management::support_tickets",
        "view"
      );

      const hasDeliverySupportPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::deliveryman_management::support_tickets",
        "view"
      );

      const hasFssaiPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::restaurant_management::restaurants::list",
        "view"
      );

      const hasCategoryPerm = canPerformAdminPermissionAction(
        user,
        permissions,
        "food::food_management::categories::list",
        "view"
      );

      const restaurantsPromise = hasRestaurantApprovalPerm
        ? adminAPI.getPendingRestaurants()
        : Promise.resolve({ data: { success: true, data: [], restaurants: [] } });

      const deliveryJoinPromise = hasDeliveryJoinPerm
        ? adminAPI.getDeliveryPartnerJoinRequests({ page: 1, limit: 50 })
        : Promise.resolve({ data: { success: true, data: [], partners: [] } });

      const foodApprovalPromise = hasFoodApprovalPerm
        ? adminAPI.getPendingFoodApprovals({ page: 1, limit: 50 })
        : Promise.resolve({ data: { success: true, data: [], requests: [] } });

      const supportPromise = hasSupportPerm
        ? supportAPI.getSupportTicketsAdmin({ page: 1, limit: 50, source: "all" })
        : Promise.resolve({ data: { success: true, data: [], tickets: [] } });

      const deliverySupportPromise = hasDeliverySupportPerm
        ? adminAPI.getDeliverySupportTickets({ page: 1, limit: 50 })
        : Promise.resolve({ data: { success: true, data: [], tickets: [] } });

      const fssaiExpiredPromise = hasFssaiPerm
        ? adminAPI.getExpiredFssaiNotifications()
        : Promise.resolve({ data: { success: true, data: [] } });

      const categoriesPromise = hasCategoryPerm
        ? adminAPI.getCategories({ approvalStatus: "pending", limit: 50 })
        : Promise.resolve({ data: { success: true, data: { categories: [] } } });

      const pendingSellersPromise = qcAdminApi.getSellerRequests({ status: 'review_queue', limit: 50 }).catch(() => ({ data: { success: true, result: { items: [] } } }));
      const sellerWithdrawalsPromise = qcAdminApi
        .getSellerWithdrawals({ status: 'Pending', limit: 50 })
        .catch(() => ({ data: { success: true, result: { items: [] } } }));
      const sellerLicensesPromise = qcAdminApi
        .getExpiredSellerLicenses()
        .catch(() => ({ data: { success: true, result: [] } }));

      const [
        restaurantsRes,
        deliveryJoinRes,
        foodApprovalRes,
        supportRes,
        deliverySupportRes,
        fssaiExpiredRes,
        categoriesRes,
        pendingSellersRes,
        sellerWithdrawalsRes,
        sellerLicensesRes,
      ] = await Promise.all([
        restaurantsPromise,
        deliveryJoinPromise,
        foodApprovalPromise,
        supportPromise,
        deliverySupportPromise,
        fssaiExpiredPromise,
        categoriesPromise,
        pendingSellersPromise,
        sellerWithdrawalsPromise,
        sellerLicensesPromise,
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
        ...mapPendingCategories(categoriesRes),
        ...mapPendingSellers(pendingSellersRes),
        ...mapSellerWithdrawals(sellerWithdrawalsRes),
        ...mapExpiredSellerLicenses(sellerLicensesRes),
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
    if (options?.autoload === false) return;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, options?.autoload]);

  useEffect(() => {
    if (options?.autoload === false) return;
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
      useAdminBadgeStore.getState().fetchBadges(true);
    });

    return () => {

      socket.disconnect();
    };
  }, [loadNotifications, options?.autoload]);

  const dismissOne = useCallback((id) => {
    if (!id) return;
    const dismissed = [...new Set([...getDismissedIds(), id])];
    saveDismissedIds(dismissed);
    setItems((prev) => prev.filter((item) => item.id !== id));
    dispatchAdminNotificationsUpdated();
    useAdminBadgeStore.getState().fetchBadges(true);
  }, []);

  const clearAll = useCallback(() => {
    const ids = items.map((item) => item.id).filter(Boolean);
    saveDismissedIds([...new Set([...getDismissedIds(), ...ids])]);
    setItems([]);
    dispatchAdminNotificationsUpdated();
    useAdminBadgeStore.getState().fetchBadges(true);
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

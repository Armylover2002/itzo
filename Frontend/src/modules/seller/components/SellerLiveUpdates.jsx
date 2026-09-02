import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { getOrderSocket } from "@core/services/orderSocket";
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging";

export const SELLER_LIVE_UPDATE_EVENT = "seller-live-update";

const dispatchSellerLiveUpdate = (detail = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SELLER_LIVE_UPDATE_EVENT, { detail }));
};

const SellerLiveUpdates = () => {
  const location = useLocation();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    registerWebPushForCurrentModule(location.pathname || "/seller").catch(() => {});
  }, [location.pathname, user?._id]);

  useEffect(() => {
    const token = localStorage.getItem("auth_seller");
    if (!token || !user) return undefined;

    const socket = getOrderSocket(token);
    if (!socket) return undefined;

    const onLive = (payload = {}) => {
      dispatchSellerLiveUpdate(payload);
      const key = String(payload.key || payload.uniqueKey || "");
      const isDecision =
        key.includes(":approved") ||
        key.includes(":rejected") ||
        key.includes(":decision") ||
        /approv|reject/i.test(String(payload.title || ""));
      if (isDecision) {
        refreshUser({ forceRefresh: true }).catch(() => {});
      }
    };

    socket.on("seller_notification", onLive);
    socket.on("seller_profile_updated", onLive);

    return () => {
      socket.off("seller_notification", onLive);
      socket.off("seller_profile_updated", onLive);
    };
  }, [user?._id, refreshUser]);

  return null;
};

export default SellerLiveUpdates;

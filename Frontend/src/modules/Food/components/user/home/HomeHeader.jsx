import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  ChevronDown,
  Search,
  Mic,
  Wallet,
  Bell,
  BellOff,
  X,
  ShoppingCart,
} from "lucide-react";
import { useCart } from "@food/context/CartContext";
import { cn } from "@/lib/utils";
import { Switch } from "@food/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings";

const tabs = [
  { id: "food", name: "Food", shortName: "Food" },
  { id: "quick", name: "Quick Commerce", shortName: "Quick" },
];

const TAB_GLYPHS = { food: "🍔", quick: "📦" };

const foodTheme = (vegMode) => ({
  accent: vegMode ? "#2e7d32" : "#FE5502",
});

const isMeaningfulLocationValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(
    normalized &&
    normalized !== "select location" &&
    normalized !== "current location",
  );
};

const buildLocationDisplay = (savedAddressText, location) => {
  if (isMeaningfulLocationValue(savedAddressText)) {
    const parts = String(savedAddressText)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      return {
        title: parts.slice(0, 2).join(", "),
        subtitle: parts.slice(2).join(", "),
      };
    }

    if (parts.length === 2) {
      return {
        title: parts.join(", "),
        subtitle: "Tap to choose delivery location",
      };
    }

    return {
      title: String(savedAddressText).trim(),
      subtitle: "Tap to choose delivery location",
    };
  }

  const fallbackTitle = location?.area || location?.city || "Select Location";
  const fallbackSubtitle =
    location?.address || location?.city || "Tap to choose delivery location";

  return {
    title: fallbackTitle,
    subtitle: fallbackSubtitle,
  };
};

const isColorDark = (color) => {
  if (!color || !color.startsWith("#")) return false;
  let c = color.substring(1);
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
};

export default function HomeHeader({
  activeTab,
  setActiveTab,
  location,
  savedAddressText,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  onVegModeChange,
  quickThemeColor,
  onQuickTabIntent,
  bannerComponent,
  embedded = false,
}) {
  const navigate = useNavigate();
  const { cart } = useCart();
  const cartItemCount = cart?.reduce((total, item) => total + (item.quantity || 1), 0) || 0;
  const [isListening, setIsListening] = useState(false);
  const routerLocation = useRouterLocation();
  const headerRef = useRef(null);
  const FIXED_QUICK_THEME_COLOR = "#FE5502";

  // Same admin-set logo (Global Settings) used by the desktop navbar and footer,
  // with a static fallback so the header never shows a broken image.
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("user") || "/final_logo200.png");
  useEffect(() => {
    const apply = () => {
      const userLogo = getAppLogo("user");
      if (userLogo) setLogoUrl(userLogo);
    };
    apply();
    return subscribeBusinessSettings(apply);
  }, []);

  const [notifications, setNotifications] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("food_user_notifications");
    return saved ? JSON.parse(saved) : [];
  });

  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 100 });

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("food_user_notifications");
      setNotifications(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener("notificationsUpdated", sync);
    return () => window.removeEventListener("notificationsUpdated", sync);
  }, []);

  const isFood = activeTab === "food";
  const theme =
    activeTab === "quick"
      ? { accent: FIXED_QUICK_THEME_COLOR }
      : foodTheme(vegMode);
  const isLightChrome = isFood || activeTab === "quick";
  const isDarkTheme = !isLightChrome && isColorDark(theme.accent);
  const textColorClass = isLightChrome
    ? "text-gray-900"
    : isDarkTheme
      ? "text-white"
      : "text-gray-900";
  const subtextColorClass = isLightChrome
    ? "text-gray-500"
    : isDarkTheme
      ? "text-white/80"
      : "text-gray-600";
  const iconColor = isLightChrome
    ? theme.accent
    : isDarkTheme
      ? "#ffffff"
      : "#111827";

  const walletPath =
    activeTab === "quick"
      ? "/quick/wallet"
      : "/food/user/wallet";

  const { title: locationTitle, subtitle: locationSubtitle } = useMemo(
    () => buildLocationDisplay(savedAddressText, location),
    [savedAddressText, location],
  );

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const remoteItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      id: item.id || item._id,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Just now",
    }));
    return [...remoteItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime(),
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount =
    notifications.filter((item) => !item.read).length + broadcastUnreadCount;

  const removeNotification = (id, source) => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setNotifications((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem("food_user_notifications", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      return next;
    });
  };

  const openSearch = () => {
    if (handleSearchFocus) {
      handleSearchFocus();
      return;
    }
    if (activeTab === "quick") {
      navigate("/quick/search");
      return;
    }
    navigate("/food/user/search");
  };

  return (
    <motion.div
      ref={headerRef}
      className={cn(
        "relative z-50 border-none pb-0 outline-none transition-colors duration-300 md:hidden",
        isLightChrome ? "bg-white dark:bg-[#0a0a0a]" : "bg-transparent",
      )}
      style={!isLightChrome ? { backgroundColor: theme.accent } : undefined}
    >
      <header
        className={cn(
          "px-3 pt-2 pb-4 outline-none transition-colors duration-300 sm:px-4",
          isLightChrome
            ? "bg-white dark:bg-[#0a0a0a]"
            : "border-b-0 border-none",
        )}
        style={!isLightChrome ? { backgroundColor: "transparent" } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/food/user"
            className="flex shrink-0 items-center border-0 bg-transparent p-0 outline-none"
          >
            <img
              src={logoUrl}
              alt="ItzoFood"
              className="h-7 sm:h-8 w-auto object-contain dark:brightness-0 dark:invert"
              onError={(e) => { e.target.onerror = null; e.target.src = "/final_logo200.png"; }}
            />
          </Link>

          {!embedded && (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {isFood && (
                <div className="flex items-center gap-1 mr-1 bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-700 relative z-10 cursor-pointer" onClick={() => onVegModeChange?.(!vegMode)}>
                  <span className="text-[9px] font-bold text-green-700 dark:text-green-500 mt-0.5">VEG</span>
                  <Switch
                    checked={vegMode}
                    onCheckedChange={onVegModeChange}
                    className="data-[state=checked]:bg-green-600 scale-[0.7] -mr-1 pointer-events-auto"
                  />
                </div>
              )}
              <Link
                to="/food/user/cart"
                className={cn(
                  "relative rounded-full h-9 w-9 sm:h-10 sm:w-10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center shrink-0",
                  isLightChrome
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-800 shadow-sm"
                    : isDarkTheme
                      ? "bg-white/20 text-white"
                      : "bg-black/5 text-gray-800",
                )}
                aria-label="Open cart"
              >
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-[#FE5502] text-[10px] sm:text-[11px] font-bold text-white border-2 border-white shadow-sm">
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </span>
                )}
              </Link>

              <Link
                to={walletPath}
                className={cn(
                  "relative rounded-full h-9 w-9 sm:h-10 sm:w-10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center shrink-0",
                  isLightChrome
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-800 shadow-sm"
                    : isDarkTheme
                      ? "bg-white/20 text-white"
                      : "bg-black/5 text-gray-800",
                )}
                aria-label="Open wallet"
              >
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
              </Link>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "relative rounded-full border-0 h-9 w-9 sm:h-10 sm:w-10 outline-none transition-all hover:scale-105 active:scale-95 flex items-center justify-center shrink-0",
                      isLightChrome
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 shadow-sm"
                        : isDarkTheme
                          ? "bg-white/20 text-white"
                          : "bg-black/5 text-gray-800",
                    )}
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-[#FE5502] text-[10px] sm:text-[11px] font-bold text-white border-2 border-white shadow-sm">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[200] mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-none p-0 shadow-2xl"
                  align="end"
                >
                  <div className="bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
                      <h3 className="flex items-center gap-2 font-bold text-gray-900">
                        Notifications
                        {unreadCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-4 border-none bg-red-100 text-[10px] text-red-600"
                          >
                            {unreadCount} New
                          </Badge>
                        )}
                      </h3>
                      <Link to="/food/user/notifications" className="text-xs font-bold text-red-600">
                        {mergedNotifications.length > 0 ? "View All" : ""}
                      </Link>
                    </div>
                    <div className="custom-scrollbar max-h-80 overflow-y-auto sm:max-h-96">
                      {mergedNotifications.length > 0 ? (
                        mergedNotifications.map((item, index) => (
                          <div
                            key={item.id || `notif-${index}`}
                            className="flex items-start gap-3 border-b border-gray-50 p-4 last:border-0"
                          >
                            <div className="mt-1 rounded-full bg-red-100 p-2 text-red-600">
                              <Bell className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-bold text-gray-900">
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="whitespace-nowrap text-[10px] text-gray-400">
                                    {item.time}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeNotification(item.id, item.source);
                                    }}
                                    className="rounded-full border-0 bg-transparent p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                                {item.message}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-8 text-center">
                          <BellOff className="h-10 w-10 text-gray-300" />
                          <p className="text-xs font-medium text-gray-400">All caught up!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </header>


    </motion.div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, Search, SlidersHorizontal, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings";

const tabs = [
  { id: "food", name: "Food", shortName: "Food" },
  { id: "quick", name: "Quick Commerce", shortName: "Quick" },
];

const TAB_GLYPHS = { food: "🍔", quick: "📦" };

const foodTheme = (vegMode) => ({
  accent: vegMode ? "#2e7d32" : "#FB4F01",
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
  onFilterClick,
}) {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const headerRef = useRef(null);
  const FIXED_QUICK_THEME_COLOR = "#FB4F01";

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

  const [localUnread, setLocalUnread] = useState(0);
  const { unreadCount: broadcastUnreadCount } = useNotificationInbox("user", { limit: 100 });
  useEffect(() => {
    const sync = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("food_user_notifications") || "[]");
        setLocalUnread(Array.isArray(saved) ? saved.filter((item) => !item.read).length : 0);
      } catch {
        setLocalUnread(0);
      }
    };
    sync();
    window.addEventListener("notificationsUpdated", sync);
    return () => window.removeEventListener("notificationsUpdated", sync);
  }, []);
  const hasUnread = localUnread + (broadcastUnreadCount || 0) > 0;

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

  const { title: locationTitle, subtitle: locationSubtitle } = useMemo(
    () => buildLocationDisplay(savedAddressText, location),
    [savedAddressText, location],
  );

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

  const logoBlock = (
    <Link
      to="/food/user"
      className="flex shrink-0 items-center border-0 bg-transparent p-0 outline-none"
    >
      <img
        src={logoUrl}
        alt="ItzoFood"
        className={cn(
          "w-auto object-contain dark:brightness-0 dark:invert",
          embedded ? "h-7 sm:h-8" : "h-12 w-12 rounded-full bg-white p-1 shadow-sm",
        )}
        onError={(e) => { e.target.onerror = null; e.target.src = "/final_logo200.png"; }}
      />
    </Link>
  );

  const headerTitle = location?.area || location?.city || locationTitle;
  const headerSubtitle = isMeaningfulLocationValue(savedAddressText) ? savedAddressText : locationSubtitle;

  return (
    <>
      <motion.div
        ref={headerRef}
        className={cn(
          "relative z-10 border-none pb-0 outline-none transition-colors duration-300 md:hidden",
          isLightChrome ? "bg-white dark:bg-[#0a0a0a]" : "bg-transparent",
        )}
        style={!isLightChrome ? { backgroundColor: theme.accent } : undefined}
      >
        <header
          className={cn(
            "px-3 pt-2 outline-none transition-colors duration-300 sm:px-4",
            embedded ? "pb-4" : "pb-1",
            isLightChrome
              ? embedded
                ? "bg-white dark:bg-[#0a0a0a]"
                : "bg-gradient-to-br from-orange-100 via-orange-50 to-white dark:bg-[#0a0a0a] dark:bg-none"
              : "border-b-0 border-none",
          )}
          style={!isLightChrome ? { backgroundColor: "transparent" } : undefined}
        >
          <div className="flex items-center justify-between gap-3">
            {embedded ? (
              logoBlock
            ) : (
              <>
                {logoBlock}
                <button
                  type="button"
                  onClick={handleLocationClick}
                  className="flex min-w-0 flex-1 flex-col items-start border-0 bg-transparent p-0 text-left outline-none"
                  aria-label="Choose delivery location"
                >
                  <span className="flex max-w-full items-center gap-1">
                    <span className="truncate text-base font-extrabold text-gray-900 dark:text-white">
                      {headerTitle}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-800 dark:text-gray-300" strokeWidth={2.5} />
                  </span>
                  <span className="max-w-full truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                    {headerSubtitle}
                  </span>
                </button>
                <Link
                  to="/food/user/notifications"
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 shadow-sm outline-none"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" strokeWidth={2} />
                  {hasUnread && (
                    <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                  )}
                </Link>
              </>
            )}
          </div>
        </header>
      </motion.div>

      {/* Search row is its own sticky element (direct child of the page container)
          so it stays pinned while the logo/location row scrolls away. */}
      {!embedded && (
        <div className="sticky top-0 z-50 flex h-16 items-center gap-2 bg-white px-3 sm:px-4 md:hidden dark:bg-[#0a0a0a]">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border bg-white px-4 text-left shadow-sm outline-none dark:bg-gray-900"
            style={{ borderColor: `${theme.accent}40` }}
            aria-label="Search"
          >
            <Search className="h-5 w-5 shrink-0 text-gray-700 dark:text-gray-300" strokeWidth={2} />
            <span className="block truncate text-sm font-medium text-gray-400">
              {placeholders?.[placeholderIndex] || "Search for restaurants, cuisines, food..."}
            </span>
          </button>
          {isFood && onFilterClick && (
            <button
              type="button"
              onClick={onFilterClick}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-0 bg-transparent outline-none"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-6 w-6 text-gray-800 dark:text-gray-200" strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

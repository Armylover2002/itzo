import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ChevronDown,
  Search,
  Mic,
  Bookmark,
  Wallet,
  Bell,
  BellOff,
  X,
  ShoppingCart,
  Pizza,
  Beef,
  ChefHat,
  Soup,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@food/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import foodPattern from "@food/assets/food_pattern_background.png";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const tabs = [
  {
    id: "food",
    name: "Food",
    icon: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png",
  },
];

const normalizeHex = (hex, fallback = "#8e24aa") => {
  const value = String(hex || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
};

const withAlpha = (hex, alpha) => {
  const value = normalizeHex(hex).slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const quickTheme = (baseColor) => {
  const base = normalizeHex(baseColor, "#2f7a46");
  return {
    topBg: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%), ${base}`,
    accent: base,
    text: "#ffffff",
    activeBg: base,
    activeText: "#ffffff",
    inactiveBg: "rgba(0,0,0,0.3)",
    inactiveBorder: "rgba(255,255,255,0.08)",
  };
};

const foodTheme = (vegMode) => {
  const base = vegMode ? "#2f7a46" : "#FE5502";
  return {
    topBg: `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%), ${base}`,
    accent: base,
    text: "#ffffff",
    activeBg: base,
    activeText: "#ffffff",
    inactiveBg: "rgba(0,0,0,0.25)",
    inactiveBorder: "rgba(255,255,255,0.08)",
  };
};

const isMeaningfulLocationValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(
    normalized &&
      normalized !== "select location" &&
      normalized !== "current location"
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

  const fallbackTitle =
    location?.area || location?.city || "Select Location";
  const fallbackSubtitle =
    location?.address || location?.city || "Tap to choose delivery location";

  return {
    title: fallbackTitle,
    subtitle: fallbackSubtitle,
  };
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
  headerVideoUrl,
  quickThemeColor,
  onQuickTabIntent,
  bannerComponent,
  embedded = false,
}) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const routerLocation = useRouterLocation();
  const videoRef = useRef(null);
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("food_user_notifications");
    return saved ? JSON.parse(saved) : [];
  });
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("food_user_notifications");
      setNotifications(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener("notificationsUpdated", sync);
    return () => window.removeEventListener("notificationsUpdated", sync);
  }, []);

  const isFoodActive = routerLocation.pathname.startsWith('/food');
  const theme = activeTab === "quick" ? quickTheme(quickThemeColor) : foodTheme(vegMode);
  const isFood = activeTab === "food";
  const walletPath = isFood ? "/food/user/wallet" : "/quick/wallet";
  const { title: locationTitle, subtitle: locationSubtitle } = useMemo(
    () => buildLocationDisplay(savedAddressText, location),
    [savedAddressText, location],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isFood) {
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
      return;
    }

    video.pause();
  }, [isFood]);

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

  const handleVoiceSearch = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        if (activeTab === "quick") {
          navigate("/quick/search", { state: { query: transcript } });
        } else {
          // For food search, we might need to trigger the overlay or redirect to a dedicated search page
          // Based on Home.jsx, it opens an overlay. But we can redirect to the search page if available.
          navigate("/food/user/search", { state: { query: transcript } });
        }
      }
    };
    recognition.start();
  };

  return (
    <motion.div
      className={`relative transition-all duration-400 ${
        isFood
          ? "min-h-[280px] overflow-hidden"
          : "min-h-[120px] overflow-visible"
      }`}
      style={{ background: theme.topBg, color: theme.text }}
    >
      {headerVideoUrl && (
        <div className="absolute inset-0 z-0 flex justify-center overflow-hidden">
            {/* Video temporarily removed to improve loading time
            <video
              ref={videoRef}
              src={headerVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              className={`h-full w-full object-cover object-center transition-opacity duration-200 ${
                isFood ? "opacity-100" : "opacity-0"
              }`}
            />
            */}
          <div 
            className="absolute inset-0 transition-colors duration-700" 
            style={{ 
              background: `linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%), ${theme.accent}` 
            }} 
          />
          <div 
            className="absolute inset-0 transition-colors duration-700 opacity-30"
            style={{
              background: `radial-gradient(circle at 20% 30%, ${withAlpha(theme.accent, 0.4)}, transparent 70%)`
            }}
          />
        </div>
      )}

      <div
        className="absolute inset-0 z-[1] opacity-[0.25] pointer-events-none"
        style={{
          backgroundImage: `url(${foodPattern})`,
          backgroundSize: "200px",
          backgroundRepeat: "repeat",
          mixBlendMode: "overlay",
        }}
      />

      {isFood && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Pizza className="absolute top-10 right-[15%] opacity-[0.10]" style={{ color: theme.accent }} size={64} />
          <Beef className="absolute top-40 left-[10%] opacity-[0.08]" style={{ color: theme.accent }} size={80} />
          <ChefHat className="absolute bottom-[20%] right-[20%] opacity-[0.08]" style={{ color: theme.accent }} size={56} />
          <Coffee className="absolute top-20 left-[30%] opacity-[0.08]" style={{ color: theme.accent }} size={48} />
          <Soup className="absolute bottom-[40%] left-[5%] opacity-[0.05]" style={{ color: theme.accent }} size={72} />
        </div>
      )}

      <div className="flex items-center justify-between px-5 pt-4 mb-2 relative z-10">
        <button
          type="button"
          className="flex items-start gap-2 cursor-pointer flex-1 min-w-0 bg-transparent border-0 p-0 text-left outline-none"
          onClick={handleLocationClick}
        >
          <>
            <Navigation
              className="h-[14px] w-[14px] rotate-[15deg] mt-[5px] shrink-0"
              style={{ color: theme.accent, fill: theme.accent }}
              strokeWidth={2.5}
            />
            <div className="flex min-w-0 max-w-[190px] flex-col">
              <div className="flex items-center gap-[3px]">
                <span className="truncate text-[16px] font-extrabold tracking-[-0.3px]">
                  {locationTitle}
                </span>
                <ChevronDown className="h-[14px] w-[14px] shrink-0 opacity-80" strokeWidth={3} />
              </div>
              <span className="max-w-[190px] truncate text-[11px] font-medium text-white/75">
                {locationSubtitle}
              </span>
            </div>
          </>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={walletPath}
            className="h-[38px] w-[38px] rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            aria-label="Open wallet"
          >
            <Wallet className="h-[19px] w-[19px] text-[#282c3f]" strokeWidth={2} />
          </Link>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative h-[38px] w-[38px] rounded-full bg-white/95 border border-white/60 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              >
                <Bell className="h-[18px] w-[18px] text-[#282c3f]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-yellow-400 border border-white" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden border-none shadow-2xl rounded-2xl mt-2" align="end">
              <div className="bg-white">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-600 border-none text-[10px] h-4">
                        {unreadCount} New
                      </Badge>
                    )}
                  </h3>
                  <Link to="/food/user/notifications" className="text-xs font-bold text-red-600">
                    {mergedNotifications.length > 0 ? "View All" : ""}
                  </Link>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {mergedNotifications.length > 0 ? (
                    mergedNotifications.slice(0, 5).map((item, index) => (
                      <div key={item.id || `notif-${index}`} className="p-4 flex items-start gap-3 border-b border-gray-50 last:border-0">
                        <div className="mt-1 p-2 rounded-full bg-red-100/50 text-red-600">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900 truncate">{item.title}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">{item.time}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  removeNotification(item.id, item.source);
                                }}
                                className="rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center gap-2">
                      <BellOff className="h-10 w-10 text-gray-200" />
                      <p className="text-xs text-gray-400 font-medium">All caught up!</p>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Link
            to="/food/user/cart"
            className="h-[38px] w-[38px] rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-[20px] w-[20px] text-[#282c3f]" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Mobile-only Food / Quick Toggle Buttons */}
      {!embedded && (
        <div className="px-5 pt-3 pb-1 relative z-10 sm:hidden">
          <div className="grid grid-cols-2 gap-3">
            {/* Food Button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/food/user')}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-4 rounded-[12px] transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-transparent",
                isFoodActive
                  ? "bg-[#FE5502] text-white shadow-[0_6px_20px_rgba(254,85,2,0.25)] font-bold"
                  : "bg-[#F1F5F9]/95 text-slate-600 border-transparent font-medium"
              )}
            >
              <span className="text-[18px] mb-0.5" role="img" aria-label="burger">🍔</span>
              <span className="text-[10px] tracking-[0.5px] uppercase">FOOD</span>
            </motion.button>

            {/* Quick Commerce Button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/quick')}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-4 rounded-[12px] transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-transparent",
                !isFoodActive
                  ? "bg-[#0c831f] text-white shadow-[0_6px_20px_rgba(12,131,31,0.25)] font-bold"
                  : "bg-[#F1F5F9]/95 text-slate-600 border-transparent font-medium"
              )}
            >
              <span className="text-[18px] mb-0.5" role="img" aria-label="box">📦</span>
              <span className="text-[10px] tracking-[0.5px] uppercase">QUICK COMMERCE</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Hidden because there is only one tab and it is redundant as per request
      <div className="px-3 pt-1 flex items-end justify-start gap-1 relative z-10">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const handleTabIntent = () => {
            if (tab.id === "quick") {
              onQuickTabIntent?.();
            }
          };
          const handleTabClick = () => {
            if (tab.route) {
              const redirectTo =
                `${routerLocation.pathname || "/food/user"}${routerLocation.search || ""}${routerLocation.hash || ""}`;
              navigate(tab.route, { state: { redirectTo } });
              return;
            }
            setActiveTab(tab.id);
          };
          return (
            <button
              key={tab.id}
              onClick={handleTabClick}
              onMouseEnter={handleTabIntent}
              onTouchStart={handleTabIntent}
              onFocus={handleTabIntent}
              className={`relative flex flex-col items-center justify-start flex-1 min-w-0 h-[64px] transition-all duration-300 ${isActive ? "z-20" : "z-10"}`}
            >
              {tab.badge && (
                <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 z-30 rounded-full bg-gradient-to-r from-red-500 to-red-400 px-2 py-0.5 text-[7.5px] font-black uppercase text-white shadow-lg">
                  {tab.badge}
                </div>
              )}
              
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 transition-all duration-300",
                  isActive ? "top-0 rounded-t-[20px]" : "top-[10px] rounded-t-[16px]"
                )}
                style={{
                  background: isActive ? theme.activeBg : theme.inactiveBg,
                  borderTop: isActive ? `1px solid ${withAlpha(theme.accent, 0.1)}` : `1px solid ${theme.inactiveBorder}`,
                  boxShadow: isActive ? "0 -4px 20px rgba(0,0,0,0.12)" : "none",
                  backdropFilter: isActive ? undefined : "blur(12px)",
                }}
              >
                {isActive && (
                  <>
                    <div 
                      className="absolute bottom-0 -left-[14px] w-[14px] h-[14px] pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 0 0, transparent 14px, ${theme.activeBg} 0)`
                      }}
                    />
                    <div 
                      className="absolute bottom-0 -right-[14px] w-[14px] h-[14px] pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 100% 0, transparent 14px, ${theme.activeBg} 0)`
                      }}
                    />
                  </>
                )}
              </div>

              <div className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-center gap-[4px] px-1 ${isActive ? "top-0" : "top-[10px]"}`}>
                <img
                  src={tab.icon}
                  alt={tab.name}
                  className={`object-contain transition-transform duration-300 ${isActive ? "h-[28px] w-[28px] scale-110" : "h-[24px] w-[24px] brightness-0 invert opacity-80"}`}
                />
                <span
                  style={{ color: "#ffffff" }}
                  className={`text-[10px] font-black tracking-tight ${isActive ? "opacity-100" : "opacity-80"}`}
                >
                  {tab.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      */}

      <div className={cn("relative z-10 pb-0 px-3 overflow-visible", isFood ? "pt-3" : "pt-0")}>
        {isFood && (
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex-1 rounded-[12px] h-[46px] flex items-center px-3 cursor-pointer relative overflow-hidden bg-white shadow-[0_6px_18px_rgba(15,23,42,0.10)] border-0 text-left"
              onClick={handleSearchFocus}
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2.5px] rounded-l-[12px] bg-gradient-to-b from-[#FE5502] to-[#C83C00]" />
              <Search className="h-[16px] w-[16px] ml-1.5 mr-2 flex-shrink-0 text-[#FE5502]" strokeWidth={2.3} />
              <div className="flex-1 overflow-hidden relative h-[20px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIndex}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 whitespace-nowrap leading-[22px] text-[12.5px] font-medium text-gray-400"
                  >
                    {placeholders?.[placeholderIndex] || "Search for food..."}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[1px] h-[16px] bg-red-200" />
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={cn(
                    "h-[28px] w-[28px] rounded-full flex items-center justify-center transition-all",
                    isListening ? "bg-red-500 scale-110 animate-pulse" : "bg-red-50 hover:bg-red-100"
                  )}
                >
                  <Mic className={cn("h-[14px] w-[14px]", isListening ? "text-white" : "text-[#FE5502]")} strokeWidth={2.3} />
                </button>
              </div>
            </div>

            <div className="px-2 flex flex-col items-center justify-center min-w-[64px]">
              <div className="flex flex-col items-center mb-1">
                <span className="text-[9px] font-black tracking-[0.5px] text-white leading-none">VEG</span>
                <span className="text-[7px] font-black tracking-[0.5px] text-white/70 leading-none mt-0.5">MODE</span>
              </div>
              <div className="scale-[0.80]">
                <Switch
                  checked={Boolean(vegMode)}
                  onCheckedChange={(checked) => onVegModeChange?.(checked)}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {isFood && bannerComponent && (
        <div className="relative z-10 w-full pb-5 pt-1">
          {bannerComponent}
        </div>
      )}
    </motion.div>
  );
}

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useLocation as useRouterLocation, useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
import { useLocationSelector } from "@food/components/user/UserLayout";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useCart } from "../../context/CartContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";

const getLuminance = (hex) => {
  if (!hex) return 0;
  const color = hex.replace("#", "");
  const rgb = parseInt(color, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
import {
  getQuickCartPath,
  getQuickHomePath,
  getQuickOrdersPath,
  getQuickProfilePath,
  getQuickSearchPath,
  getQuickWalletPath,
  getQuickWishlistPath,
} from "../../utils/routes";
import LogoImage from "../../assets/Logo.png";
import { getAppLogo, getCachedSettings } from "@common/utils/businessSettings";
import shoppingCartAnimation from "@/assets/lottie/shopping-cart.json";
import { Sparkles } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import ThemeToggle from "../layout/ThemeToggle";

// MUI Icons
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import DiamondIcon from "@mui/icons-material/Diamond";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

const ICON_COMPONENTS = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  food: LocalCafeIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  luggage: LuggageIcon,
  grocery: LocalGroceryStoreIcon,
};

const serviceTabs = [
  { name: "Food" },
  { name: "Quick" },
  { name: "Instamart" },
  { name: "Dineout" },
];

const lightenHex = (hex, amount = 0.18) => {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;

  const clamp = (value) => Math.max(0, Math.min(255, value));
  const toHex = (value) => clamp(value).toString(16).padStart(2, "0");
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

/** Full-width bottom stroke + tab curve; l/r are 0–100% of column where the inner bump sits. */
function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
}) {
  return (
    <motion.div
      layout
      whileTap={{ scale: 0.95 }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className={cn(
        "relative z-[2] flex min-w-[54px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 snap-start md:min-w-[64px] transition-all duration-200 rounded-xl",
        isActive ? "text-white" : "text-white/80 hover:text-white"
      )}
    >
      <div className="relative z-10 flex h-8 w-8 items-center justify-center md:h-10 md:w-10">
        {typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: { xs: 20, md: 22 },
              color: "#ffffff",
              opacity: isActive ? 1 : 0.75,
              transform: isActive ? "scale(1.08)" : "scale(1)",
              transition: "all 0.2s ease-out",
            }}
          />
        ) : (
          <img
            src={cat.icon}
            alt={cat.name}
            className={cn(
              "h-4 w-4 object-contain md:h-5 md:w-5 transition-transform",
              isActive ? "opacity-100 brightness-200 scale-110" : "opacity-75 brightness-0 invert"
            )}
          />
        )}
      </div>

      <div className="relative w-full flex flex-col items-center">
        <span
          className={cn(
            "relative z-10 block max-w-[76px] truncate text-center text-[9px] uppercase tracking-tight md:max-w-[90px] md:text-[10.5px]",
            isActive ? "font-black text-white" : "font-semibold text-white/80",
          )}
        >
          {cat.name}
        </span>
        {isActive && (
          <span className="h-[2px] w-4 bg-white rounded-full mt-0.5 shadow-sm" />
        )}
      </div>

      {isActive && (
        <motion.div
          layoutId="active-nav-glow"
          className="absolute inset-0 bg-white/20 rounded-xl -z-10 border border-white/25 shadow-xs"
        />
      )}
    </motion.div>
  );
}

const MainLocationHeader = ({
  categories: externalCategories = [],
  activeCategory,
  onCategorySelect,
  embedded = false,
  embeddedHeaderColor = null,
  showTopContent = true,
  showSearchBar = true,
  showCategories = true,
  hideDeliveryTime = false,
  hideLogo = false,
}) => {
  const { scrollY } = useScroll();
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  // Only resolves to Food's real address-selector flow when this header is embedded
  // inside the shared Food/Quick page - falls back to a no-op outside that layout.
  const { openLocationSelector } = useLocationSelector();
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { cartCount } = useCart();
  const { settings } = useSettings();
  const appName = settings?.companyName || settings?.appName || "ItzoFood";
  const cachedBusinessSettings = getCachedSettings();
  const logoUrl = settings?.userLogo?.url || settings?.logoUrl || cachedBusinessSettings?.userLogo?.url || getAppLogo('user') || LogoImage;
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const cartPath = getQuickCartPath(routerLocation.pathname);
  const homePath = getQuickHomePath(routerLocation.pathname);
  const searchPath = getQuickSearchPath(routerLocation.pathname);
  const wishlistPath = getQuickWishlistPath();

  const [internalCategories, setInternalCategories] = useState([]);

  useEffect(() => {
    // Only fetch if showCategories is true and no external categories provided
    if (showCategories && externalCategories.length === 0) {
      customerApi.getCategories().then((res) => {
        if (res.data.success) {
          const dbCats = res.data.results || res.data.result || [];
          const headers = dbCats
            .filter((cat) => cat.type === "header")
            .map((cat) => ({
              ...cat,
              id: cat._id,
              icon: (cat.iconId && ICON_COMPONENTS[cat.iconId]) || Sparkles,
            }));
          setInternalCategories(headers);
        }
      });
    }
  }, [showCategories, externalCategories.length]);

  const categories = (externalCategories.length > 0 ? externalCategories : internalCategories)
    .filter(cat => !serviceTabs.some(tab => tab.name.toLowerCase() === cat.name?.toLowerCase()));

  // Search Logic
  const handleSearchClick = () => {
    navigate(searchPath);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate(searchPath, { state: { query: e.target.value } });
    }
  };

  // Search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000); // Pause after full phrase
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            // Finished typing
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          // Deleting
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            // Finished deleting
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100,
    ); // 50ms deleting speed, 100ms typing speed

    return () => clearTimeout(timeout);
  }, [typingState]);

  // Smooth scroll interpolations.
  // In embedded mode this header lives inside the main food page, so collapsing
  // it on page scroll causes the category rail to "compact" or glitch.
  const rawHeaderTopPadding = useTransform(scrollY, [0, 160], [16, 12]);
  const rawHeaderBottomPadding = useTransform(scrollY, [0, 160], [4, 3]);
  const rawHeaderRoundness = useTransform(scrollY, [0, 160], [0, 24]);
  const rawBgOpacity = useTransform(scrollY, [0, 160], [1, 0.98]);

  // Content animations
  const rawContentHeight = useTransform(scrollY, [0, 160], ["64px", "0px"]);
  const rawContentOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const rawNavHeight = useTransform(scrollY, [0, 200], ["60px", "56px"]);
  const rawNavOpacity = useTransform(scrollY, [0, 200], [1, 1]);
  const rawNavMargin = useTransform(scrollY, [0, 200], [4, 2]);
  const rawCategorySpacing = useTransform(scrollY, [0, 200], [3, 1]);
  const rawCartOpacity = useTransform(scrollY, [0, 110, 150], [1, 0.7, 0]);
  const rawCartScale = useTransform(scrollY, [0, 110, 150], [1, 0.9, 0.75]);

  const rawDisplayContent = useTransform(scrollY, (value) =>
    value > 160 ? "none" : "block",
  );
  const rawDisplayNav = useTransform(scrollY, () => "flex");
  const rawDisplayCart = useTransform(scrollY, (value) =>
    value > 150 ? "none" : "block",
  );

  const headerTopPadding = embedded ? 16 : rawHeaderTopPadding;
  const headerBottomPadding = embedded ? 4 : rawHeaderBottomPadding;
  const headerRoundness = embedded ? 0 : rawHeaderRoundness;
  const bgOpacity = embedded ? 1 : rawBgOpacity;
  const contentHeight = embedded ? "64px" : rawContentHeight;
  const contentOpacity = embedded ? 1 : rawContentOpacity;
  const navHeight = embedded ? "60px" : rawNavHeight;
  const navOpacity = embedded ? 1 : rawNavOpacity;
  const navMargin = embedded ? 0 : rawNavMargin;
  const categorySpacing = embedded ? -2 : rawCategorySpacing;
  const cartOpacity = embedded ? 1 : rawCartOpacity;
  const cartScale = embedded ? 1 : rawCartScale;
  const displayContent = embedded ? "block" : rawDisplayContent;
  const displayNav = embedded ? "flex" : rawDisplayNav;
  const displayCart = embedded ? "block" : rawDisplayCart;

  const baseHeaderColor = "#FE5502";
  const headerGradient = buildHeaderGradient("#FE5502");
  const searchBarBg = buildSearchBarBackgroundColor("#FE5502");
  const categoryAccent = "#ffffff";

  const luminance = getLuminance(baseHeaderColor || "#0f172a");
  const isDarkBackground = luminance < 128;
  const textColorClass = isDarkBackground ? "text-white" : "text-slate-900";
  const subTextColorClass = isDarkBackground ? "text-white/90" : "text-slate-800";
  const iconColor = isDarkBackground ? "#ffffff" : "#111827";
  const appNameBorderClass = isDarkBackground ? "border-white/20" : "border-black/10";

  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor || "#1e293b");
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => {
      document.documentElement.style.removeProperty(
        "--customer-mini-cart-color",
      );
    };
  }, [baseHeaderColor]);

  return (
    <>
      <div
        className={cn(
          embedded
            ? "sticky top-0 z-40"
            : "fixed top-0 left-0 right-0 z-200",
          isProductDetailOpen && "hidden md:block",
        )}>
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
            backgroundImage: headerGradient,
          }}
          className={cn(
            "px-4 transition-all duration-300",
            embedded
              ? "border-b border-black/5 shadow-[0_10px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl"
              : "sticky top-0 shadow-[0_4px_20px_rgba(0,0,0,0.15)]",
          )}>
          {/* Subtle Glow Overlay */}
          {embedded ? (
            <>
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <circle cx="10%" cy="10%" r="20" fill="white" />
                  <circle cx="90%" cy="20%" r="15" fill="white" />
                  <circle cx="50%" cy="80%" r="25" fill="white" />
                  <path d="M 0 50 Q 25 30 50 50 T 100 50" stroke="white" strokeWidth="0.5" fill="none" />
                  <path d="M 0 70 Q 25 50 50 70 T 100 70" stroke="white" strokeWidth="0.5" fill="none" />
                </svg>
              </div>
              <div
                className="absolute top-0 left-1/4 h-24 w-24 rounded-full blur-[48px] pointer-events-none"
                style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
              />
              <div className="absolute bottom-0 right-1/4 h-28 w-28 rounded-full bg-yellow-400/10 blur-[64px] pointer-events-none" />
            </>
          ) : (
            <div className="absolute inset-0 bg-white/8 pointer-events-none" />
          )}

          {/* Desktop/Tablet Header Layout (md and above) */}
          {!embedded && (showTopContent || showSearchBar) && (
            <>
              <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
                {/* Left Section: Logo + Location row */}
                <div className="flex items-center gap-4 lg:gap-8">
                  {!hideLogo && (
                    <div
                      onClick={() => navigate(homePath)}
                      className="flex items-center gap-3 cursor-pointer group shrink-0">
                      <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                        <img
                          src={logoUrl}
                          alt={`${appName} Logo`}
                          className="h-10 md:h-16 w-auto object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Location Block (Desktop inline row) */}
                  <div className={cn("flex flex-col h-10 justify-center", hideLogo ? "" : "border-l border-black/10 pl-4 lg:pl-8")}>
                    {!hideDeliveryTime && (
                      <div className="flex items-center gap-1.5 opacity-70">
                        <AccessTimeIcon sx={{ fontSize: 13, color: iconColor }} />
                        <span className={`text-[11px] font-black ${textColorClass} uppercase tracking-widest leading-none`}>
                          {currentLocation.time}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      data-lenis-prevent
                      data-lenis-prevent-touch
                      onClick={() => {
                        setIsLocationOpen(true);
                      }}
                      className={`flex items-center gap-1 ${textColorClass} hover:opacity-80 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left ${hideDeliveryTime ? '' : 'mt-0'}`}>
                      <LocationOnIcon sx={{ fontSize: hideDeliveryTime ? 18 : 14, color: "inherit" }} />
                      <div className={cn(
                        "leading-tight max-w-[250px] lg:max-w-[320px] truncate",
                        hideDeliveryTime ? "text-[16px] font-black" : "text-[13px] font-bold"
                      )}>
                        {isFetchingLocation
                          ? "Detecting location..."
                          : currentLocation.name}
                      </div>
                      <ChevronDownIcon
                        sx={{ fontSize: hideDeliveryTime ? 16 : 12, opacity: 0.5, color: iconColor }}
                      />
                    </button>
                  </div>
                </div>

                {/* Center Section: Empty (Search moved to categories) */}
                <div className="flex-1 px-6">
                  <div className="flex items-center justify-end gap-3">
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
                      style={{
                        opacity: cartOpacity,
                        scale: cartScale,
                        display: displayCart,
                      }}
                      type="button"
                      aria-label="Open cart"
                      onClick={() => navigate(cartPath)}
                      className="group relative h-12 w-12 shrink-0 rounded-2xl border border-white/55 bg-white/28 shadow-[0_16px_35px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all duration-300 hover:bg-white/42 hover:shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-black/5 pointer-events-none" />
                      <div className="absolute inset-x-2 top-1 h-px bg-white/70 pointer-events-none" />
                      <Lottie
                        animationData={shoppingCartAnimation}
                        loop
                        className="pointer-events-none absolute inset-0 scale-[1.18] drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition-transform duration-300 group-hover:scale-[1.25]"
                      />
                    </motion.button>
                  </div>
                </div>

                {/* Right Section: Action Icons */}
                <div className="flex items-center gap-5 lg:gap-8 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(wishlistPath)}
                    className={`${textColorClass} hover:text-red-500 transition-all`}>
                    <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.15, rotate: -5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(cartPath)}
                    className={`${textColorClass} hover:opacity-80 transition-all relative group`}>
                    <ShoppingCartOutlinedIcon sx={{ fontSize: 24 }} />
                    {cartCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#FE5502] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-red-800 shadow-sm transition-transform group-hover:-translate-y-0.5">
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </motion.button>

                  <div className="flex items-center">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Embedded Desktop Top Row (Logo + Location + Search + Wallet + Cart) -
              mirrors Food's own desktop header layout, but with Quick's own search/cart/wallet. */}
          {embedded && (
            <div className="hidden md:flex items-center gap-4 lg:gap-6 relative z-20 px-2 lg:px-6 mb-3 mt-1">
              {/* Left: Logo + Location */}
              <div className="flex items-center gap-4 lg:gap-6 shrink-0">
                {!hideLogo && (
                  <div
                    onClick={() => navigate(homePath)}
                    className="flex items-center gap-3 cursor-pointer group shrink-0">
                    <img
                      src={logoUrl}
                      alt={`${appName} Logo`}
                      className="h-10 md:h-14 w-auto object-contain group-hover:scale-110 transition-all duration-300"
                    />
                  </div>
                )}
                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => openLocationSelector()}
                  className={`flex items-center gap-1 ${textColorClass} hover:opacity-80 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left ${hideLogo ? "" : "border-l border-black/10 pl-4 lg:pl-6"}`}>
                  <LocationOnIcon sx={{ fontSize: 18, color: "inherit" }} />
                  <div className="leading-tight max-w-[220px] lg:max-w-[280px] truncate text-[14px] font-black ml-1">
                    {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                  </div>
                  <ChevronDownIcon sx={{ fontSize: 16, opacity: 0.5, color: iconColor }} />
                </button>
              </div>

              {/* Center: Search bar */}
              <div className="flex-1 max-w-2xl mx-auto">
                <motion.div
                  onClick={handleSearchClick}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-full h-[46px] px-4 shadow-md flex items-center bg-white border border-gray-100 cursor-pointer">
                  <SearchIcon sx={{ color: "#FE5502", fontSize: 22 }} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search Products..."}
                    readOnly
                    className="flex-1 bg-transparent border-none outline-none pl-3 text-slate-800 font-bold placeholder:text-slate-300 text-[15px] cursor-pointer"
                  />
                  <div className="flex items-center gap-2 border-l border-red-100 pl-3">
                    <MicIcon sx={{ color: "#FE5502", fontSize: 20 }} />
                  </div>
                </motion.div>
              </div>

              {/* Right: Wallet + Cart */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={getQuickWalletPath()}
                  className="h-11 w-11 rounded-full bg-white/20 border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
                  aria-label="Open wallet"
                >
                  <AccountBalanceWalletIcon sx={{ color: "#ffffff", fontSize: 22 }} />
                </Link>

                <button
                  type="button"
                  aria-label="Open cart"
                  onClick={() => navigate(cartPath)}
                  className="relative h-11 w-11 rounded-full bg-white/20 border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <ShoppingCartOutlinedIcon sx={{ color: "#ffffff", fontSize: 22 }} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-white text-[#FE5502] text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Desktop Module Navigation Bar Row (QUICK, SHOP, ORDERS, PROFILE)
              Shown on md+ always (standalone AND embedded inside the shared Food/Quick page).
              Only Quick's own pages are linked here - the Food/Quick switch cards above
              already handle going back to Food, so no separate "Food" link is needed here. */}
          <div className={cn(
            "hidden md:flex items-center justify-center w-full relative z-20 pb-1",
            embedded ? "pt-1" : "border-t border-white/15 pt-2 mt-2",
          )}>
            <div className="flex items-center space-x-10 lg:space-x-16">
              {/* Quick (Active Tab) */}
              <Link
                to={getQuickHomePath()}
                className="flex flex-col items-center gap-1 px-3 py-1 text-white font-black tracking-wider uppercase relative group"
              >
                <span className="text-xs lg:text-sm font-black tracking-wider uppercase text-white">Quick</span>
                <motion.div
                  layoutId="quickNavIndicatorMain"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  transition={{ duration: 0.3 }}
                />
              </Link>

              {/* Shop (Quick's own shops) */}
              <Link
                to="/quick/shops"
                className="flex flex-col items-center gap-1 px-3 py-1 text-white/75 hover:text-white transition-colors relative group"
              >
                <span className="text-xs lg:text-sm font-black tracking-wider uppercase">Shop</span>
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-transparent group-hover:bg-white/50 transition-colors" />
              </Link>

              {/* Orders (Quick's own orders) */}
              <Link
                to={getQuickOrdersPath()}
                className="flex flex-col items-center gap-1 px-3 py-1 text-white/75 hover:text-white transition-colors relative group"
              >
                <span className="text-xs lg:text-sm font-black tracking-wider uppercase">Orders</span>
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-transparent group-hover:bg-white/50 transition-colors" />
              </Link>

              {/* Profile (Quick's own profile) */}
              <Link
                to={getQuickProfilePath()}
                className="flex flex-col items-center gap-1 px-3 py-1 text-white/75 hover:text-white transition-colors relative group"
              >
                <span className="text-xs lg:text-sm font-black tracking-wider uppercase">Profile</span>
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-transparent group-hover:bg-white/50 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Collapsible Delivery Info & Location (MOBILE ONLY) */}
          {!embedded && showTopContent && <div className="md:hidden">
            <motion.div
              style={{
                height: contentHeight,
                opacity: contentOpacity,
                marginBottom: navMargin,
                display: displayContent,
                overflow: "hidden",
              }}
              className="relative z-10">
              {!hideLogo && (
                <div className="mb-1">
                  <span className={`inline-flex items-center rounded-full border ${appNameBorderClass} bg-white/18 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${textColorClass} backdrop-blur-sm`}>
                    {appName}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  {!hideDeliveryTime && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AccessTimeIcon sx={{ fontSize: 16, color: iconColor }} />
                      <span className={`text-base font-bold ${textColorClass} tracking-tight leading-none`}>
                        {currentLocation.time}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    data-lenis-prevent
                    data-lenis-prevent-touch
                    onClick={() => {
                      setIsLocationOpen(true);
                    }}
                    className={`flex items-center gap-1.5 ${hideDeliveryTime ? textColorClass : subTextColorClass} cursor-pointer group active:scale-95 transition-transform border-0 bg-transparent p-0 text-left ${hideDeliveryTime ? 'mt-1' : ''}`}>
                    <LocationOnIcon sx={{ fontSize: hideDeliveryTime ? 18 : 14, color: iconColor }} />
                    <div className={cn(
                      "leading-tight max-w-[280px] truncate",
                      hideDeliveryTime ? "text-[14px] font-black" : "text-[10px] font-medium"
                    )}>
                      {isFetchingLocation
                        ? "Detecting location..."
                        : currentLocation.name}
                    </div>
                    <ChevronDownIcon
                      sx={{ fontSize: hideDeliveryTime ? 16 : 12, opacity: 0.5, color: iconColor }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>}

          {/* Top Search removed from here and moved to categories section below */}

          {showCategories && categories.length > 0 && (
            <div className="relative z-10 space-y-1 pt-0">
              {/* Compact Search Bar integrated into Categories Section (mobile only when
                  embedded - the desktop top row above already has its own search bar) */}
              <div className={cn("px-4 md:px-0 md:max-w-2xl md:mx-auto py-2", embedded && "md:hidden")}>
                <motion.div
                  onClick={handleSearchClick}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-[12px] md:rounded-full px-4 h-[44px] shadow-md flex items-center bg-white border border-gray-100 cursor-pointer">
                  <SearchIcon sx={{ color: "#FE5502", fontSize: 22 }} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search Products..."}
                    readOnly
                    className="flex-1 bg-transparent border-none outline-none pl-3 text-slate-800 font-bold placeholder:text-slate-300 text-[15px] cursor-pointer"
                  />
                  <div className="flex items-center gap-2 border-l border-red-100 pl-3">
                    <MicIcon sx={{ color: "#FE5502", fontSize: 20 }} />
                  </div>
                </motion.div>
              </div>

              {/* Categories horizontal nav */}
              <motion.div
                style={{
                  height: navHeight,
                  opacity: navOpacity,
                  display: displayNav,
                }}
                className="flex items-end gap-1 overflow-x-auto px-2 pb-0 no-scrollbar"
              >
                {!categories.some(c => String(c._id || c.id) === "all" || c.name?.toLowerCase() === "all") && (
                  <CategoryNavColumn
                    key="all"
                    cat={{ _id: "all", name: "ALL", icon: HomeIcon }}
                    isActive={!activeCategory || activeCategory._id === "all" || activeCategory.id === "all"}
                    categoryAccent={categoryAccent}
                    onCategorySelect={() => onCategorySelect && onCategorySelect({ _id: "all", name: "All", id: "all" })}
                  />
                )}
                {categories.map((cat) => {
                  const isActive =
                    activeCategory &&
                    (activeCategory._id === cat._id || activeCategory.id === cat.id);
                  return (
                    <CategoryNavColumn
                      key={cat._id || cat.id}
                      cat={cat}
                      isActive={isActive}
                      categoryAccent={categoryAccent}
                      onCategorySelect={onCategorySelect}
                    />
                  );
                })}
              </motion.div>
            </div>
          )}

          {/* Background Decorative patterns */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

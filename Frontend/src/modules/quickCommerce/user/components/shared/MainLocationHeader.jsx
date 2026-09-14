import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
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
import {
  getQuickCartPath,
  getQuickHomePath,
  getQuickSearchPath,
  getQuickWishlistPath,
  getQuickCategoriesPath,
  getQuickOrdersPath,
} from "../../utils/routes";
import LogoImage from "@/assets/Logo.jpeg";
import shoppingCartAnimation from "@/assets/lottie/shopping-cart.json";
import { Sparkles } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import ThemeToggle from "../layout/ThemeToggle";
import {
  resolveCategoryIconComponent,
} from "@shared/constants/categoryIconComponents";

// MUI Icons used by header chrome (not category iconId map)
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

// ─── Constants (module-level, never re-created) ───────────────────────────────


const SERVICE_TAB_NAMES = new Set(["food", "quick", "instamart", "dineout"]);

const TYPING_PHRASES = ['"bread"', '"milk"', '"chocolate"', '"eggs"', '"chips"'];
const STATIC_TEXT = "Search ";

const SPRING_LAYOUT = { type: "spring", stiffness: 520, damping: 38, mass: 0.55 };
const SPRING_CURVE = { type: "spring", stiffness: 560, damping: 40, mass: 0.5 };
const SPRING_NAV = { type: "spring", stiffness: 420, damping: 34, mass: 0.6 };

// ─── Pure helpers (outside component → no re-creation on render) ──────────────

const lightenHex = (hex, amount = 0.18) => {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const toHex = (v) => clamp(v).toString(16).padStart(2, "0");
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

function buildActiveTabPath(l, r) {
  const y = 20;
  const mapX = (x) => l + ((x - 1.5) / (98.5 - 1.5)) * (r - l);
  return `M 0 ${y} L ${l} ${y} L ${l} 12 C ${mapX(2.6)} 7 ${mapX(8.2)} 1.55 ${mapX(15)} 1.55 L ${mapX(85)} 1.55 C ${mapX(91.8)} 1.55 ${mapX(97.4)} 7 ${mapX(98.5)} 12 V ${y} L 100 ${y}`;
}

// ─── CategoryNavColumn ────────────────────────────────────────────────────────

const CategoryNavColumn = React.memo(function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
}) {
  const colRef = useRef(null);
  const labelRef = useRef(null);
  const [lr, setLr] = useState({ l: 22, r: 78 });

  const measure = useCallback(() => {
    if (!isActive || !colRef.current || !labelRef.current) return;
    const col = colRef.current.getBoundingClientRect();
    const lab = labelRef.current.getBoundingClientRect();
    if (col.width < 4) return;
    const pad = 5;
    const l = Math.max(0, ((lab.left - col.left - pad) / col.width) * 100);
    const r = Math.min(100, ((lab.right - col.left + pad) / col.width) * 100);
    if (r - l > 6) setLr({ l, r });
  }, [isActive]);

  useLayoutEffect(() => {
    measure();
    if (isActive && colRef.current) {
      const parent = colRef.current.parentElement;
      if (parent) {
        // Calculate the center position relative to the parent
        const parentRect = parent.getBoundingClientRect();
        const childRect = colRef.current.getBoundingClientRect();
        const scrollTarget = parent.scrollLeft + (childRect.left - parentRect.left) - (parentRect.width / 2) + (childRect.width / 2);
        parent.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }
    }
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, isActive]);

  const pathD = useMemo(
    () => (isActive ? buildActiveTabPath(lr.l, lr.r) : ""),
    [isActive, lr.l, lr.r],
  );

  const handleClick = useCallback(() => {
    onCategorySelect?.(cat);
  }, [onCategorySelect, cat]);

  const IconComponent = cat.icon;

  return (
    <motion.div
      ref={colRef}
      layout
      whileTap={{ scale: 0.96 }}
      transition={{ layout: SPRING_LAYOUT }}
      onClick={handleClick}
      className={cn(
        "relative z-[2] flex min-w-[64px] shrink-0 cursor-pointer flex-col items-center gap-0 px-2 pb-1.5 pt-1.5 snap-start md:min-w-[72px] rounded-[14px] transition-colors",
        isActive ? "bg-black/15 border border-white/20" : "border border-transparent"
      )}
    >
      <div className="relative z-10 flex h-9 w-9 items-center justify-center md:h-11 md:w-11">
        {typeof IconComponent === "function" || (typeof IconComponent === "object" && IconComponent?.$$typeof) ? (
          <IconComponent
            sx={{
              fontSize: { xs: 20, md: 24 },
              color: "#ffffff",
              opacity: isActive ? 1 : 0.92,
              transition: "opacity 0.2s, transform 0.2s",
            }}
          />
        ) : (
          <img
            src={IconComponent}
            alt={cat.name}
            className="h-4 w-4 object-contain md:h-5 md:w-5"
            style={{ opacity: isActive ? 1 : 0.92 }}
          />
        )}
      </div>

      <div className="relative mt-0.5 w-full flex justify-center">
        <span
          className={cn(
            "relative z-10 block px-0.5 text-center text-[10px] md:text-[11px] whitespace-nowrap tracking-wide",
            isActive ? "font-extrabold" : "font-medium",
          )}
          style={{ color: "#ffffff", opacity: isActive ? 1 : 0.85 }}
        >
          {cat.name}
        </span>
      </div>

    </motion.div>
  );
});

// ─── Typing placeholder hook ──────────────────────────────────────────────────

function useTypingPlaceholder() {
  const [placeholder, setPlaceholder] = useState(STATIC_TEXT);
  const stateRef = useRef({ textIndex: 0, charIndex: 0, isDeleting: false, isPaused: false });

  useEffect(() => {
    let timeoutId;

    const tick = () => {
      const s = stateRef.current;
      const phrase = TYPING_PHRASES[s.textIndex];

      if (s.isPaused) {
        s.isPaused = false;
        s.isDeleting = true;
        timeoutId = setTimeout(tick, 2000);
        return;
      }

      if (!s.isDeleting) {
        if (s.charIndex < phrase.length) {
          s.charIndex += 1;
          setPlaceholder(STATIC_TEXT + phrase.substring(0, s.charIndex));
          timeoutId = setTimeout(tick, 100);
        } else {
          s.isPaused = true;
          timeoutId = setTimeout(tick, 0);
        }
      } else {
        if (s.charIndex > 0) {
          s.charIndex -= 1;
          setPlaceholder(STATIC_TEXT + phrase.substring(0, s.charIndex));
          timeoutId = setTimeout(tick, 50);
        } else {
          s.isDeleting = false;
          s.textIndex = (s.textIndex + 1) % TYPING_PHRASES.length;
          timeoutId = setTimeout(tick, 100);
        }
      }
    };

    timeoutId = setTimeout(tick, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  return placeholder;
}

// ─── CSS-variable side-effect hook ───────────────────────────────────────────

function useMiniCartColor(baseHeaderColor) {
  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor || "#1e293b");
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => document.documentElement.style.removeProperty("--customer-mini-cart-color");
  }, [baseHeaderColor]);
}

// ─── MainLocationHeader ───────────────────────────────────────────────────────

const MainLocationHeader = ({
  categories: externalCategories = [],
  activeCategory,
  onCategorySelect,
  embedded = false,
  embeddedHeaderColor = null,
  showTopContent = true,
  showSearchBar = true,
  showCategories = true,
}) => {
  const { scrollY } = useScroll();
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const { currentLocation, refreshLocation, isFetchingLocation } = useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { cartCount } = useCart();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  // Stable derived values
  const appName = settings?.appName || "DukaanWallah";
  const logoUrl = settings?.logoUrl || LogoImage;

  // Memoize route paths — only recalculate when pathname changes
  const cartPath = useMemo(() => getQuickCartPath(routerLocation.pathname), [routerLocation.pathname]);
  const homePath = useMemo(() => getQuickHomePath(routerLocation.pathname), [routerLocation.pathname]);
  const searchPath = useMemo(() => getQuickSearchPath(routerLocation.pathname), [routerLocation.pathname]);
  const wishlistPath = useMemo(() => getQuickWishlistPath(), []);

  const [internalCategories, setInternalCategories] = useState([]);

  useEffect(() => {
    if (!showCategories || externalCategories.length > 0) return;
    let cancelled = false;
    customerApi.getCategories().then((res) => {
      if (cancelled || !res.data.success) return;
      const dbCats = res.data.results || res.data.result || [];
      setInternalCategories(
        dbCats
          .filter((cat) => cat.type === "header")
          .map((cat) => ({
            ...cat,
            id: cat._id,
            icon: resolveCategoryIconComponent(cat.iconId, Sparkles),
          })),
      );
    });
    return () => { cancelled = true; };
  }, [showCategories, externalCategories.length]);

  // Filter once, memoized
  const categories = useMemo(() => {
    const source = externalCategories.length > 0 ? externalCategories : internalCategories;
    return source.filter((cat) => !SERVICE_TAB_NAMES.has(cat.name?.toLowerCase()));
  }, [externalCategories, internalCategories]);

  // Stable handlers
  const handleSearchClick = useCallback(() => navigate(searchPath), [navigate, searchPath]);
  const openLocationDrawer = useCallback(() => setIsLocationOpen(true), []);
  const closeLocationDrawer = useCallback(() => setIsLocationOpen(false), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const open = () => setIsLocationOpen(true);
    window.addEventListener("quickOpenLocationDrawer", open);
    return () => window.removeEventListener("quickOpenLocationDrawer", open);
  }, []);
  const goHome = useCallback(() => navigate(homePath), [navigate, homePath]);
  const goWishlist = useCallback(() => navigate(wishlistPath), [navigate, wishlistPath]);
  const goCart = useCallback(() => navigate(cartPath), [navigate, cartPath]);

  // Typing placeholder
  const searchPlaceholder = useTypingPlaceholder();

  // Framer Motion scroll transforms
  const rawHeaderTopPadding = useTransform(scrollY, [0, 160], [16, 12]);
  const rawHeaderBottomPadding = useTransform(scrollY, [0, 160], [4, 3]);
  const rawHeaderRoundness = useTransform(scrollY, [0, 160], [0, 24]);
  const rawBgOpacity = useTransform(scrollY, [0, 160], [1, 0.98]);
  const rawContentHeight = useTransform(scrollY, [0, 160], ["64px", "0px"]);
  const rawContentOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const rawNavHeight = useTransform(scrollY, [0, 200], ["60px", "56px"]);
  const rawNavOpacity = useTransform(scrollY, [0, 200], [1, 1]);
  const rawNavMargin = useTransform(scrollY, [0, 200], [4, 2]);
  const rawCategorySpacing = useTransform(scrollY, [0, 200], [3, 1]);
  const rawCartOpacity = useTransform(scrollY, [0, 110, 150], [1, 0.7, 0]);
  const rawCartScale = useTransform(scrollY, [0, 110, 150], [1, 0.9, 0.75]);
  const rawDisplayContent = useTransform(scrollY, (v) => (v > 160 ? "none" : "block"));
  const rawDisplayNav = useTransform(scrollY, () => "flex");
  const rawDisplayCart = useTransform(scrollY, (v) => (v > 150 ? "none" : "block"));

  // In embedded mode, bypass scroll animations entirely
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

  // Memoize derived color values
  const baseHeaderColor = "#f97316"; // Orange-500 for Instamart theme

  const headerGradient = useMemo(() => {
    if (!baseHeaderColor) return "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)";
    return embedded
      ? "none"
      : buildHeaderGradient(baseHeaderColor);
  }, [baseHeaderColor, embedded]);

  useMiniCartColor(baseHeaderColor);

  // Stable category accent (constant string, no need for memo)
  const categoryAccent = "#ffffff";

  return (
    <>
      <div
        className={cn(
          embedded ? "sticky top-0 z-40" : "fixed top-0 left-0 right-0 z-200",
          isProductDetailOpen && "hidden md:block",
        )}
      >
        <motion.div
          initial={embedded ? { y: 0, opacity: 1 } : { y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={embedded ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
            backgroundImage: headerGradient,
            backgroundColor: embedded ? baseHeaderColor : undefined,
          }}
          className={cn(
            "px-4 transition-colors duration-300",
            embedded
              ? "border-b border-black/5 shadow-[0_10px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl"
              : "sticky top-0 shadow-[0_4px_20px_rgba(0,0,0,0.15)]",
          )}
        >
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

          {/* Desktop/Tablet Header Layout */}
          {!embedded && (showTopContent || showSearchBar) && (
            <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
              {/* Left: Logo + Location */}
              <div className="flex items-center gap-4 lg:gap-8">
                <div onClick={goHome} className="flex items-center gap-3 cursor-pointer group shrink-0">
                  <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                    <img src={logoUrl} alt={`${appName} Logo`} className="h-10 w-auto object-contain" />
                  </div>
                </div>

                <div className="flex flex-col border-l border-black/10 pl-4 lg:pl-8 h-10 justify-center">
                  <div className="flex items-center gap-1.5 opacity-70">
                    <AccessTimeIcon sx={{ fontSize: 13, color: "#111827" }} />
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none">
                      {currentLocation.time}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-lenis-prevent
                    data-lenis-prevent-touch
                    onClick={openLocationDrawer}
                    className="flex items-center gap-1 text-slate-900 hover:text-slate-700 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left"
                  >
                    <LocationOnIcon sx={{ fontSize: 14, color: "inherit" }} />
                    <div className="text-[13px] font-bold leading-tight max-w-[250px] lg:max-w-[320px] truncate">
                      {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                    </div>
                    <ChevronDownIcon sx={{ fontSize: 12, opacity: 0.5, color: "#111827" }} />
                  </button>
                </div>
              </div>

              {/* Center: Navigation Links (Web Only) */}
              <div className="flex-1 flex items-center justify-center gap-4 lg:gap-8 hidden md:flex px-4">
                {[
                  { name: "Delivery", path: "/food/user", active: false },
                  { name: "Quick", path: "/quick", active: routerLocation.pathname.startsWith("/quick") && !routerLocation.pathname.includes("/categories") && !routerLocation.pathname.includes("/orders") },
                  { name: "Category", path: getQuickCategoriesPath(), active: routerLocation.pathname.includes("/categories") },
                  { name: "Order", path: getQuickOrdersPath(), active: routerLocation.pathname.includes("/orders") },
                  { name: "Profile", path: "/profile", active: routerLocation.pathname === "/profile" }
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "text-[12px] lg:text-[14px] font-extrabold tracking-wide relative py-1 lg:py-2 transition-colors uppercase",
                      item.active ? "text-[#FF0000]" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {item.name}
                    {item.active && (
                      <motion.div
                        layoutId="activeQuickNavTab"
                        className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#FF0000] rounded-full"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Right: Action Icons & Cart Animation */}
              <div className="flex items-center gap-5 lg:gap-6 shrink-0">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
                  style={{ opacity: cartOpacity, scale: cartScale, display: displayCart }}
                  type="button"
                  aria-label="Open cart"
                  onClick={goCart}
                  className="group relative h-12 w-12 shrink-0 rounded-2xl border border-white/55 bg-white/28 shadow-[0_16px_35px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all duration-300 hover:bg-white/42 hover:shadow-[0_18px_40px_rgba(15,23,42,0.2)] mr-2 hidden lg:block"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-black/5 pointer-events-none" />
                  <div className="absolute inset-x-2 top-1 h-px bg-white/70 pointer-events-none" />
                  <Lottie
                    animationData={shoppingCartAnimation}
                    loop
                    className="pointer-events-none absolute inset-0 scale-[1.18] drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition-transform duration-300 group-hover:scale-[1.25]"
                  />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={goWishlist}
                  className="text-slate-900 hover:text-red-500 transition-all"
                >
                  <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.15, rotate: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={goCart}
                  className="text-slate-900 hover:text-slate-700 transition-all relative group"
                >
                  <ShoppingCartOutlinedIcon sx={{ fontSize: 24 }} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#FF0000] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-red-800 shadow-sm transition-transform group-hover:-translate-y-0.5">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </motion.button>

                <div className="flex items-center">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}

          {/* Mobile: Collapsible Delivery Info */}
          {!embedded && showTopContent && (
            <div className="md:hidden">
              <motion.div
                style={{
                  height: contentHeight,
                  opacity: contentOpacity,
                  marginBottom: navMargin,
                  display: displayContent,
                  overflow: "hidden",
                }}
                className="relative z-10"
              >
                <div className="mb-1">
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/18 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-900 backdrop-blur-sm">
                    {appName}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AccessTimeIcon sx={{ fontSize: 16, color: "#111827" }} />
                      <span className="text-base font-bold text-slate-900 tracking-tight leading-none">
                        {currentLocation.time}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-lenis-prevent
                      data-lenis-prevent-touch
                      onClick={openLocationDrawer}
                      className="flex items-center gap-1 text-slate-800 cursor-pointer group active:scale-95 transition-transform border-0 bg-transparent p-0 text-left"
                    >
                      <LocationOnIcon sx={{ fontSize: 14, color: "#111827" }} />
                      <div className="text-[10px] font-medium leading-tight max-w-[280px] truncate">
                        {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                      </div>
                      <ChevronDownIcon sx={{ fontSize: 12, opacity: 0.5, color: "#111827" }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Categories + Search */}
          {showCategories && categories.length > 0 && (
            <div className="relative z-10 space-y-1 pt-0">
              <div className="px-4 md:px-0 md:max-w-2xl md:mx-auto py-2">
                <motion.div
                  onClick={handleSearchClick}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-[12px] md:rounded-full px-4 h-[44px] shadow-md flex items-center bg-white border border-gray-100 cursor-pointer"
                >
                  <SearchIcon sx={{ color: "#FF0000", fontSize: 22 }} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search Products..."}
                    readOnly
                    className="flex-1 bg-transparent border-none outline-none pl-3 text-slate-800 font-bold placeholder:text-slate-300 text-[15px] cursor-pointer"
                  />
                  <div className="flex items-center gap-2 border-l border-red-100 pl-3">
                    <MicIcon sx={{ color: "#FF0000", fontSize: 20 }} />
                  </div>
                </motion.div>
              </div>

              <motion.div
                layout
                transition={{ layout: SPRING_NAV }}
                style={{
                  height: navHeight,
                  opacity: navOpacity,
                  marginTop: categorySpacing,
                  display: displayNav,
                  overflowY: "hidden",
                }}
                className={cn(
                  "relative flex items-end md:justify-center gap-1 overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-0 z-10 snap-x min-h-[64px] md:min-h-[72px] pb-1",
                  embedded ? "pt-1" : "pt-2",
                )}
              >
                {categories.map((cat) => (
                  <CategoryNavColumn
                    key={cat.id}
                    cat={cat}
                    isActive={activeCategory?.id === cat.id}
                    categoryAccent={categoryAccent}
                    onCategorySelect={onCategorySelect}
                  />
                ))}
              </motion.div>
            </div>
          )}

          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer isOpen={isLocationOpen} onClose={closeLocationDrawer} />
    </>
  );
};

export default MainLocationHeader;
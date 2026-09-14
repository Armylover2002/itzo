import { useState, useEffect, useRef, useLayoutEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LayoutGrid, Wallet } from 'lucide-react';
import { 
  buildHeaderGradient, 
  buildMiniCartColor, 
  buildSearchBarBackgroundColor 
} from '../utils/headerTheme';
import { getQuickCartPath, getQuickHomePath, getQuickSearchPath, getQuickWalletPath, getQuickWishlistPath } from '../utils/routes';
import { resolveQuickImageUrl } from '../utils/image';
import logo from '../assets/Logo.png';
import { useCart } from '../context/CartContext';

// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

/** Full-width bottom stroke + tab curve; l/r are 0–100% of column where the inner bump sits. */
function buildActiveTabPath(l, r) {
  const y = 20;
  const mapX = (x) => l + ((x - 1.5) / (98.5 - 1.5)) * (r - l);
  return `M 0 ${y} L ${l} ${y} L ${l} 12 C ${mapX(2.6)} 7 ${mapX(8.2)} 1.55 ${mapX(15)} 1.55 L ${mapX(85)} 1.55 C ${mapX(91.8)} 1.55 ${mapX(97.4)} 7 ${mapX(98.5)} 12 V ${y} L 100 ${y}`;
}

const CategoryNavColumn = memo(function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
}) {
  const colRef = useRef(null);
  const labelRef = useRef(null);
  const [lr, setLr] = useState({ l: 22, r: 78 });
  const [imgBroken, setImgBroken] = useState(false);
  const imageSrc = resolveQuickImageUrl(cat.image);

  const measure = () => {
    if (!isActive || !colRef.current || !labelRef.current) return;
    const col = colRef.current.getBoundingClientRect();
    const lab = labelRef.current.getBoundingClientRect();
    if (col.width < 4) return;
    const pad = 5;
    const l = Math.max(0, ((lab.left - col.left - pad) / col.width) * 100);
    const r = Math.min(100, ((lab.right - col.left + pad) / col.width) * 100);
    if (r - l > 6) setLr({ l, r });
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isActive, cat.name]);

  const pathD = isActive ? buildActiveTabPath(lr.l, lr.r) : "";

  return (
    <motion.div
      ref={colRef}
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: 'spring', stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className={cn(
        "relative z-[2] flex min-w-[48px] shrink-0 cursor-pointer flex-col items-center gap-0.5 border-b-2 px-2 pb-0.5 pt-0.5 snap-start md:min-w-[58px] transition-all duration-300",
        isActive ? "border-white" : "border-transparent"
      )}
    >
      <div className="relative z-10 flex h-9 w-9 items-center justify-center md:h-11 md:w-11">
        {cat.id === 'all' || cat._id === 'all' ? (
          <LayoutGrid 
            className={cn("h-5 w-5 md:h-6 md:w-6 transition-colors", isActive ? "text-white scale-110" : "text-white/40")} 
          />
        ) : imageSrc && !imgBroken ? (
          <img
            src={imageSrc}
            alt={cat.name}
            className={cn("h-5 w-5 object-contain md:h-6 md:w-6 transition-all", isActive ? "opacity-100 scale-110 brightness-200" : "opacity-50 brightness-0 invert")}
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-black uppercase text-white/60 md:h-6 md:w-6 md:text-[11px]">
            {(cat.name || '?').charAt(0)}
          </div>
        )}
      </div>
      <div className="relative mt-px w-full">
        <span
          ref={labelRef}
          className={cn(
            "relative z-10 mx-auto block max-w-[72px] truncate px-1 pb-0.5 text-center text-[8px] uppercase tracking-tight md:max-w-[88px] md:text-[10px] transition-all",
            isActive ? "font-black text-white" : "font-semibold text-white/50",
          )}
        >
          {cat.name}
        </span>
      </div>
      {isActive && (
        <motion.div
          layoutId="active-nav-glow"
          className="absolute inset-0 bg-white/5 rounded-xl -z-10 blur-md"
        />
      )}
    </motion.div>
  );
});

export default function QuickHeader({ showSearch = true, activeCategory = null, categories = [], onCategorySelect, isEmbedded = false, isInline = false }) {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { scrollY } = useScroll();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Search Logic
  const handleSearchClick = useCallback(() => {
    navigate(getQuickSearchPath(pathname));
  }, [navigate, pathname]);

  const handleVoiceSearch = useCallback((e) => {
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
        navigate(getQuickSearchPath(pathname), { state: { query: transcript } });
      }
    };
    recognition.start();
  }, [navigate, pathname]);

  // Search placeholder animation — ref-based to avoid re-rendering the whole header
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [isListening, setIsListening] = useState(false);
  const typingRef = useRef({ textIndex: 0, charIndex: 0, isDeleting: false, isPaused: false });



  useEffect(() => {
    const staticText = "Search ";
    const typingPhrases = ['"milk"', '"bread"', '"chips"', '"eggs"', '"chocolate"'];

    const tick = () => {
      const state = typingRef.current;
      const currentPhrase = typingPhrases[state.textIndex];

      if (state.isPaused) {
        state.isPaused = false;
        state.isDeleting = true;
        timerId = setTimeout(tick, 2000);
        return;
      }

      if (!state.isDeleting) {
        if (state.charIndex < currentPhrase.length) {
          state.charIndex += 1;
          setSearchPlaceholder(staticText + currentPhrase.substring(0, state.charIndex));
          timerId = setTimeout(tick, 100);
        } else {
          state.isPaused = true;
          timerId = setTimeout(tick, 0);
        }
      } else {
        if (state.charIndex > 0) {
          state.charIndex -= 1;
          setSearchPlaceholder(staticText + currentPhrase.substring(0, state.charIndex));
          timerId = setTimeout(tick, 50);
        } else {
          state.isDeleting = false;
          state.textIndex = (state.textIndex + 1) % typingPhrases.length;
          timerId = setTimeout(tick, 100);
        }
      }
    };

    let timerId = setTimeout(tick, 1500);
    return () => clearTimeout(timerId);
  }, []);

  // Smooth scroll interpolations
  const headerTopPadding = useTransform(scrollY, [0, 160], [16, 12]);
  const headerBottomPadding = useTransform(scrollY, [0, 160], [4, 3]);
  const headerRoundness = useTransform(scrollY, [0, 160], [0, 24]);
  const bgOpacity = useTransform(scrollY, [0, 160], [1, 0.98]);

  // Content animations
  const contentHeight = useTransform(scrollY, [0, 160], ["64px", "0px"]);
  const contentOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const navHeight = useTransform(scrollY, [0, 200], ["60px", "0px"]);
  const navOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const navMargin = useTransform(scrollY, [0, 200], [4, 0]);
  const categorySpacing = useTransform(scrollY, [0, 200], [3, 0]);

  const displayContent = useTransform(scrollY, (value) => value > 160 ? "none" : "block");
  const displayNav = useTransform(scrollY, (value) => value > 200 ? "none" : "flex");

  const baseHeaderColor = "#FF0000";
  const headerGradient = buildHeaderGradient(baseHeaderColor);
  const searchBarBg = buildSearchBarBackgroundColor(baseHeaderColor);
  const categoryAccent = "#ffffff";

  if (isEmbedded) {
    return (
      <div className="relative z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 px-2 pt-0 pb-0.5">
        <motion.div
            layout
            className="relative flex items-end md:justify-center gap-0 overflow-x-auto no-scrollbar snap-x min-h-[60px] md:min-h-[76px] pb-0.5">
            {categories.slice(0, 10).map((cat) => {
              const isActive = (activeCategory?._id || activeCategory?.id) === (cat._id || cat.id);
              return (
                <CategoryNavColumn
                  key={cat._id || cat.id}
                  cat={cat}
                  isActive={isActive}
                  categoryAccent="#ffffff"
                  onCategorySelect={onCategorySelect}
                />
              );
            })}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("left-0 right-0 z-50", isInline ? "relative" : "fixed top-0")}>
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
        className="px-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300">
        
        {/* Subtle Glow Overlay */}
        <div className="absolute inset-0 bg-white/8 pointer-events-none" />

        {/* Desktop/Tablet Header Layout (md and above) */}
        <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
          {/* Left Section: Logo + Location row */}
          <div className="flex items-center gap-4 lg:gap-8">
            <div
              onClick={() => navigate(getQuickHomePath(pathname))}
              className="flex items-center gap-3 cursor-pointer group shrink-0">
              <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                <img
                  src={logo}
                  alt="Logo"
                  className="h-10 w-auto object-contain brightness-0 invert"
                />
              </div>
            </div>

            {/* Location Block (Desktop inline row) */}
            <div className="flex flex-col border-l border-white/20 pl-4 lg:pl-8 h-10 justify-center">
              <div className="flex items-center gap-1.5 opacity-70">
                <AccessTimeIcon sx={{ fontSize: 13, color: "#ffffff" }} />
                <span className="text-[11px] font-black text-white uppercase tracking-widest leading-none">
                  Delivery in 10 mins
                </span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 text-white hover:text-white/80 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                <LocationOnIcon sx={{ fontSize: 14, color: "inherit" }} />
                <div className="text-[13px] font-bold leading-tight max-w-[250px] lg:max-w-[320px] truncate">
                  Home - Gurgaon, Haryana
                </div>
                <ChevronDownIcon
                  sx={{ fontSize: 12, opacity: 0.5, color: "#ffffff" }}
                />
              </button>
            </div>
          </div>

          {/* Center Section: Search Bar */}
          <div className="flex-1 max-w-[450px] lg:max-w-2xl px-6">
            <motion.div
              onClick={handleSearchClick}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{ backgroundColor: searchBarBg }}
              className="rounded-full px-4 h-11 shadow-md flex items-center border border-white/50 transition-all duration-200 focus-within:ring-2 focus-within:ring-white/60 cursor-pointer backdrop-blur-md">
              <SearchIcon sx={{ color: "#ffffff", fontSize: 20 }} />
              <div className="flex-1 pl-2 text-white font-semibold flex items-center">
                   <span className="opacity-60 text-[15px]">{searchPlaceholder}</span>
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={cn(
                    "p-1.5 rounded-full transition-all",
                    isListening ? "bg-white text-[#0c831f] scale-110 animate-pulse" : "text-white hover:bg-white/10"
                  )}
                >
                  <MicIcon sx={{ color: "inherit", fontSize: 20 }} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Section: Action Icons */}
          <div className="flex items-center gap-5 lg:gap-8 shrink-0">
            <motion.button
              whileHover={{ scale: 1.15, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(getQuickWishlistPath(pathname))}
              className="text-white hover:text-white/80 transition-all">
              <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.15, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(getQuickCartPath(pathname))}
              className="flex items-center gap-2 rounded-2xl bg-[#f8cb46] px-4 py-2.5 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-transform hover:scale-105 active:scale-95"
            >
              <div className="relative">
                <ShoppingCartOutlinedIcon sx={{ fontSize: 20 }} />
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {cartCount}
                </span>
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black uppercase tracking-tight">View Cart</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(getQuickWalletPath())}
              className="text-white lg:bg-white/10 p-1.5 lg:rounded-full hover:bg-white/20 transition-all transform backdrop-blur-sm"
              aria-label="Open wallet">
              <Wallet className="h-7 w-7" />
            </motion.button>
          </div>
        </div>

        {/* Collapsible Delivery Info & Location (MOBILE ONLY) */}
        <div className="md:hidden">
          <motion.div
            style={{
              height: contentHeight,
              opacity: contentOpacity,
              marginBottom: navMargin,
              display: displayContent,
              overflow: "hidden",
            }}
            className="relative z-10">
            <div className="mb-1">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white backdrop-blur-sm">
                Blinkit
              </span>
            </div>
            <div className="flex justify-between items-start gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <AccessTimeIcon sx={{ fontSize: 16, color: "#ffffff" }} />
                  <span className="text-base font-bold text-white tracking-tight leading-none">
                    10 mins
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-white/90 cursor-pointer group active:scale-95 transition-transform border-0 bg-transparent p-0 text-left">
                  <LocationOnIcon sx={{ fontSize: 14, color: "#ffffff" }} />
                  <div className="text-[10px] font-medium leading-tight max-w-[280px] truncate">
                    Home - Gurgaon, Haryana
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 12, opacity: 0.5, color: "#ffffff" }}
                  />
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate(getQuickWalletPath())}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-lg backdrop-blur-sm transition-all"
                aria-label="Open wallet"
              >
                <Wallet className="h-5 w-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Search Bar (MOBILE ONLY) */}
        <div className="relative z-10 mt-[1.5px] flex items-center gap-2 md:hidden">
          <motion.div
            onClick={handleSearchClick}
            whileTap={{ scale: 0.98 }}
            style={{ backgroundColor: searchBarBg }}
            className="flex-1 rounded-[10px] px-3 h-10 shadow-md flex items-center border border-white/50 transition-all duration-200 focus-within:ring-2 focus-within:ring-white/60 cursor-pointer backdrop-blur-md">
            <SearchIcon sx={{ color: "#ffffff", fontSize: 18 }} />
            <div className="flex-1 pl-2 text-white font-semibold">
                <span className="opacity-60 text-[14px]">{searchPlaceholder}</span>
            </div>
            <div className="flex items-center gap-2 border-l border-white/10 pl-2.5">
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={cn(
                  "p-1 rounded-full transition-all",
                  isListening ? "bg-white text-[#0c831f] scale-110 animate-pulse" : "text-white hover:bg-white/10"
                )}
              >
                <MicIcon sx={{ color: "inherit", fontSize: 18 }} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Categories Navigation - Smooth Collapse */}
        {categories.length > 0 && (
          <motion.div
            layout
            transition={{
              layout: {
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.6,
              },
            }}
            style={{
              height: navHeight,
              opacity: navOpacity,
              marginTop: categorySpacing,
              display: displayNav,
              overflowY: "hidden",
            }}
            className="relative flex items-end md:justify-center gap-0 overflow-x-auto no-scrollbar -mx-2 px-2 md:mx-0 md:px-0 z-10 snap-x pt-1 min-h-[60px] md:min-h-[76px] pb-0.5">
            {categories.slice(0, 10).map((cat) => {
              const isActive = (activeCategory?._id || activeCategory?.id) === (cat._id || cat.id);
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
        )}

        {/* Background Decorative patterns */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
      </motion.div>
    </div>
  );
}

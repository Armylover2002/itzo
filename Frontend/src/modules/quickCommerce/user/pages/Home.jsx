import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Star,
  ChevronDown,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Heart,
  Snowflake,
  Dog,
} from "lucide-react";

// Import static constants
import { CATEGORY_METADATA, ALL_CATEGORY } from "../constants/homeData";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ArrowRightIcon from "@mui/icons-material/ArrowForwardIos";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VerifiedIcon from "@mui/icons-material/Verified";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import SavingsIcon from "@mui/icons-material/Savings";

import { getIconSvg } from "@/shared/constants/categoryIcons";
import { motion, useScroll, useTransform } from "framer-motion";
import { customerApi } from "../services/customerApi";
import { toast } from "sonner";
import ProductCard from "../components/shared/ProductCard";
import MainLocationHeader from "../components/shared/MainLocationHeader";
import MiniCart from "../components/shared/MiniCart";
import ProductDetailSheet from "../components/shared/ProductDetailSheet";
import Footer from "../components/layout/Footer";
import BottomNav from "../components/layout/BottomNav";
import MobileFooterMessage from "../components/layout/MobileFooterMessage";
import { useProductDetail } from "../context/ProductDetailContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@food/components/ui/skeleton";
import QuickCategorySlider from "../components/home/QuickCategorySlider";
import QuickProductShelf from "../components/home/QuickProductShelf";
import LowestPriceEverSection from "../components/home/LowestPriceEverSection";
import { useLocation } from "../context/LocationContext";
import { resolveQuickImageUrl } from "../utils/image";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { useQuickHomeData } from "../hooks/useQuickHomeData";
import {
  getQuickCartPath,
  getQuickCategoriesPath,
  getQuickCategoryPath,
} from "../utils/routes";


const MARQUEE_MESSAGES = [
  "24/7 Delivery",
  "Minimum Order ₹99",
  "Save Big on Essentials!",
];

const QUICK_THEME_STORAGE_KEY = "food.quick.headerColor";
const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";

const quickCategoryPalettes = [
  { bgFrom: "#ffd96a", bgVia: "#ffeaa0", bgTo: "#fff0c7", glowColor: "rgba(255,184,0,0.18)", frameColor: "#f0d98a" },
  { bgFrom: "#9fe88c", bgVia: "#c3f1b2", bgTo: "#e4f8da", glowColor: "rgba(126,220,141,0.18)", frameColor: "#bfe3b7" },
  { bgFrom: "#f3a25d", bgVia: "#f9c48b", bgTo: "#fee0bf", glowColor: "rgba(255,139,61,0.16)", frameColor: "#efc08e" },
  { bgFrom: "#b8eff0", bgVia: "#d5f7f5", bgTo: "#edfdfc", glowColor: "rgba(122,215,215,0.16)", frameColor: "#b9e5e3" },
];

const getQuickCategoryImage = (category = {}) => {
  const candidate =
    category?.image ||
    category?.icon ||
    category?.thumbnail ||
    category?.imageUrl ||
    category?.iconUrl ||
    category?.media?.image ||
    category?.media?.url ||
    "";

  return (
    resolveQuickImageUrl(candidate) ||
    "https://cdn-icons-png.flaticon.com/128/2321/2321831.png"
  );
};

function QuickHomeLoadingState({ embedded }) {
  return (
    <div className={cn("pb-8", embedded ? "pt-0" : "pt-4 md:pt-6")}>
      <div className="block md:hidden">
        <Skeleton className="h-[190px] w-full rounded-none" />
      </div>

      <div className="px-4 py-4 md:px-8 lg:px-[50px]">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`quick-skel-top-${index}`}
              className="flex min-w-[84px] flex-col items-center gap-2 md:min-w-[112px]">
              <Skeleton className="h-[96px] w-[84px] rounded-[22px] md:h-[126px] md:w-[112px]" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 md:px-8 lg:px-[50px]">
        <div className="rounded-[28px] border border-[#FE5502]/10 bg-white/80 dark:bg-card/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-8 w-52 rounded-full" />
            </div>
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>

          <div className="flex gap-3 overflow-hidden md:gap-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`quick-skel-card-${index}`} className="w-[140px] shrink-0 space-y-3">
                <Skeleton className="h-[132px] w-full rounded-[20px]" />
                <Skeleton className="h-3 w-5/6 rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Home = ({ embedded = false, onThemeChange, embeddedHeaderColor = null }) => {
  const { scrollY } = useScroll();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useLocation();
  const navigate = useNavigate();
  const routePathname = typeof window !== "undefined" ? window.location.pathname : "";
  const quickCatsRef = useRef(null);

  // --- Core Data Hook (Optimized & Cached) ---
  const {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    banners,
    categoryProducts,
    quickCategories,
    categoryMap,
    subcategoryMap,
    isLoading,
    isBootstrapped
  } = useQuickHomeData({ currentLocation });

  const [mobileBannerIndex, setMobileBannerIndex] = useState(0);

  // Active banners filtered by current header category tab
  const activeBanners = useMemo(() => {
    if (!Array.isArray(banners) || banners.length === 0) return [];

    // When "All Categories" is active (or header is "all"), return all eligible banners
    if (!activeCategory || activeCategory._id === "all" || activeCategory.id === "all") {
      return banners;
    }

    const currentHeaderId = String(activeCategory._id || activeCategory.id);
    return banners.filter((b) => {
      if (b.targetCategoryType === "all" || !b.headerCategoryIds?.length) return true;
      return b.headerCategoryIds.some(
        (cat) => String(cat?._id || cat?.id || cat) === currentHeaderId
      );
    });
  }, [banners, activeCategory]);

  useLayoutEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [embedded, routePathname]);

  const scrollQuickCats = (direction) => {
    if (quickCatsRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      quickCatsRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (typeof onThemeChange !== "function") return;
    const resolvedColor = activeCategory?.headerColor || ALL_CATEGORY.headerColor;
    if (typeof window !== "undefined" && resolvedColor) {
      window.sessionStorage.setItem(QUICK_THEME_STORAGE_KEY, resolvedColor);
    }
    onThemeChange({
      name: activeCategory?.name || ALL_CATEGORY.name,
      color: resolvedColor,
    });
  }, [activeCategory, onThemeChange]);

  const isInitialPageLoading = !isBootstrapped;

  // Reset banner index on category change
  useEffect(() => {
    setMobileBannerIndex(0);
  }, [activeCategory, activeBanners.length]);

  // Autoplay for Promotional Banner Carousel
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const intervalId = setInterval(() => {
      setMobileBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 4000);
    return () => clearInterval(intervalId);
  }, [activeBanners.length]);

  const handleBannerClick = (banner) => {
    if (!banner) return;
    const catId = banner.headerCategoryIds?.[0]?._id || banner.headerCategoryIds?.[0];
    if (banner.targetCategoryType === "specific" && catId) {
      navigate(getQuickCategoryPath(catId));
    } else {
      navigate(getQuickCategoriesPath());
    }
  };

  const bestsellerCategories = useMemo(() => {
    const grouped = {};
    products.forEach((p) => {
      const catId = p.categoryId?._id || "other";
      const catName = p.categoryId?.name || "Other";
      if (!grouped[catId]) grouped[catId] = { id: catId, name: catName, images: [] };
      if (grouped[catId].images.length < 4) grouped[catId].images.push(p.image);
    });
    return Object.values(grouped).slice(0, 6);
  }, [products]);

  const productsById = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p._id || p.id] = p; });
    return map;
  }, [products]);

  const effectiveQuickCategories = quickCategories;

  // Filter products by active header category
  // Prefer server-fetched categoryProducts when a specific category is active
  const filteredProducts = useMemo(() => {
    const activeCatId = activeCategory?._id || activeCategory?.id;
    if (!activeCatId || activeCatId === "all") return products;

    // Use server-fetched category products if available
    if (categoryProducts !== null) return categoryProducts;

    // Fallback: client-side filter by categoryId parentId
    return products.filter((p) => {
      const productCatId = p.categoryId?._id || p.categoryId || p.category?._id || p.category;
      if (!productCatId) return false;
      const cat = categoryMap[String(productCatId)];
      if (!cat) return false;
      const parentHeaderId = cat.parentId || cat.headerId || cat.parent?._id || cat.header?._id;
      return String(parentHeaderId) === String(activeCatId) || String(productCatId) === String(activeCatId);
    });
  }, [products, categoryProducts, activeCategory, categoryMap]);

  const opacity = useTransform(scrollY, [0, 300], [1, 0.6]);
  const y = useTransform(scrollY, [0, 300], [0, 80]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, [0, 100], ["auto", "none"]);

  const renderFloatingElements = (type) => {
    const count = 10;
    const getParticleContent = (index) => {
      switch (type) {
        case "hearts": return <Heart fill="white" size={12 + (index % 5) * 2} className="drop-shadow-sm" />;
        case "snow": return <Snowflake fill="white" size={10 + (index % 4) * 3} className="drop-shadow-sm" />;
        case "stars":
        case "sparkles": return <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="drop-shadow-md"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>;
        default: return <div className="bg-white/40 rounded-full blur-[1px]" style={{ width: 4 + (index % 3) * 3, height: 4 + (index % 3) * 3 }} />;
      }
    };

    return [...Array(count)].map((_, i) => {
      const duration = 15 + Math.random() * 20;
      const delay = Math.random() * -20;
      const depth = 0.5 + Math.random() * 0.5;
      return (
        <motion.div
          key={i} className="absolute pointer-events-none"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.1 * depth, zIndex: Math.floor(depth * 10) }}
          animate={{ x: [0, 50, -50, 0], y: [0, -100, -50, 0], rotate: [0, 360], scale: [depth, depth * 1.2, depth] }}
          transition={{ duration: duration / depth, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <div className="transform-gpu">{getParticleContent(i)}</div>
        </motion.div>
      );
    });
  };

  return (
    <div
      className={cn(
        "bg-[#F5F7F8] dark:bg-background",
        embedded ? "min-h-0 bg-white dark:bg-card pt-0" : "min-h-screen pt-[176px] md:pt-[265px]",
      )}>
      {/* Top Dynamic Gradient Section */}
      <div
        className={cn("contents", isProductDetailOpen && "hidden md:contents")}>
        <MainLocationHeader
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={setActiveCategory}
          embedded={embedded}
          embeddedHeaderColor={embeddedHeaderColor}
          showTopContent={!embedded}
          showSearchBar={!embedded}
        />
      </div>

      {isInitialPageLoading ? (
        <QuickHomeLoadingState embedded={embedded} />
      ) : (
        <div className={cn("pt-0", embedded && "pt-0")}>
          {/* Dynamic Promotional Banner Carousel */}
          {activeBanners.length > 0 && (
            <div className={cn("block px-3 md:px-8 lg:px-[50px] mb-3 md:mb-5", embedded ? "-mt-[1px]" : "mt-2 md:mt-4")}>
              <div
                className="relative w-full overflow-hidden rounded-2xl md:rounded-[28px] shadow-sm border border-gray-100 dark:border-white/5"
                style={embedded ? { backgroundColor: activeCategory?.headerColor || ALL_CATEGORY.headerColor } : undefined}>
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{
                    transform: `translateX(-${mobileBannerIndex * 100}%)`,
                  }}>
                  {activeBanners.map((banner, bIdx) => (
                    <motion.div
                      key={banner._id || banner.id || bIdx}
                      onClick={() => handleBannerClick(banner)}
                      whileTap={{ scale: 0.98 }}
                      className="min-w-full cursor-pointer relative select-none">
                      <div className="w-full h-[150px] sm:h-[190px] md:h-[220px] lg:h-[260px] relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img
                          src={resolveQuickImageUrl(banner.image)}
                          alt={banner.title || "Promotional Banner"}
                          className="w-full h-full object-cover sm:object-fill"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        {(banner.title || banner.subtitle) && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-4 md:p-6 text-white pointer-events-none">
                            {banner.title && (
                              <h4 className="text-base sm:text-xl md:text-2xl font-black drop-shadow-md line-clamp-1">
                                {banner.title}
                              </h4>
                            )}
                            {banner.subtitle && (
                              <p className="text-xs sm:text-sm text-white/90 font-medium drop-shadow-sm line-clamp-1 mt-0.5">
                                {banner.subtitle}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Indicators / Dots */}
                {activeBanners.length > 1 && (
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/30 backdrop-blur-xs px-2.5 py-1 rounded-full pointer-events-auto">
                    {activeBanners.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileBannerIndex(dotIdx);
                        }}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                          mobileBannerIndex === dotIdx
                            ? "w-5 bg-white shadow-sm"
                            : "w-1.5 bg-white/50 hover:bg-white/80"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Promo Marquee Strip */}
          <div className={cn("w-full md:-mt-[2px] mb-4", embedded ? "-mt-[1px]" : "-mt-[2px]")}>
            <div
              className={cn(
                "relative overflow-hidden",
                embedded
                  ? "border-y-0 shadow-none"
                  : "border-y border-[#e6ddc4] bg-[#f7f0df] shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
              )}
              style={embedded ? { backgroundColor: activeCategory?.headerColor || ALL_CATEGORY.headerColor } : undefined}>
              <div
                className={cn(
                  "absolute inset-y-0 left-0 w-10 pointer-events-none",
                  embedded ? "bg-none" : "bg-gradient-to-r from-[#f7f0df] via-[#f7f0df]/90 to-transparent",
                )}
                style={embedded ? { backgroundImage: `linear-gradient(to right, ${activeCategory?.headerColor || ALL_CATEGORY.headerColor}, ${activeCategory?.headerColor || ALL_CATEGORY.headerColor}E6, transparent)` } : undefined}
              />
              <div
                className={cn(
                  "absolute inset-y-0 right-0 w-10 pointer-events-none",
                  embedded ? "bg-none" : "bg-gradient-to-l from-[#f7f0df] via-[#f7f0df]/90 to-transparent",
                )}
                style={embedded ? { backgroundImage: `linear-gradient(to left, ${activeCategory?.headerColor || ALL_CATEGORY.headerColor}, ${activeCategory?.headerColor || ALL_CATEGORY.headerColor}E6, transparent)` } : undefined}
              />
              <div
                className={cn(
                  "classic-marquee-track flex w-max items-center gap-4 px-3 md:px-6 py-4 text-sm md:text-base font-semibold -translate-y-[4px]",
                  embedded ? "text-white/90" : "text-[#4b463f]",
                )}>
                {[...MARQUEE_MESSAGES, ...MARQUEE_MESSAGES].map((message, idx) => (
                  <React.Fragment key={`${message}-${idx}`}>
                    <span className="whitespace-nowrap">{message}</span>
                    <span className="text-[#8a7f66]">•</span>
                  </React.Fragment>
                ))}
                <span className="whitespace-nowrap">❤️</span>
                <span className="whitespace-nowrap">🎁</span>
              </div>
            </div>
          </div>

          {/* 4. Quick Category Slider (Colorful horizontal list) */}
          <QuickCategorySlider categories={effectiveQuickCategories} activeCategory={activeCategory} embedded={embedded} />

          {/* New LOWEST PRICE EVER section */}
          <LowestPriceEverSection products={products} />

          {embedded && (
            <>
              <div className="hidden md:block">
                <Footer />
              </div>
              <div className="md:hidden">
                <MobileFooterMessage />
                <BottomNav />
              </div>
            </>
          )}

          {embedded && (
            <>
              <MiniCart
                linkTo={getQuickCartPath(routePathname)}
              />
              <ProductDetailSheet />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;

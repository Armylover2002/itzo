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
import QuickCategoryGrid from "../components/home/QuickCategoryGrid";
import QuickProductShelf from "../components/home/QuickProductShelf";
import CardBanner from "@/assets/CardBanner.jpg";
import SectionRenderer from "../components/experience/SectionRenderer";
import ExperienceBannerCarousel from "../components/experience/ExperienceBannerCarousel";
import { useLocation } from "../context/LocationContext";
import { resolveQuickImageUrl } from "../utils/image";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";
import { useQuickHomeData } from "../hooks/useQuickHomeData";
import {
  getSideImageByKey,
  getBackgroundColorByValue,
  getBackgroundGradientByValue,
} from "@/shared/constants/offerSectionOptions";
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
        <div className="rounded-[28px] border border-[#0c831f]/10 bg-white/80 dark:bg-card/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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
    categoryProducts,
    quickCategories,
    experienceSections,
    offerSections,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    isLoading,
    isBootstrapped
  } = useQuickHomeData({ currentLocation });

  const [mobileBannerIndex, setMobileBannerIndex] = useState(0);
  const [isInstantBannerJump, setIsInstantBannerJump] = useState(false);
  const [pendingReturn, setPendingReturn] = useState(null);

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
  const hasHeroBanners = (heroConfig.banners?.items || []).length > 0;
  const shouldShowHeroFallback = !isInitialPageLoading && !hasHeroBanners;


  // Autoplay for Mobile Banner Carousel
  useEffect(() => {
    const totalSlides = 3;
    const intervalId = setInterval(() => {
      setMobileBannerIndex((prev) => (prev >= totalSlides - 1 ? prev : prev + 1));
    }, 3500);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isInstantBannerJump) return;
    const id = requestAnimationFrame(() => setIsInstantBannerJump(false));
    return () => cancelAnimationFrame(id);
  }, [isInstantBannerJump]);

  const handleBannerTransitionEnd = () => {
    const totalSlides = 3;
    if (mobileBannerIndex === totalSlides - 1) {
      setIsInstantBannerJump(true);
      setMobileBannerIndex(0);
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

  const effectiveQuickCategories = useMemo(() => {
    const ids = heroConfig.categoryIds || [];
    if (ids.length > 0) {
      const resolved = ids.map((id) => categoryMap[id]).filter(Boolean).map((c) => ({
        id: c._id, name: c.name, image: getQuickCategoryImage(c),
      }));
      if (resolved.length > 0) return resolved;
    }
    return quickCategories;
  }, [heroConfig.categoryIds, categoryMap, quickCategories]);

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

  const sectionsForRenderer = headerSections.length ? headerSections : experienceSections;

  const opacity = useTransform(scrollY, [0, 300], [1, 0.6]);
  const y = useTransform(scrollY, [0, 300], [0, 80]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, [0, 100], ["auto", "none"]);

  useEffect(() => {
    if (!pendingReturn?.sectionId) return;
    const allSections = sectionsForRenderer;
    if (!allSections.length) return;
    if (!allSections.some((s) => s._id === pendingReturn.sectionId)) return;

    const el = document.getElementById(`section-${pendingReturn.sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "start" });
      window.sessionStorage.removeItem("experienceReturn");
      setPendingReturn(null);
    }
  }, [sectionsForRenderer, pendingReturn]);

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
        embedded ? "min-h-0 bg-white dark:bg-card pt-0" : "min-h-screen pt-[176px] md:pt-[210px]",
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
          {/* Hero Banners (mobile): admin-configured or static fallback */}
          <>
            <div className={cn("block md:hidden", embedded ? "-mt-[1px]" : "mt-0")}>
              <div>
                <div
                  className="relative w-full overflow-hidden"
                  style={embedded ? { backgroundColor: activeCategory?.headerColor || ALL_CATEGORY.headerColor } : undefined}>
                  {hasHeroBanners ? (
                    <ExperienceBannerCarousel
                      section={{ title: "" }}
                      items={heroConfig.banners.items}
                      fullWidth
                      edgeToEdge
                    />
                  ) : shouldShowHeroFallback ? (
                    <div
                      className={cn(
                        "flex",
                        !isInstantBannerJump &&
                        "transition-transform duration-500 ease-out",
                      )}
                      style={{
                        transform: `translateX(-${mobileBannerIndex * 100}%)`,
                      }}
                      onTransitionEnd={handleBannerTransitionEnd}>
                      <motion.div
                        onClick={() => navigate(getQuickCategoriesPath())}
                        whileTap={{ scale: 0.96 }}
                        className="min-w-full">
                        <div className="w-full h-[190px] bg-[#E6F5EC] p-6 relative overflow-hidden flex items-center border-y border-[#0c831f]/10 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                          <div className="relative z-10 w-3/5 flex flex-col items-start gap-2">
                            <div className="flex flex-col gap-0.5">
                              <h4 className="text-2xl font-[1000] text-[#1A1A1A] tracking-tighter leading-none">
                                Get <span className="text-[#0c831f]">Products</span>
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-sm font-black text-gray-700">
                                  at
                                </span>
                                <div className="bg-[#0c831f] text-white px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                  <VerifiedIcon sx={{ fontSize: 16 }} />
                                  <span className="text-xl font-[1000]">₹0</span>
                                </div>
                                <span className="text-sm font-[1000] text-gray-700">
                                  Fee
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] font-bold text-gray-500 max-w-[150px] leading-tight">
                              Get groceries delivered in minutes
                            </p>
                            <button className="bg-[#FF1E56] text-white px-6 py-2.5 rounded-2xl font-black text-xs tracking-wide shadow-lg shadow-rose-200 mt-2">
                              Order now
                            </button>
                          </div>
                          <div className="absolute right-[-10px] bottom-0 top-0 w-2/5 flex items-center justify-center">
                            <img
                              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400&fm=webp"
                              alt="Promo"
                              className="w-full h-full object-contain rotate-3 scale-110"
                            />
                          </div>
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#0c831f]/5 rounded-full blur-2xl -mt-12 -mr-12" />
                        </div>
                      </motion.div>
                      <motion.div
                        onClick={() => navigate("/categories")}
                        whileTap={{ scale: 0.96 }}
                        className="min-w-full">
                        <div className="w-full h-[190px] bg-white dark:bg-card relative overflow-hidden flex border-y border-gray-100 dark:border-white/5 shadow-[0_4px_15px_rgba(0,0,0,0.05)] group">
                          <img
                            src={CardBanner}
                            alt="Promotion"
                            className="w-full h-full object-fill"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent pointer-events-none" />
                        </div>
                      </motion.div>
                      <motion.div
                        onClick={() => navigate(getQuickCategoriesPath())}
                        whileTap={{ scale: 0.96 }}
                        className="min-w-full">
                        <div className="w-full h-[190px] bg-[#E6F5EC] p-6 relative overflow-hidden flex items-center border-y border-[#0c831f]/10 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
                          <div className="relative z-10 w-3/5 flex flex-col items-start gap-2">
                            <div className="flex flex-col gap-0.5">
                              <h4 className="text-2xl font-[1000] text-[#1A1A1A] tracking-tighter leading-none">
                                Get <span className="text-[#0c831f]">Products</span>
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-sm font-black text-gray-700">
                                  at
                                </span>
                                <div className="bg-[#0c831f] text-white px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                  <VerifiedIcon sx={{ fontSize: 16 }} />
                                  <span className="text-xl font-[1000]">₹0</span>
                                </div>
                                <span className="text-sm font-[1000] text-gray-700">
                                  Fee
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] font-bold text-gray-500 max-w-[150px] leading-tight">
                              Get groceries delivered in minutes
                            </p>
                            <button className="bg-[#FF1E56] text-white px-6 py-2.5 rounded-2xl font-black text-xs tracking-wide shadow-lg shadow-rose-200 mt-2">
                              Order now
                            </button>
                          </div>
                          <div className="absolute right-[-10px] bottom-0 top-0 w-2/5 flex items-center justify-center">
                            <img
                              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400&fm=webp"
                              alt="Promo"
                              className="w-full h-full object-contain rotate-3 scale-110"
                            />
                          </div>
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#0c831f]/5 rounded-full blur-2xl -mt-12 -mr-12" />
                        </div>
                      </motion.div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>

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

          {/* 4. Quick Category Grid (2x4 Zepto Style) */}
          <QuickCategoryGrid categories={categories} isLoading={isLoading} />

          {/* 5. Dynamic Product Shelves Grouped by Category */}
          {!isLoading && categories.filter(c => String(c.id || c._id) !== "all").slice(0, 6).map((cat, idx) => {
             // Filter products belonging to this category
             const shelfProducts = products.filter(p => {
               const pCatId = String(p.categoryId?._id || p.categoryId?.id || p.categoryId || "");
               return pCatId === String(cat._id || cat.id);
             });
             
             if (shelfProducts.length === 0) return null;
             
             return (
               <QuickProductShelf 
                 key={cat._id || cat.id || idx} 
                 category={cat} 
                 products={shelfProducts} 
               />
             );
          })}

          {/* Offer Sections (admin-configured: Trending, etc.) – show on Home so user sees them */}
          {offerSections.length > 0 && (
            <div className="w-full px-0 pt-0 pb-2 md:pb-4">
              {[...offerSections]
                .filter(section => {
                  if ((section.title || '').trim().toLowerCase() === 'best sellers') return false;
                  // If a specific category is active, only show sections that match it
                  const activeCatId = activeCategory?._id || activeCategory?.id;
                  if (!activeCatId || activeCatId === "all") return true;
                  const sectionCatIds = (section.categoryIds || []).map(c =>
                    typeof c === "object" ? String(c._id || c.id || "") : String(c)
                  );
                  if (sectionCatIds.length === 0) return true; // no category filter = show always
                  return sectionCatIds.some(id => {
                    if (id === String(activeCatId)) return true;
                    const cat = categoryMap[id];
                    const parentHeaderId = cat?.parentId || cat?.headerId || cat?.parent?._id || cat?.header?._id;
                    return String(parentHeaderId) === String(activeCatId);
                  });
                })
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((section, sIdx) => {
                  const bgColor = getBackgroundColorByValue(
                    section.backgroundColor,
                  );
                  const sectionProducts = (section.productIds || [])
                    .filter((p) => typeof p === "object" && p !== null)
                    .map((p) => ({
                      id: p._id,
                      _id: p._id,
                      name: p.name,
                      image: resolveQuickImageUrl(p.mainImage || p.image || ""),
                      price:
                        Number(p.salePrice || 0) > 0
                          ? Number(p.salePrice)
                          : Number(p.price || 0),
                      originalPrice: Number(
                        p.originalPrice || p.mrp || p.price || p.salePrice || 0,
                      ),
                      weight: p.weight,
                      deliveryTime: p.deliveryTime,
                    }));
                  return (
                    <motion.div
                      key={section._id || section.id || `sec-${sIdx}`}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ duration: 0.4 }}
                      className={cn(
                        "mb-4 rounded-none overflow-hidden shadow-[0_10px_25px_rgba(15,23,42,0.1)] border-y border-slate-100/70 border-x-0 md:border-x",
                        section.title?.toLowerCase().includes('masala') ? "bg-[#FFF9E7]" : "bg-white"
                      )}>
                      <div
                        className="relative flex items-center justify-between px-5 md:px-8 py-5 md:py-6 text-black dark:text-white"
                        style={{
                          backgroundColor: bgColor,
                          backgroundImage: getBackgroundGradientByValue(
                            section.backgroundColor,
                          ),
                        }}>
                        <div className="pointer-events-none absolute inset-0 overflow-hidden">
                          <div className="absolute -top-10 -left-10 w-40 h-40 md:w-56 md:h-56 bg-white/20 rounded-full blur-3xl" />
                          <div className="absolute -bottom-10 right-0 w-44 h-44 bg-white/10 rounded-full blur-3xl" />
                        </div>
                        <div className="flex-1 pr-4">
                          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] text-black/60 dark:text-white/60 mb-1">
                            Trending right now
                          </p>
                          <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-tight drop-shadow-sm">
                            {section.title}
                          </h3>
                          {((section.categoryIds || [])
                            .map((c) =>
                              typeof c === "object" && c?.name ? c.name : null,
                            )
                            .filter(Boolean)
                            .join(", ") ||
                            section.categoryId?.name) && (
                              <p className="text-xs md:text-sm font-semibold text-black/75 dark:text-white/75 mt-1">
                                {(section.categoryIds || [])
                                  .map((c) =>
                                    typeof c === "object" && c?.name ? c.name : null,
                                  )
                                  .filter(Boolean)
                                  .join(", ") || section.categoryId?.name}
                              </p>
                            )}
                        </div>
                        <motion.div
                          whileHover={{ y: -4, rotate: -4, scale: 1.06 }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 18,
                          }}
                          className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex-shrink-0 shadow-[0_16px_30px_rgba(0,0,0,0.25)] border border-black/10 overflow-hidden relative bg-black/10">
                          {/* Product-driven visual if available */}
                          {sectionProducts[0]?.image ? (
                            <>
                              <img
                                src={sectionProducts[0].image}
                                srcSet={getCloudinarySrcSet(sectionProducts[0].image)}
                                sizes="100px"
                                alt={section.title}
                                className="absolute inset-0 w-full h-full object-cover scale-110"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/20 to-transparent" />
                              <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-amber-400/60 blur-xl mix-blend-screen" />
                            </>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-red-500 to-rose-500" />
                          )}

                          {/* Top-left pill with items count */}
                          {sectionProducts.length > 0 && (
                            <div className="absolute top-1 left-1 px-2 py-0.5 rounded-full bg-black/70 text-[9px] font-bold text-white/90 tracking-wide flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {sectionProducts.length} items
                            </div>
                          )}

                          <div className="relative z-10 flex items-center justify-center h-full">
                            <Sparkles
                              className="text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                              size={30}
                            />
                          </div>
                        </motion.div>
                      </div>
                      <div className="p-4 md:p-5">
                        <div className="flex overflow-x-auto gap-3 md:gap-4 pb-2 no-scrollbar snap-x snap-mandatory">
                          {sectionProducts.length === 0 ? (
                            <div className="w-full py-6 text-center text-slate-400 text-sm font-bold">
                              No products in this section yet.
                            </div>
                          ) : (
                            sectionProducts.map((product, pIdx) => (
                              <div
                                key={product.id || product._id || `sprod-${pIdx}`}
                                className="w-[130px] md:w-[160px] lg:w-[180px] flex-shrink-0 snap-start">
                                <ProductCard
                                  product={product}
                                  className="border border-slate-100 dark:border-white/5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                                  compact
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}

          {/* Main Content Area – show admin-configured sections (hero/categories already shown above are skipped) */}
          {sectionsForRenderer.length > 0 && (
            <div
              className={cn(
                "container mx-auto px-4 md:px-8 lg:px-[50px] bg-[#F0F9FF] rounded-none pt-4 pb-10 mt-[-28px] mb-10 relative z-[1] border-x-2 border-b-2 border-orange-200/50 shadow-sm overflow-hidden",
              )}>
              {/* Animated Top Border Glow */}
              <motion.div
                animate={{
                  x: ["-100%", "100%"],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-orange-400/80 to-transparent"
              />

              <SectionRenderer
                sections={sectionsForRenderer}
                productsById={productsById}
                categoriesById={categoryMap}
                subcategoriesById={subcategoryMap}
              />
            </div>
          )}

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

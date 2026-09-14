import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import {
  Star,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Heart,
  Snowflake,
  Dog,
  UtensilsCrossed,
  ShoppingBag,
  ArrowRight,
  Tag,
  CheckCircle2,
  Flame,
} from 'lucide-react';

// MUI Icons
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import KitchenIcon from '@mui/icons-material/Kitchen';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PetsIcon from '@mui/icons-material/Pets';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SpaIcon from '@mui/icons-material/Spa';
import ToysIcon from '@mui/icons-material/Toys';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import YardIcon from '@mui/icons-material/Yard';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import DiamondIcon from '@mui/icons-material/Diamond';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import BuildIcon from '@mui/icons-material/Build';
import LuggageIcon from '@mui/icons-material/Luggage';
import ArrowRightIcon from '@mui/icons-material/ArrowForwardIos';
import VerifiedIcon from '@mui/icons-material/Verified';

import { motion, useScroll, useTransform } from 'framer-motion';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';
import ProductCard from '../components/shared/ProductCard';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import MiniCart from '../components/shared/MiniCart';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import Footer from '../components/layout/Footer';
import BottomNav from '../components/layout/BottomNav';
import { useProductDetail } from '../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@food/components/ui/skeleton';
import SectionRenderer from '../components/experience/SectionRenderer';
import ExperienceBannerCarousel from '../components/experience/ExperienceBannerCarousel';
import { useLocation } from '../context/LocationContext';
import { resolveQuickImageUrl } from '../utils/image';
import { useQuickHomeData } from '../hooks/useQuickHomeData';
import ZoneServiceUnavailable from '../components/shared/ZoneServiceUnavailable';
import {
  getQuickCartPath,
  getQuickCategoriesPath,
  getQuickCategoryPath,
} from '../utils/routes';

// ─── Static constants (outside component) ────────────────────────────────────

const DEFAULT_CATEGORY_THEME = {
  gradient: 'linear-gradient(to bottom, #F7C332, #F7E08F)',
  shadow: 'shadow-yellow-500/20',
  accent: 'text-[#1A1A1A]',
};

const ALL_CATEGORY = {
  id: 'all', _id: 'all', name: 'All', icon: HomeIcon,
  theme: DEFAULT_CATEGORY_THEME, headerColor: '#ffdb3a',
  banner: { title: 'HOUSEFULL', subtitle: 'SALE', floatingElements: 'sparkles', textColor: 'text-black' },
};

const MARQUEE_MESSAGES = ['24/7 Delivery', 'Minimum Order ₹99', 'Save Big on Essentials!'];

const quickCategoryPalettes = [
  { bgFrom: '#ffd96a', bgVia: '#ffeaa0', bgTo: '#fff0c7', glowColor: 'rgba(255,184,0,0.18)', frameColor: '#f0d98a' },
  { bgFrom: '#9fe88c', bgVia: '#c3f1b2', bgTo: '#e4f8da', glowColor: 'rgba(126,220,141,0.18)', frameColor: '#bfe3b7' },
  { bgFrom: '#f3a25d', bgVia: '#f9c48b', bgTo: '#fee0bf', glowColor: 'rgba(255,139,61,0.16)', frameColor: '#efc08e' },
  { bgFrom: '#b8eff0', bgVia: '#d5f7f5', bgTo: '#edfdfc', glowColor: 'rgba(122,215,215,0.16)', frameColor: '#b9e5e3' },
];

const QUICK_THEME_STORAGE_KEY = 'food.quick.headerColor';
const QUICK_HEADER_RETURN_STORAGE_KEY = 'food.quick.headerReturn';

const tabs = [
  { 
    id: "food", 
    title: "FOOD", 
    subtitle: "FROM RESTAURANTS", 
    discount: "UPTO 30% OFF",
    image: "/super-app/food.png",
    icon: UtensilsCrossed
  },
  { 
    id: "quick", 
    title: "INSTAMART", 
    subtitle: "INSTANT GROCERY", 
    discount: "UPTO 20% OFF",
    image: "/super-app/grocery.png",
    icon: ShoppingBag
  },
  {
    id: "street-food",
    title: "STREET FOOD",
    subtitle: "LOCAL VENDORS",
    discount: "LIVE NEARBY",
    image: "/super-app/streetfood.png",
    icon: Flame,
  },
];

// Floating elements — purely visual, rendered at call-site, no state
const DEFAULT_CATEGORY_ICONS = {
  "fruit": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=200&auto=format&fit=crop",
  "vegetable": "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?q=80&w=200&auto=format&fit=crop",
  "dairy": "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=200&auto=format&fit=crop",
  "milk": "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=200&auto=format&fit=crop",
  "meat": "https://images.unsplash.com/photo-1607623814075-e51df1bd682f?q=80&w=200&auto=format&fit=crop",
  "bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=200&auto=format&fit=crop",
  "bread": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=200&auto=format&fit=crop",
  "beverage": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=200&auto=format&fit=crop",
  "drink": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=200&auto=format&fit=crop",
  "snack": "https://images.unsplash.com/photo-1566478989037-e924e50cb0ee?q=80&w=200&auto=format&fit=crop",
  "chips": "https://images.unsplash.com/photo-1566478989037-e924e50cb0ee?q=80&w=200&auto=format&fit=crop",
  "crisps": "https://images.unsplash.com/photo-1566478989037-e924e50cb0ee?q=80&w=200&auto=format&fit=crop",
  "noodle": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?q=80&w=200&auto=format&fit=crop",
  "biscuit": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=200&auto=format&fit=crop",
  "cookie": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=200&auto=format&fit=crop",
  "musical": "https://images.unsplash.com/photo-1552422535-c45813c61732?q=80&w=200&auto=format&fit=crop",
  "piano": "https://images.unsplash.com/photo-1552422535-c45813c61732?q=80&w=200&auto=format&fit=crop",
  "tablas": "https://images.unsplash.com/photo-1552422535-c45813c61732?q=80&w=200&auto=format&fit=crop",
  "default": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop"
};

const getFallbackCategoryIcon = (name = "") => {
  const lowerName = name.toLowerCase();
  for (const [key, url] of Object.entries(DEFAULT_CATEGORY_ICONS)) {
    if (lowerName.includes(key)) return url;
  }
  return DEFAULT_CATEGORY_ICONS.default;
};

const getQuickCategoryImage = (category = {}) => {
  const candidate =
    category?.image ||
    category?.icon ||
    category?.thumbnail ||
    category?.imageUrl ||
    category?.iconUrl ||
    category?.media?.image ||
    category?.media?.url ||
    '';
  
  if (candidate === 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png') {
    return getFallbackCategoryIcon(category?.name);
  }
  
  return resolveQuickImageUrl(candidate) || getFallbackCategoryIcon(category?.name);
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const QuickHomeLoadingState = React.memo(({ embedded }) => (
  <div className={cn('pb-8', embedded ? 'pt-0' : 'pt-4 md:pt-6')}>
    <div className="block md:hidden">
      <Skeleton className="h-[190px] w-full rounded-none" />
    </div>
    <div className="px-4 py-4 md:px-8 lg:px-[50px]">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-w-[84px] flex-col items-center gap-2 md:min-w-[112px]">
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 space-y-3">
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
));
QuickHomeLoadingState.displayName = 'QuickHomeLoadingState';

// ─── Floating particles (memoized, recreated only on `type` change) ───────────

const FloatingElements = React.memo(({ type }) => {
  const COUNT = 10;
  const particles = useMemo(() => {
    const getContent = (i) => {
      switch (type) {
        case 'hearts': return <Heart fill="white" size={12 + (i % 5) * 2} className="drop-shadow-sm" />;
        case 'snow': return <Snowflake fill="white" size={10 + (i % 4) * 3} className="drop-shadow-sm" />;
        case 'stars':
        case 'sparkles': return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="drop-shadow-md">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        );
        default: return (
          <div className="bg-white/40 rounded-full blur-[1px]" style={{ width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3 }} />
        );
      }
    };
    return Array.from({ length: COUNT }, (_, i) => {
      const duration = 15 + Math.random() * 20;
      const delay = Math.random() * -20;
      const depth = 0.5 + Math.random() * 0.5;
      return {
        i,
        style: { left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.1 * depth, zIndex: Math.floor(depth * 10) },
        animate: { x: [0, 50, -50, 0], y: [0, -100, -50, 0], rotate: [0, 360], scale: [depth, depth * 1.2, depth] },
        transition: { duration: duration / depth, repeat: Infinity, ease: 'easeInOut', delay },
        content: getContent(i),
      };
    });
  }, [type]);

  return (
    <>
      {particles.map(({ i, style, animate, transition, content }) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ ...style, willChange: 'transform' }}
          animate={animate}
          transition={transition}
        >
          <div className="transform-gpu">{content}</div>
        </motion.div>
      ))}
    </>
  );
});
FloatingElements.displayName = 'FloatingElements';

// ─── Main Home component ──────────────────────────────────────────────────────

const Home = ({ embedded = false, onThemeChange, embeddedHeaderColor = null }) => {
  const { scrollY } = useScroll();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useLocation();
  const navigate = useNavigate();
  const locationRouter = useRouterLocation();
  const routePathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const quickCatsRef = useRef(null);

  const {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    categoryProducts,
    quickCategories,
    experienceSections,
    homeHeadings,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    serviceAvailable,
    serviceMessage,
    isLoading,
    isBootstrapped,
  } = useQuickHomeData({ currentLocation });

  const [pendingReturn, setPendingReturn] = useState(null);

  useLayoutEffect(() => {
    if (!embedded || typeof window === 'undefined') return;
    window.scrollTo(0, 0);
  }, [embedded, routePathname]);

  // ── Handle external category selection (e.g., from BottomNav) ─────────────
  useEffect(() => {
    if (locationRouter.state?.categoryToSelect && categories.length > 1) {
      const targetCatId = locationRouter.state.categoryToSelect;
      let cat = categoryMap[targetCatId];
      
      // If not in categoryMap, try finding it in quickCategories (header rail categories)
      if (!cat) {
        cat = quickCategories.find(c => c.id === targetCatId || c._id === targetCatId || c.name?.toLowerCase() === targetCatId.toLowerCase());
      }

      if (!cat && typeof targetCatId === 'string') {
        const slug = targetCatId.toLowerCase().trim();
        const headerMatch = categories.find((h) => {
          const hSlug = String(h?.slug || '').toLowerCase();
          const hName = String(h?.name || '').toLowerCase();
          return hSlug === slug || hName === slug;
        });
        if (headerMatch) cat = headerMatch;
      }
      
      if (cat) {
        if (typeof window !== 'undefined') {
          // Ensure navigation feels like it opens "from top"
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        setActiveCategory(cat);
        
        // Also trigger theme change so header color updates immediately
        if (typeof onThemeChange === 'function') {
          const resolvedColor = cat?.headerColor || '#FF0000';
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('food.quick.theme', resolvedColor);
            window.dispatchEvent(new Event('quickThemeChange'));
          }
          onThemeChange({ name: cat?.name || 'All', color: resolvedColor });
        }

        // Clear the state after selection to prevent it from re-triggering on reload
        navigate(locationRouter.pathname, { replace: true, state: {} });
      }
    }
  }, [locationRouter.state, categoryMap, quickCategories, categories, setActiveCategory, navigate, locationRouter.pathname, onThemeChange]);

  // ── Stable callbacks ───────────────────────────────────────────────────────
  const scrollQuickCats = useCallback((direction) => {
    quickCatsRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  }, []);

  const scrollLeft = useCallback(() => scrollQuickCats('left'), [scrollQuickCats]);
  const scrollRight = useCallback(() => scrollQuickCats('right'), [scrollQuickCats]);

  const navigateToCategories = useCallback(() => navigate(getQuickCategoriesPath()), [navigate]);

  // ── Theme change — only when activeCategory changes (fallback) ───────────
  useEffect(() => {
    const resolvedColor = activeCategory?.headerColor || '#FF0000';
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(QUICK_THEME_STORAGE_KEY, resolvedColor);
      window.dispatchEvent(new Event('quickThemeChange'));
    }
    
    if (typeof onThemeChange === 'function') {
      onThemeChange({ name: activeCategory?.name || 'All', color: resolvedColor });
    }
    // We specifically omit onThemeChange to prevent infinite loops, and only run when activeCategory changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // ── Derived flags ──────────────────────────────────────────────────────────
  // With progressive loading: isBootstrapped = true as soon as categories arrive.
  // Products/sections load in background — don't block the whole page for them.
  const isInitialPageLoading = !isBootstrapped;
  const hasHeroBanners = (heroConfig.banners?.items || []).length > 0;

  // ── Derived lists (heavy computation, memoized) ────────────────────────────
  const productsById = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p._id || p.id] = p; });
    return map;
  }, [products]);

  const effectiveQuickCategories = useMemo(() => {
    const normalizeCatId = (id) => {
      if (id == null) return '';
      if (typeof id === 'object') return String(id._id || id.id || '');
      return String(id);
    };

    const toStripItem = (c) => ({
      id: c._id,
      name: c.name,
      image: getQuickCategoryImage(c),
    });

    const belongsToActiveHeader = (cat) => {
      const mappedCat = categoryMap[normalizeCatId(cat.id || cat._id)] || cat;
      if (!mappedCat) return false;
      const parentHeaderId =
        mappedCat.parentId || mappedCat.headerId || mappedCat.parent?._id || mappedCat.header?._id;
      return (
        String(parentHeaderId) === String(activeCategory?._id) ||
        String(mappedCat._id) === String(activeCategory?._id)
      );
    };

    const headerScopedQuickCategories = () => {
      const activeCatId = activeCategory?._id || activeCategory?.id;
      if (!activeCatId || activeCatId === 'all') return quickCategories;
      return quickCategories.filter((cat) => {
        const mappedCat = categoryMap[normalizeCatId(cat.id || cat._id)];
        if (!mappedCat) return false;
        const parentHeaderId =
          mappedCat.parentId || mappedCat.headerId || mappedCat.parent?._id || mappedCat.header?._id;
        return String(parentHeaderId) === String(activeCatId);
      });
    };

    const ids = Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [];
    let cats = headerScopedQuickCategories();

    if (ids.length > 0) {
      const resolved = ids
        .map((id) => categoryMap[normalizeCatId(id)] || categoryMap[id])
        .filter(Boolean)
        .map(toStripItem);
      if (resolved.length > 0) {
        cats = resolved;
        // On a header tab, keep only categories that belong to that header
        const activeCatId = activeCategory?._id || activeCategory?.id;
        if (activeCatId && activeCatId !== 'all') {
          cats = cats.filter(belongsToActiveHeader);
        }
      }
    }

    return cats;
  }, [heroConfig.categoryIds, categoryMap, quickCategories, activeCategory]);

  const filteredProducts = useMemo(() => {
    const activeCatId = activeCategory?._id || activeCategory?.id;
    if (!activeCatId || activeCatId === 'all') return products;
    if (categoryProducts !== null) return categoryProducts;
    return products.filter((p) => {
      const productCatId = p.categoryId?._id || p.categoryId || p.category?._id || p.category;
      if (!productCatId) return false;
      const cat = categoryMap[String(productCatId)];
      if (!cat) return false;
      const parentHeaderId = cat.parentId || cat.headerId || cat.parent?._id || cat.header?._id;
      return String(parentHeaderId) === String(activeCatId) || String(productCatId) === String(activeCatId);
    });
  }, [products, categoryProducts, activeCategory, categoryMap]);

  const isAllCategory =
    !activeCategory ||
    String(activeCategory._id || activeCategory.id || '').toLowerCase() === 'all' ||
    String(activeCategory.slug || '').toLowerCase() === 'all' ||
    String(activeCategory.name || '').toLowerCase() === 'all';

  // Home sections must NEVER leak onto a header category (e.g. Grocery).
  // Each header only shows its own Experience Studio sections.
  const sectionsForRenderer = isAllCategory ? experienceSections : headerSections;

  const hasRenderableExperience = useMemo(
    () =>
      sectionsForRenderer.some((section) => {
        const banners =
          (section.config?.banners?.items || section.config?.items || []).length;

        const categories =
          (section.config?.categories?.items || []).length;

        const subcategories =
          (section.config?.subcategories?.items || []).length;

        const products =
          (section.config?.products?.items || []).length;

        return (
          banners > 0 ||
          categories > 0 ||
          subcategories > 0 ||
          products > 0
        );
      }),
    [sectionsForRenderer],
  );

  // ── Scroll parallax transforms ─────────────────────────────────────────────
  const opacity = useTransform(scrollY, [0, 300], [1, 0.6]);
  const y = useTransform(scrollY, [0, 300], [0, 80]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, [0, 100], ['auto', 'none']);

  // ── Scroll-to-section after category switch ────────────────────────────────
  useEffect(() => {
    if (!pendingReturn?.sectionId) return;
    const allSections = sectionsForRenderer;
    if (!allSections.length) return;

    const targetSectionId =
      pendingReturn.sectionId === '__auto__'
        ? (allSections.find((s) => s?.displayType === 'categories')?._id || allSections[0]?._id)
        : pendingReturn.sectionId;

    if (!targetSectionId || !allSections.some((s) => s._id === targetSectionId)) return;

    const el = document.getElementById(`section-${targetSectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.sessionStorage.removeItem('experienceReturn');
      setPendingReturn(null);
    }
  }, [sectionsForRenderer, pendingReturn]);

  // Products for "More" (Recommended For You–style) — prefer items beyond Lowest Price strip
  const moreProducts = useMemo(() => {
    const list = Array.isArray(filteredProducts) ? filteredProducts : [];
    if (list.length <= 8) return list.slice(0, 12);
    const rest = list.slice(8, 20);
    return rest.length >= 4 ? rest : list.slice(0, 12);
  }, [filteredProducts]);


  // ── Category card click handler (stable) ──────────────────────────────────
  const handleCategoryClick = useCallback(
    (cat) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          QUICK_HEADER_RETURN_STORAGE_KEY,
          JSON.stringify({
            headerId: activeCategory?._id || activeCategory?.id || ALL_CATEGORY._id,
            color: '#FF0000',
            name: activeCategory?.name || ALL_CATEGORY.name,
          }),
        );
      }
      navigate(getQuickCategoryPath(cat.id));
    },
    [navigate, activeCategory],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'bg-[#F5F7F8] dark:bg-background',
      embedded ? 'min-h-0 bg-white dark:bg-card pt-0' : 'min-h-screen pt-[176px] md:pt-[210px]',
    )}>
      <div className={cn('contents', isProductDetailOpen && 'hidden md:contents')}>
        <MainLocationHeader
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={(cat) => {
            setActiveCategory(cat);
            if (typeof onThemeChange === 'function') {
              const resolvedColor = cat?.headerColor || '#FF0000';
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(QUICK_THEME_STORAGE_KEY, resolvedColor);
                window.dispatchEvent(new Event('quickThemeChange'));
              }
              onThemeChange({ name: cat?.name || 'All', color: resolvedColor });
            }
          }}
          embedded={embedded}
          embeddedHeaderColor={embeddedHeaderColor}
          showTopContent={!embedded}
          showSearchBar={!embedded}
        />
      </div>

      {isInitialPageLoading ? (
        <QuickHomeLoadingState embedded={embedded} />
      ) : !serviceAvailable ? (
        <ZoneServiceUnavailable
          message={serviceMessage || 'Services not available in your area'}
          className="min-h-[50vh]"
          actionLabel={
            String(serviceMessage || '').toLowerCase().includes('select your delivery location')
              ? 'Select delivery location'
              : 'Change location'
          }
          onAction={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('quickOpenLocationDrawer'));
            }
          }}
        />
      ) : (
        <div className={cn('pt-0', embedded && 'pt-0')}>

          {/* Admin hero banners only — no hardcoded fallback when empty */}
          {hasHeroBanners ? (
            <div className={cn(embedded ? '-mt-[1px]' : 'mt-0')}>
              <div className="relative w-full overflow-hidden bg-transparent">
                <div className="px-3 py-2 md:px-8 lg:px-[50px] md:py-4">
                  <ExperienceBannerCarousel
                    section={{ title: '' }}
                    items={heroConfig.banners.items}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Promo Marquee Strip */}
              <div className={cn('w-full md:-mt-[2px] mb-4', embedded ? '-mt-[1px]' : '-mt-[2px]')}>
            <div
              className={cn(
                'relative overflow-hidden border-y transition-colors duration-300 shadow-red-700/30'
              )}
              style={{
                backgroundColor: '#FF0000',
                backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.35))',
                borderTopColor: 'rgba(255, 255, 255, 0.12)',
                borderBottomColor: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <div 
                className="absolute inset-y-0 left-0 w-16 pointer-events-none z-10"
                style={{ 
                  backgroundImage: `linear-gradient(to right, #FF0000, transparent)` 
                }} 
              />
              <div 
                className="absolute inset-y-0 right-0 w-16 pointer-events-none z-10"
                style={{ 
                  backgroundImage: `linear-gradient(to left, #FF0000, transparent)` 
                }} 
              />
              <div 
                className="classic-marquee-track flex w-max items-center gap-4 px-3 md:px-6 py-4 text-sm md:text-base font-bold -translate-y-[4px] text-white/95 transition-colors duration-300"
              >
                {[...MARQUEE_MESSAGES, ...MARQUEE_MESSAGES].map((message, idx) => (
                  <React.Fragment key={`${message}-${idx}`}>
                    <span className="whitespace-nowrap drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]">{message}</span>
                    <span className="text-white/40">•</span>
                  </React.Fragment>
                ))}
                <span className="whitespace-nowrap">❤️</span>
                <span className="whitespace-nowrap">🎁</span>
              </div>
            </div>
          </div>

          {/* TABS SECTION / CARDS SECTION */}
          <div className="grid grid-cols-3 md:flex md:justify-center gap-2 md:gap-4 px-3 py-3 sm:px-4 sm:py-4 mx-auto w-full max-w-7xl relative z-20">
            {tabs.map((tab) => {
              const isActive = tab.id === "quick";
              const handleTabClick = () => {
                if (tab.id === "quick") navigate("/quick");
                else if (tab.id === "street-food") navigate("/food/user?service=streetfood");
                else navigate("/food/user");
              };
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={handleTabClick}
                  className={cn(
                    "relative border overflow-hidden shadow-sm transition-all duration-300 text-left w-full",
                    "rounded-[16px] h-[85px] min-[380px]:h-[95px] p-2 sm:p-2.5",
                    "md:rounded-[20px] md:h-[120px] md:w-[280px] md:p-0",
                    isActive 
                      ? "bg-amber-50/80 border-amber-200 shadow-sm scale-[1.02]" 
                      : tab.id === "food"
                      ? "bg-rose-50/60 border-rose-100 hover:bg-rose-50 hover:border-rose-200 hover:shadow-md hover:scale-[1.01]"
                      : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-md hover:scale-[1.01]"
                  )}
                >
                  {/* MOBILE CONTENT */}
                  <div className="flex flex-col justify-between h-full md:hidden">
                    <div className="flex gap-1.5 w-full items-start z-10">
                      <div className="bg-[#FF0000] text-white rounded-full p-1 shrink-0 flex items-center justify-center h-[20px] w-[20px] mt-0.5">
                        <tab.icon className="h-3 w-3" strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col min-w-0 mt-0.5">
                        <span className="text-[9.5px] min-[380px]:text-[10.5px] sm:text-[12px] font-bold text-gray-900 leading-tight truncate">
                          {tab.title}
                        </span>
                        <p className="text-[7px] sm:text-[8px] font-medium text-gray-500 uppercase tracking-tight mt-0.5 truncate">
                          {tab.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 flex items-end justify-between w-full z-10">
                      <div className="bg-[#FF0000] text-white rounded-full p-1 shrink-0 flex items-center justify-center h-4 w-4 shadow-sm mb-0.5">
                        <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                      <div className="absolute right-[-4px] bottom-[-4px] w-[55px] h-[55px] min-[380px]:w-[65px] min-[380px]:h-[65px] pointer-events-none">
                        <img src={tab.image} className="w-full h-full object-contain mix-blend-multiply" alt={tab.title} />
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP CONTENT */}
                  <div className="hidden md:flex justify-between h-full w-full p-4">
                    <div className="flex flex-col justify-between h-full z-10 w-[65%]">
                      <div className="flex items-start gap-2">
                        <div className="bg-[#FF0000] text-white rounded-full p-1.5 shrink-0 flex items-center justify-center md:h-[28px] md:w-[28px]">
                          <tab.icon className="md:h-4 md:w-4" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="md:text-[15px] font-extrabold text-gray-900 leading-tight truncate tracking-tight">
                            {tab.title}
                          </span>
                          <p className="md:text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 truncate">
                            {tab.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="bg-[#FF0000] text-white rounded-full shrink-0 flex items-center justify-center md:h-6 md:w-6 shadow-sm">
                        <ArrowRight className="md:h-3.5 md:w-3.5" strokeWidth={3} />
                      </div>
                    </div>
                    <div className="absolute right-0 bottom-0 top-0 md:w-[45%] pointer-events-none flex items-end justify-end md:pr-4 md:pb-2">
                      <img src={tab.image} className="md:w-[100px] md:h-[100px] object-contain mix-blend-multiply" alt={tab.title} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Category Slider */}
          {effectiveQuickCategories.length > 0 ? (
            <div className={cn('w-full mb-5 overflow-hidden relative group z-20 md:mt-3', embedded ? 'mt-2' : 'mt-4 md:mt-6')}>
              <div className={cn('relative overflow-hidden bg-white dark:bg-card mx-0 md:mx-8 lg:mx-[50px] rounded-none md:rounded-[32px]', embedded ? 'shadow-none' : 'shadow-[0_14px_28px_rgba(15,23,42,0.09)]')}>
                <div className="relative z-10 px-4 pt-3 pb-1 md:px-8 md:pt-4">
                  <h2 className="text-center text-[18px] md:text-[20px] font-bold tracking-tight text-[#132018] leading-none">Quick categories</h2>
                </div>

                <div className="absolute left-4 lg:left-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={scrollLeft}
                    className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#0c831f] transition-all">
                    <ChevronLeft size={22} strokeWidth={3} />
                  </motion.button>
                </div>

                <div ref={quickCatsRef} className="relative z-10 flex items-start gap-2.5 md:gap-3 lg:gap-4 overflow-x-auto no-scrollbar px-4 pb-3 pt-1 md:px-8 md:pb-4 snap-x scroll-smooth">
                  {effectiveQuickCategories.map((cat, idx) => {
                    const palette = quickCategoryPalettes[idx % quickCategoryPalettes.length];
                    const categoryImage = getQuickCategoryImage(cat);
                    return (
                      <motion.div
                        key={cat.id}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleCategoryClick(cat)}
                        className="flex flex-col items-center gap-1 min-w-[84px] md:min-w-[112px] lg:min-w-[128px] cursor-pointer group/item snap-start"
                      >
                        <div
                          className="relative w-[84px] h-[96px] md:w-[112px] md:h-[126px] lg:w-[128px] lg:h-[140px] rounded-t-full rounded-b-[24px] shadow-[0_10px_22px_rgba(15,23,42,0.10)] border flex items-start justify-center p-2 transition-all duration-300 group-hover/item:-translate-y-1 group-hover/item:shadow-[0_16px_30px_rgba(15,23,42,0.14)] overflow-hidden"
                          style={{
                            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.6) 24%, rgba(255,255,255,0.15) 100%), linear-gradient(135deg, ${palette.bgFrom}, ${palette.bgVia}, ${palette.bgTo})`,
                            borderColor: palette.frameColor,
                          }}
                        >
                          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundColor: palette.glowColor }} />
                          {categoryImage ? (
                            <div className="absolute left-1/2 top-2 z-10 h-[68px] w-[68px] -translate-x-1/2 rounded-full overflow-hidden border-2 border-white/80 shadow-sm group-hover/item:scale-110 transition-transform duration-500">
                              <img
                                src={categoryImage}
                                alt={cat.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="absolute left-1/2 top-3 z-10 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-[20px] bg-white/55 text-2xl font-black uppercase text-slate-400">
                              {(cat.name || '?').charAt(0)}
                            </div>
                          )}
                          <div className="absolute inset-x-2 bottom-1.5 z-20 text-center">
                            <span className="block text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[#1f2b20] leading-tight whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] group-hover/item:text-[#0c831f] transition-colors">
                              {cat.name}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="absolute right-4 lg:right-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={scrollRight}
                    className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#0c831f] transition-all">
                    <ChevronRight size={22} strokeWidth={3} />
                  </motion.button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Lowest Price Ever Section */}
          <div className={cn('mb-4 md:mb-6', embedded ? 'mt-4 md:mt-5' : 'mt-6 md:mt-10')}>
            <div className="relative overflow-hidden bg-[#f0f7fb] pt-6 md:pt-8 pb-0 rounded-none md:rounded-[32px] mx-0 md:mx-8 lg:mx-[50px] shadow-sm">
              <div className="relative z-10 px-4 md:px-8">
                <div className="flex justify-between items-start md:items-center mb-5 md:mb-6 px-1">
                  <div className="flex flex-col">
                    <h3 className="flex items-center gap-2 text-[15px] md:text-xl font-semibold text-[#1c1c1e] tracking-tight leading-none">
                      <Tag className="h-4 w-4 md:h-5 md:w-5 text-[#0c831f] -rotate-45" fill="#dcfce7" />
                      Lowest Price <span className="text-[#0c831f]">Ever</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-2 md:mt-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#0c831f]" />
                        <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
                          Unbeatable Savings
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#0c831f]" />
                        <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
                          Updated Hourly
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.div
                    onClick={navigateToCategories}
                    whileHover={{ x: 3, scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 bg-white px-3 py-1.5 md:px-5 md:py-2 rounded-full text-slate-700 font-bold text-xs md:text-sm cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-slate-200 transition-all shrink-0 mt-1 md:mt-0"
                  >
                    See all <ChevronRight className="h-4 w-4 md:h-5 md:w-5 ml-0.5 text-slate-700" />
                  </motion.div>
                </div>

                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 pb-6 md:pb-8">
                  {filteredProducts.slice(0, 12).map((product) => (
                    <div key={product.id} className="min-w-0">
                      <ProductCard
                        product={product}
                        compact={true}
                        variant="deal"
                      />
                    </div>
                  ))}
                  {filteredProducts.length === 0 && !isLoading && (
                    <div className="col-span-full py-10 md:py-20 text-center text-slate-400 font-black italic md:text-xl">
                      {activeCategory && activeCategory._id !== 'all'
                        ? `No products found in ${activeCategory.name}`
                        : 'Curating the best deals for you...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Experience Sections (Fast Fav categories + More products after it) */}
          {hasRenderableExperience && (
            <div className="container mx-auto px-4 md:px-8 lg:px-[50px] bg-[#F0F9FF] rounded-none pt-4 pb-10 mt-[-28px] mb-10 relative z-[1] border-x-2 border-b-2 border-sky-200/50 shadow-sm overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '100%'], opacity: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent"
              />
              <SectionRenderer
                sections={sectionsForRenderer}
                productsById={productsById}
                categoriesById={categoryMap}
                subcategoriesById={subcategoryMap}
                moreProducts={moreProducts}
                moreHeading={homeHeadings?.moreHeading || 'More'}
              />
            </div>
          )}

          {/* Fallback More when experience / Fast Fav categories are not configured */}
          {!hasRenderableExperience && moreProducts.length > 0 && (
            <section
              className={cn(
                'mt-4 mb-6 px-4 md:px-8 lg:px-[50px] w-full max-w-[1920px] mx-auto',
                embedded ? 'mt-3' : '',
              )}
              data-purpose="more-recommended-section-fallback"
            >
              <div className="mb-3 sm:mb-4 pr-1">
                <div className="min-w-0">
                  <h2 className="text-[15px] md:text-xl font-semibold text-[#1c1c1e] dark:text-white tracking-tight">
                    {homeHeadings?.moreHeading || 'More'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 md:mt-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
                      <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
                        Picked for you
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
                      <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
                        Fresh finds
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#0c831f] shrink-0" />
                      <span className="text-[11px] md:text-[13px] font-medium text-slate-600">
                        Fast delivery
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 pb-2">
                {moreProducts.map((product) => (
                  <div
                    key={`more-fallback-${product.id || product._id}`}
                    className="min-w-0"
                  >
                    <ProductCard product={product} compact />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Duplicate Footer removed, handled by CustomerLayout */}

          {embedded && (
            <>
              <MiniCart linkTo={getQuickCartPath(routePathname)} />
              <ProductDetailSheet />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(Home);
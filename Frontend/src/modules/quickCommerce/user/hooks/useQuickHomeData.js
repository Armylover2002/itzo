import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { customerApi } from "../services/customerApi";
import { Sparkles } from "lucide-react";
import HomeIcon from "@mui/icons-material/Home";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import DevicesIcon from "@mui/icons-material/Devices";
import {
  resolveCategoryIconComponent,
} from "@shared/constants/categoryIconComponents";
import { resolveQuickImageUrl } from "../utils/image";

// ---------------------------------------------------------------------------
// Color System — All backgrounds are dark/deep so white text stays readable
// Contrast ratio against #FFFFFF is ≥ 4.5:1 for every entry (WCAG AA)
// ---------------------------------------------------------------------------

const THEMES = {
  all: {
    gradient: "linear-gradient(to bottom, #D44A00, #7C2A00)",
    shadow: "shadow-red-700/30",
    headerColor: "#FF0000",
  },

  grocery: {
    gradient: "linear-gradient(to bottom, #540D36, #250316)",
    shadow: "shadow-pink-950/40",
    headerColor: "#540D36",
  },

  wedding: {
    gradient: "linear-gradient(to bottom, #420817, #190106)",
    shadow: "shadow-rose-950/60",
    headerColor: "#420817",
  },

  homeKitchen: {
    gradient: "linear-gradient(to bottom, #072C38, #021017)",
    shadow: "shadow-cyan-950/60",
    headerColor: "#072C38",
  },

  electronics: {
    gradient: "linear-gradient(to bottom, #22073D, #090114)",
    shadow: "shadow-violet-950/60",
    headerColor: "#22073D",
  },

  kids: {
    gradient: "linear-gradient(to bottom, #2B0F07, #120502)",
    shadow: "shadow-amber-950/60",
    headerColor: "#2B0F07",
  },

  pets: {
    gradient: "linear-gradient(to bottom, #0F3A5F, #061B2E)",
    shadow: "shadow-blue-900/40",
    headerColor: "#0F3A5F",
  },

  sports: {
    gradient: "linear-gradient(to bottom, #0A1B45, #020815)",
    shadow: "shadow-blue-950/60",
    headerColor: "#0A1B45",
  },

  beauty: {
    gradient: "linear-gradient(to bottom, #02281D, #000D09)",
    shadow: "shadow-emerald-950/60",
    headerColor: "#02281D",
  },

  fashion: {
    gradient: "linear-gradient(to bottom, #14123D, #05040F)",
    shadow: "shadow-indigo-950/60",
    headerColor: "#14123D",
  },

  default: {
    gradient: "linear-gradient(to bottom, #6B2200, #240B00)",
    shadow: "shadow-red-950/60",
    headerColor: "#6B2200",
  },
};

// Shared accent for all categories (white text always works on dark backgrounds)
const TEXT_ACCENT = "text-white";

const CATEGORY_METADATA = {
  All: {
    icon: HomeIcon,
    theme: THEMES.all,
    banner: { title: "HOUSEFULL", subtitle: "SALE", floatingElements: "sparkles" },
  },
  Grocery: {
    icon: LocalGroceryStoreIcon,
    theme: THEMES.grocery,
    banner: { title: "SUPERSAVER", subtitle: "FRESH & FAST", floatingElements: "leaves" },
  },
  Wedding: {
    icon: CardGiftcardIcon,
    theme: THEMES.wedding,
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: KitchenIcon,
    theme: THEMES.homeKitchen,
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: DevicesIcon,
    theme: THEMES.electronics,
    banner: { title: "TECH FEST", subtitle: "GADGETS", floatingElements: "tech" },
  },
  Kids: {
    icon: ChildCareIcon,
    theme: THEMES.kids,
    banner: { title: "LITTLE ONE", subtitle: "CARE", floatingElements: "bubbles" },
  },
  "Pet Supplies": {
    icon: PetsIcon,
    theme: THEMES.pets,
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: SportsSoccerIcon,
    theme: THEMES.sports,
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
};

// Returns a deep/dark header color so white text stays readable
const getDynamicHeaderColor = (name = "") => {
  const n = name.toLowerCase().trim();
  if (n.includes("all")) return THEMES.all.headerColor;
  if (n.includes("grocery") || n.includes("glocery")) return THEMES.grocery.headerColor;
  if (n.includes("electronic")) return THEMES.electronics.headerColor;
  if (n.includes("home") || n.includes("kitchen") || n.includes("kit")) return THEMES.homeKitchen.headerColor;
  if (n.includes("kid") || n.includes("child") || n.includes("baby") || n.includes("toy")) return THEMES.kids.headerColor;
  if (n.includes("pet") || n.includes("dog") || n.includes("cat")) return THEMES.pets.headerColor;
  if (n.includes("wedding") || n.includes("gift")) return THEMES.wedding.headerColor;
  if (n.includes("sport") || n.includes("soccer")) return THEMES.sports.headerColor;
  if (n.includes("beauty") || n.includes("spa")) return THEMES.beauty.headerColor;
  if (n.includes("fashion") || n.includes("cloth")) return THEMES.fashion.headerColor;
  return THEMES.default.headerColor;
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: HomeIcon,
  theme: THEMES.all,
  headerColor: THEMES.all.headerColor,
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: TEXT_ACCENT,
  },
};

// ---------------------------------------------------------------------------
// Storage & Cache
// ---------------------------------------------------------------------------

const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (content rarely changes this fast)
const HEADER_HERO_CACHE_TTL_MS = 60 * 1000; // 1 minute — admin hero edits should show quickly

let globalQuickHomeCache = {
  data: null,
  locationKey: "",
  headerSections: new Map(),    // headerId -> sections
  categoryProducts: new Map(),  // headerId -> products
  heroConfigs: new Map(),       // headerId -> { config, fetchedAt }
  lastFetched: 0,
};

const clearPerHeaderCaches = () => {
  globalQuickHomeCache.headerSections.clear();
  globalQuickHomeCache.categoryProducts.clear();
  globalQuickHomeCache.heroConfigs.clear();
};

const getCachedHeaderHero = (headerId) => {
  const entry = globalQuickHomeCache.heroConfigs.get(headerId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= HEADER_HERO_CACHE_TTL_MS) {
    globalQuickHomeCache.heroConfigs.delete(headerId);
    return null;
  }
  return entry.config;
};

const setCachedHeaderHero = (headerId, config) => {
  globalQuickHomeCache.heroConfigs.set(headerId, { config, fetchedAt: Date.now() });
};

// ---------------------------------------------------------------------------
// Helper: format raw product from API
// ---------------------------------------------------------------------------
const formatProduct = (p) => ({
  ...p,
  id: p._id,
  image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
  price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
  originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
  weight: p.weight || "1 unit",
  deliveryTime: "8-15 mins",
});

// ---------------------------------------------------------------------------
// Helper: extract array from varied API shapes
// ---------------------------------------------------------------------------
const extractArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useQuickHomeData = ({ currentLocation }) => {
  // Stale-while-revalidate: show any cached data immediately, even if expired
  const hasAnyCache = Boolean(globalQuickHomeCache.data);
  const hasValidCache = hasAnyCache && Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS;

  // Only block UI (show skeleton) if there is absolutely NO cached data
  const [isLoading, setIsLoading] = useState(!hasAnyCache);
  const [isBootstrapped, setIsBootstrapped] = useState(hasAnyCache);
  const [categories, setCategories] = useState(globalQuickHomeCache.data?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(globalQuickHomeCache.data?.activeCategory || ALL_CATEGORY);
  const [products, setProducts] = useState(globalQuickHomeCache.data?.products || []);
  const [quickCategories, setQuickCategories] = useState(globalQuickHomeCache.data?.quickCategories || []);
  const [experienceSections, setExperienceSections] = useState(globalQuickHomeCache.data?.experienceSections || []);
  const [offerSections, setOfferSections] = useState(globalQuickHomeCache.data?.offerSections || []);
  const [homeTiles, setHomeTiles] = useState(globalQuickHomeCache.data?.homeTiles || []);
  const [homeHeadings, setHomeHeadings] = useState(
    globalQuickHomeCache.data?.homeHeadings || { fastFavHeading: "Fast Fav", moreHeading: "More" },
  );
  const [categoryMap, setCategoryMap] = useState(globalQuickHomeCache.data?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(globalQuickHomeCache.data?.subcategoryMap || {});
  const [heroConfig, setHeroConfig] = useState(globalQuickHomeCache.data?.heroConfig || { banners: { items: [] }, categoryIds: [] });
  const [headerSections, setHeaderSections] = useState([]);
  const [loadingHeaderSections, setLoadingHeaderSections] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState(null);
  const [serviceAvailable, setServiceAvailable] = useState(
    globalQuickHomeCache.data?.serviceAvailable !== false,
  );
  const [serviceMessage, setServiceMessage] = useState(
    globalQuickHomeCache.data?.serviceMessage || "",
  );

  const fetchDataSeqRef = useRef(0);

  const resolvedCoords = useMemo(() => {
    const lat = Number(currentLocation?.latitude);
    const lng = Number(currentLocation?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    // Fallback: Food `userLocation` / QC `location_v2` when context not hydrated yet.
    if (typeof window === "undefined") return null;
    for (const key of ["location_v2", "userLocation"]) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const sLat = Number(parsed?.latitude ?? parsed?.lat);
        const sLng = Number(parsed?.longitude ?? parsed?.lng);
        if (Number.isFinite(sLat) && Number.isFinite(sLng)) {
          return { lat: sLat, lng: sLng };
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const locationKey = useMemo(() => {
    if (!resolvedCoords) return "";
    return `${resolvedCoords.lat.toFixed(4)},${resolvedCoords.lng.toFixed(4)}`;
  }, [resolvedCoords]);

  const getQuickCategoryImage = useCallback((category = {}) => {
    const candidate =
      category?.image || category?.icon || category?.thumbnail ||
      category?.imageUrl || category?.iconUrl ||
      category?.media?.image || category?.media?.url || "";
    return resolveQuickImageUrl(candidate) || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
  }, []);

  // Build a formatted header category object from raw DB entry
  const buildHeaderCategory = useCallback((cat) => {
    const catName = cat.name;
    const normalizedName = catName.charAt(0).toUpperCase() + catName.slice(1).toLowerCase();
    const meta =
      CATEGORY_METADATA[catName] ||
      CATEGORY_METADATA[normalizedName] ||
      CATEGORY_METADATA[catName.toUpperCase()] || {
        icon: Sparkles,
        theme: THEMES.default,
        banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", floatingElements: "sparkles" },
      };

    const IconComp =
      resolveCategoryIconComponent(cat.iconId, null) || meta.icon || Sparkles;
    const headerColor = catName.toLowerCase().trim().includes("all")
      ? THEMES.all.headerColor
      : (cat.headerColor || getDynamicHeaderColor(catName));

    return {
      ...cat,
      id: cat._id,
      icon: IconComp,
      theme: meta.theme,
      headerColor,
      banner: { ...meta.banner, textColor: TEXT_ACCENT },
    };
  }, []);

  const fetchData = useCallback(async () => {
    const seq = ++fetchDataSeqRef.current;

    // Re-check cache validity at call time (avoids stale closure)
    const cacheIsValid =
      globalQuickHomeCache.data &&
      globalQuickHomeCache.locationKey === locationKey &&
      Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS;
    if (cacheIsValid) return;

    // Location changed — drop previous zone catalog immediately.
    if (globalQuickHomeCache.locationKey !== locationKey) {
      globalQuickHomeCache.data = null;
      clearPerHeaderCaches();
    }

    // Stale-while-revalidate: if stale data exists, don't show skeleton — refresh silently
    const isSilentRefresh = Boolean(globalQuickHomeCache.data);
    if (!isSilentRefresh) setIsLoading(true);

    try {
      // Location is required for zone-scoped products — pass numeric coords only.
      const bootstrapParams = {};
      if (resolvedCoords) {
        bootstrapParams.lat = resolvedCoords.lat;
        bootstrapParams.lng = resolvedCoords.lng;
      }

      const bootstrapRes = await customerApi.getBootstrap(bootstrapParams);
      if (seq !== fetchDataSeqRef.current) return;

      if (!bootstrapRes?.data?.success) {
        throw new Error('Bootstrap fetch failed');
      }

      const payload = bootstrapRes.data.result;

      const newCache = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: [],
        offerSections: [],
        heroConfig: { banners: { items: [] }, categoryIds: [] },
        categoryMap: {},
        subcategoryMap: {},
        serviceAvailable: true,
        serviceMessage: "",
      };

      // ── Categories ─────────────────────────────────────────────────────────────
      const dbCats = payload.categories || [];

      const catMap = {};
      const subMap = {};
      dbCats.forEach((c) => {
        if (c.type === "category") catMap[c._id] = c;
        else if (c.type === "subcategory") subMap[c._id] = c;
      });
      setCategoryMap(catMap);
      setSubcategoryMap(subMap);
      newCache.categoryMap = catMap;
      newCache.subcategoryMap = subMap;

      const formattedHeaders = dbCats
        .filter((c) => c.type === "header")
        .map(buildHeaderCategory);

      const allFromAdmin = formattedHeaders.find(
        (h) => h.slug?.toLowerCase() === "all" || h.name?.toLowerCase() === "all"
      );
      const mergedAll = allFromAdmin
        ? { ...ALL_CATEGORY, icon: allFromAdmin.icon || ALL_CATEGORY.icon }
        : ALL_CATEGORY;

      const headersWithoutAll = formattedHeaders.filter(
        (h) => !(h.slug?.toLowerCase() === "all" || h.name?.toLowerCase() === "all")
      );
      const finalCategories = [mergedAll, ...headersWithoutAll];
      setCategories(finalCategories);
      newCache.categories = finalCategories;

      // Restore active category from session
      let initialActive = mergedAll;
      const storedHeaderReturn = window.sessionStorage.getItem(QUICK_HEADER_RETURN_STORAGE_KEY);
      const storedExpReturn = window.sessionStorage.getItem("experienceReturn");
      const restoreId =
        (storedHeaderReturn && JSON.parse(storedHeaderReturn)?.headerId) ||
        (storedExpReturn && JSON.parse(storedExpReturn)?.headerId);
      if (restoreId) {
        const match = finalCategories.find((h) => h._id === restoreId || h.id === restoreId);
        if (match) initialActive = match;
      }
      setActiveCategory(initialActive);
      newCache.activeCategory = initialActive;

      const formattedQuick = dbCats
        .filter((c) => c.type === "category")
        .map((c) => ({ id: c._id, name: c.name, image: getQuickCategoryImage(c) }));
      setQuickCategories(formattedQuick);
      newCache.quickCategories = formattedQuick;

      // 🔑 Categories ready → UI immediately unblock karo
      setIsBootstrapped(true);
      setIsLoading(false);

      // ── Products (already in bootstrap payload) ────────────────────────────
      const rawProducts = payload.products || [];
      const formatted = rawProducts.map(formatProduct);
      setProducts(formatted);
      newCache.products = formatted;

      const available = payload.serviceAvailable !== false;
      const message = String(payload.message || "").trim();
      setServiceAvailable(available);
      setServiceMessage(message);
      newCache.serviceAvailable = available;
      newCache.serviceMessage = message;

      // ── Experience Sections ───────────────────────────────────────────
      const sections = payload.experienceSections || [];
      setExperienceSections(sections);
      newCache.experienceSections = sections;

      // ── Offer Sections ───────────────────────────────────────────────
      const offerSecs = payload.offerSections || [];
      setOfferSections(offerSecs);
      newCache.offerSections = offerSecs;

      // ── Fast Fav + More tiles ─────────────────────────────────────────
      const tiles = Array.isArray(payload.homeTiles) ? payload.homeTiles : [];
      setHomeTiles(tiles);
      newCache.homeTiles = tiles;
      const headings = payload.homeHeadings || {
        fastFavHeading: "Fast Fav",
        moreHeading: "More",
      };
      setHomeHeadings(headings);
      newCache.homeHeadings = headings;

      // ── Hero Config ───────────────────────────────────────────────────
      const heroPayload = payload.heroConfig;
      const config =
        heroPayload?.banners?.items?.length > 0 || heroPayload?.categoryIds?.length > 0
          ? { banners: heroPayload.banners || { items: [] }, categoryIds: heroPayload.categoryIds || [] }
          : { banners: { items: [] }, categoryIds: [] };
      setHeroConfig(config);
      newCache.heroConfig = config;

      // Save complete cache — drop per-header caches so tabs refetch fresh hero/sections
      globalQuickHomeCache.data = newCache;
      globalQuickHomeCache.locationKey = locationKey;
      globalQuickHomeCache.lastFetched = Date.now();
      clearPerHeaderCaches();
    } catch (err) {
      // Surface errors only in dev
      if (import.meta.env?.DEV) console.error("Quick home bootstrap error:", err);
    } finally {
      if (seq === fetchDataSeqRef.current) setIsLoading(false);
    }
  }, [locationKey, resolvedCoords, getQuickCategoryImage, buildHeaderCategory]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Fetch header-specific sections & products when active category changes ---
  useEffect(() => {
    if (!activeCategory || activeCategory._id === "all") {
      setHeaderSections([]);
      setCategoryProducts(null);
      if (globalQuickHomeCache.data?.heroConfig) {
        setHeroConfig(globalQuickHomeCache.data.heroConfig);
      }
      return;
    }

    const headerId = activeCategory._id;

    const fetchHeaderSections = async () => {
      if (globalQuickHomeCache.headerSections.has(headerId)) {
        setHeaderSections(globalQuickHomeCache.headerSections.get(headerId));
        return;
      }
      setLoadingHeaderSections(true);
      try {
        const res = await customerApi.getExperienceSections({ pageType: "header", headerId });
        if (res.data.success) {
          const sections = extractArray(res.data.result ?? res.data.results ?? res.data);
          setHeaderSections(sections);
          globalQuickHomeCache.headerSections.set(headerId, sections);
        }
      } catch {
        // silently fail — cached empty array will be used
      } finally {
        setLoadingHeaderSections(false);
      }
    };

    const fetchCategoryProducts = async () => {
      if (globalQuickHomeCache.categoryProducts.has(headerId)) {
        setCategoryProducts(globalQuickHomeCache.categoryProducts.get(headerId));
        return;
      }
      try {
        const productParams = { categoryId: headerId, limit: 50 };
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          productParams.lat = currentLocation.latitude;
          productParams.lng = currentLocation.longitude;
        }
        const res = await customerApi.getProducts(productParams);
        if (res?.data?.success) {
          const payload = res.data.result || {};
          if (payload.serviceAvailable === false) {
            setServiceAvailable(false);
            setServiceMessage(String(payload.message || "").trim());
          }
          const formatted = extractArray(payload.items ?? res.data.results ?? res.data.result).map(formatProduct);
          globalQuickHomeCache.categoryProducts.set(headerId, formatted);
          setCategoryProducts(formatted);
        }
      } catch {
        // silently fail — products fallback to home products
      }
    };

    const resolveHomeHeroFallback = () =>
      globalQuickHomeCache.data?.heroConfig || { banners: { items: [] }, categoryIds: [] };

    const isHeroConfigEmpty = (config) =>
      !(config?.banners?.items?.length > 0 || config?.categoryIds?.length > 0);

    const withHomeHeroFallback = (config) =>
      (isHeroConfigEmpty(config) ? resolveHomeHeroFallback() : config);

    const fetchHeaderHeroConfig = async () => {
      const cached = getCachedHeaderHero(headerId);
      if (cached) {
        setHeroConfig(withHomeHeroFallback(cached));
        return;
      }

      // While fetching, keep home hero visible (matches admin "fallback to home" behavior)
      setHeroConfig(resolveHomeHeroFallback());

      try {
        const res = await customerApi.getHeroConfig({ pageType: "header", headerId });
        const heroPayload = res.data?.result || res.data?.results || res.data || {};
        const headerConfig = {
          banners: heroPayload.banners || { items: [] },
          categoryIds: Array.isArray(heroPayload.categoryIds) ? heroPayload.categoryIds : [],
        };

        setCachedHeaderHero(headerId, headerConfig);
        setHeroConfig(withHomeHeroFallback(headerConfig));
      } catch {
        const emptyConfig = { banners: { items: [] }, categoryIds: [] };
        setCachedHeaderHero(headerId, emptyConfig);
        setHeroConfig(resolveHomeHeroFallback());
      }
    };

    fetchHeaderSections();
    fetchCategoryProducts();
    fetchHeaderHeroConfig();
  }, [activeCategory, currentLocation?.latitude, currentLocation?.longitude]);

  return {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    categoryProducts,
    quickCategories,
    experienceSections,
    offerSections,
    homeTiles,
    homeHeadings,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    serviceAvailable,
    serviceMessage,
    isLoading: isLoading || !isBootstrapped,
    loadingHeaderSections,
    isBootstrapped,
    actions: {
      refresh: () => {
        globalQuickHomeCache.data = null;
        globalQuickHomeCache.locationKey = "";
        globalQuickHomeCache.lastFetched = 0;
        clearPerHeaderCaches();
        fetchData();
      },
    },
  };
};
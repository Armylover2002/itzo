import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { customerApi } from "../services/customerApi";
import { Sparkles } from "lucide-react";

// MUI Icons (shared with admin & icon selector)
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

import { resolveQuickImageUrl } from "../utils/image";

// --- Constants ---
const DEFAULT_CATEGORY_THEME = {
  gradient: "linear-gradient(to bottom, #25D366, #4ADE80)",
  shadow: "shadow-green-500/20",
  accent: "text-[#1A1A1A]",
};

const CATEGORY_METADATA = {
  All: {
    icon: HomeIcon,
    theme: DEFAULT_CATEGORY_THEME,
    banner: { title: "HOUSEFULL", subtitle: "SALE", floatingElements: "sparkles" },
  },
  Grocery: {
    icon: LocalGroceryStoreIcon,
    theme: { gradient: "linear-gradient(to bottom, #FF9F1C, #FFBF69)", shadow: "shadow-orange-500/20", accent: "text-orange-900" },
    banner: { title: "SUPERSAVER", subtitle: "FRESH & FAST", floatingElements: "leaves" },
  },
  Wedding: {
    icon: CardGiftcardIcon,
    theme: { gradient: "linear-gradient(to bottom, #FF4D6D, #FF8FA3)", shadow: "shadow-rose-500/20", accent: "text-rose-900" },
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: KitchenIcon,
    theme: { gradient: "linear-gradient(to bottom, #BC6C25, #DDA15E)", shadow: "shadow-amber-500/20", accent: "text-amber-900" },
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: DevicesIcon,
    theme: { gradient: "linear-gradient(to bottom, #7209B7, #B5179E)", shadow: "shadow-purple-500/20", accent: "text-orange-900" },
    banner: { title: "TECH FEST", subtitle: "GADGETS", floatingElements: "tech" },
  },
  Kids: {
    icon: ChildCareIcon,
    theme: { gradient: "linear-gradient(to bottom, #4CC9F0, #A0E7E5)", shadow: "shadow-blue-500/20", accent: "text-orange-900" },
    banner: { title: "LITTLE ONE", subtitle: "CARE", floatingElements: "bubbles" },
  },
  "Pet Supplies": {
    icon: PetsIcon,
    theme: { gradient: "linear-gradient(to bottom, #FB8500, #FFB703)", shadow: "shadow-yellow-500/20", accent: "text-yellow-900" },
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: SportsSoccerIcon,
    theme: { gradient: "linear-gradient(to bottom, #4361EE, #4895EF)", shadow: "shadow-indigo-500/20", accent: "text-orange-900" },
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
};

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
  art: ColorLensIcon,
  grocery: LocalGroceryStoreIcon,
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: HomeIcon,
  theme: DEFAULT_CATEGORY_THEME,
  headerColor: "#065f46",
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: "text-white",
  },
};

const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";

// --- Global Persistence Cache ---
let globalQuickHomeCache = {
  data: null,
  headerSections: new Map(), // headerId -> sections
  categoryProducts: new Map(), // headerId -> products
  lastFetched: 0,
};

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const useQuickHomeData = ({ currentLocation }) => {
  const hasValidCache = globalQuickHomeCache.data && (Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS);
  
  const [isLoading, setIsLoading] = useState(!hasValidCache);
  const [isBootstrapped, setIsBootstrapped] = useState(hasValidCache);
  const [categories, setCategories] = useState(globalQuickHomeCache.data?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(globalQuickHomeCache.data?.activeCategory || ALL_CATEGORY);
  const [products, setProducts] = useState(globalQuickHomeCache.data?.products || []);
  const [quickCategories, setQuickCategories] = useState(globalQuickHomeCache.data?.quickCategories || []);
  const [experienceSections, setExperienceSections] = useState(globalQuickHomeCache.data?.experienceSections || []);
  const [offerSections, setOfferSections] = useState(globalQuickHomeCache.data?.offerSections || []);
  const [categoryMap, setCategoryMap] = useState(globalQuickHomeCache.data?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(globalQuickHomeCache.data?.subcategoryMap || {});
  const [heroConfig, setHeroConfig] = useState(globalQuickHomeCache.data?.heroConfig || { banners: { items: [] }, categoryIds: [] });
  const [headerSections, setHeaderSections] = useState([]);
  const [loadingHeaderSections, setLoadingHeaderSections] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState(null); // null = use global products

  const fetchDataSeqRef = useRef(0);

  const getQuickCategoryImage = useCallback((category = {}) => {
    const candidate = category?.image || category?.icon || category?.thumbnail || category?.imageUrl || category?.iconUrl || category?.media?.image || category?.media?.url || "";
    return resolveQuickImageUrl(candidate) || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
  }, []);

  const fetchData = useCallback(async () => {
    const seq = ++fetchDataSeqRef.current;
    
    // Use cache if strictly valid
    if (globalQuickHomeCache.data && (Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS)) {
       return;
    }

    setIsLoading(true);
    try {
      const hasValidLocation = Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);
      const productParams = { limit: 20 };
      if (hasValidLocation) {
        productParams.lat = currentLocation.latitude;
        productParams.lng = currentLocation.longitude;
      }

      const [catRes, prodRes, expRes, sectionsRes, heroRes] = await Promise.all([
        customerApi.getCategories().catch((err) => ({ data: { success: false, result: [], error: err } })),
        hasValidLocation ? customerApi.getProducts(productParams).catch((err) => ({ data: { success: false, result: { items: [] }, error: err } })) : Promise.resolve({ data: { success: true, result: { items: [] } } }),
        customerApi.getExperienceSections({ pageType: "home" }).catch(() => null),
        hasValidLocation ? customerApi.getOfferSections({ lat: currentLocation.latitude, lng: currentLocation.longitude }).catch(() => ({ data: {} })) : Promise.resolve({ data: { results: [] } }),
        customerApi.getHeroConfig({ pageType: "home" }).catch(() => null),
      ]);

      if (seq !== fetchDataSeqRef.current) return;

      const newDataCache = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: [],
        offerSections: [],
        heroConfig: { banners: { items: [] }, categoryIds: [] },
        categoryMap: {},
        subcategoryMap: {},
      };

      if (catRes && catRes.data && catRes.data.success) {
        const dbCats = catRes.data.results || catRes.data.result || [];
        const catMap = {};
        const subMap = {};
        dbCats.forEach((c) => {
          if (c.type === "category") catMap[c._id] = c;
          else if (c.type === "subcategory") subMap[c._id] = c;
        });
        setCategoryMap(catMap);
        setSubcategoryMap(subMap);
        newDataCache.categoryMap = catMap;
        newDataCache.subcategoryMap = subMap;

        const formattedHeaders = dbCats.filter((cat) => cat.type === "header").map((cat) => {
          const catName = cat.name;
          const meta = CATEGORY_METADATA[catName] || CATEGORY_METADATA[catName.charAt(0).toUpperCase() + catName.slice(1).toLowerCase()] || CATEGORY_METADATA[catName.toUpperCase()] || {
            icon: Sparkles, theme: DEFAULT_CATEGORY_THEME, banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", floatingElements: "sparkles" }
          };
          const IconComp = (cat.iconId && ICON_COMPONENTS[cat.iconId]) || meta.icon || Sparkles;
          return { ...cat, id: cat._id, iconId: cat.iconId, icon: IconComp, theme: meta.theme, headerColor: cat.headerColor || null, banner: { ...meta.banner, textColor: "text-white" } };
        });

        const allHeaderFromAdmin = formattedHeaders.find(h => (h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all"));
        const mergedAllCategory = allHeaderFromAdmin ? { ...ALL_CATEGORY, headerColor: allHeaderFromAdmin.headerColor || ALL_CATEGORY.headerColor, icon: allHeaderFromAdmin.icon || ALL_CATEGORY.icon } : ALL_CATEGORY;
        const headersWithoutAll = formattedHeaders.filter(h => !((h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all")));
        
        const finalCategories = [mergedAllCategory, ...headersWithoutAll];
        setCategories(finalCategories);
        newDataCache.categories = finalCategories;

        // Restore active category if stored
        let initialActive = mergedAllCategory;
        const storedHeaderReturn = window.sessionStorage.getItem(QUICK_HEADER_RETURN_STORAGE_KEY);
        const storedExpReturn = window.sessionStorage.getItem("experienceReturn");
        
        const restoreId = (storedHeaderReturn && JSON.parse(storedHeaderReturn)?.headerId) || (storedExpReturn && JSON.parse(storedExpReturn)?.headerId);
        if (restoreId) {
            const match = finalCategories.find(h => h._id === restoreId || h.id === restoreId);
            if (match) initialActive = match;
        }
        setActiveCategory(initialActive);
        newDataCache.activeCategory = initialActive;

        const formattedQuickCats = dbCats.filter((cat) => cat.type === "category").map((cat) => ({ id: cat._id, name: cat.name, image: getQuickCategoryImage(cat) }));
        setQuickCategories(formattedQuickCats);
        newDataCache.quickCategories = formattedQuickCats;
      }

      if (prodRes && prodRes.data && prodRes.data.success) {
        const rawResult = prodRes.data.result;
        const dbProds = Array.isArray(prodRes.data.results) ? prodRes.data.results : (Array.isArray(rawResult?.items) ? rawResult.items : (Array.isArray(rawResult) ? rawResult : []));
        const formattedProds = dbProds.map((p) => ({
          ...p, id: p._id, image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
          price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
          originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
          weight: p.weight || "1 unit", deliveryTime: "8-15 mins"
        }));
        setProducts(formattedProds);
        newDataCache.products = formattedProds;
      }

      if (expRes?.data?.success) {
        const raw = expRes.data.result || expRes.data.results || expRes.data;
        const sections = Array.isArray(raw) ? raw : [];
        setExperienceSections(sections);
        newDataCache.experienceSections = sections;
      }

      const sectionsList = sectionsRes?.data?.results || sectionsRes?.data?.result || sectionsRes?.data;
      const offerSecs = Array.isArray(sectionsList) ? sectionsList : [];
      setOfferSections(offerSecs);
      newDataCache.offerSections = offerSecs;

      if (heroRes?.data?.success) {
        const payload = heroRes.data.result || heroRes.data.results || heroRes.data;
        const config = payload && (payload.banners?.items?.length > 0 || payload.categoryIds?.length > 0)
          ? { banners: payload.banners || { items: [] }, categoryIds: payload.categoryIds || [] }
          : { banners: { items: [] }, categoryIds: [] };
        setHeroConfig(config);
        newDataCache.heroConfig = config;
      }

      globalQuickHomeCache.data = newDataCache;
      globalQuickHomeCache.lastFetched = Date.now();
    } catch (error) {
      console.error("Error fetching quick home data:", error);
    } finally {
      if (seq === fetchDataSeqRef.current) {
        setIsBootstrapped(true);
        setIsLoading(false);
      }
    }
  }, [currentLocation, getQuickCategoryImage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch header-specific sections
  useEffect(() => {
    if (!activeCategory || activeCategory._id === "all") {
      setHeaderSections([]);
      setCategoryProducts(null); // reset to global products
      return;
    }

    const headerId = activeCategory._id;

    const fetchHeader = async () => {
      if (globalQuickHomeCache.headerSections.has(headerId)) {
        setHeaderSections(globalQuickHomeCache.headerSections.get(headerId));
      } else {
        setLoadingHeaderSections(true);
        try {
          const res = await customerApi.getExperienceSections({ pageType: "header", headerId });
          if (res.data.success) {
            const raw = res.data.result || res.data.results || res.data;
            const sections = Array.isArray(raw) ? raw : [];
            setHeaderSections(sections);
            globalQuickHomeCache.headerSections.set(headerId, sections);
          }
        } catch (e) {
          console.error("Error fetching header sections:", e);
        } finally {
          setLoadingHeaderSections(false);
        }
      }
    };

    const fetchCategoryProducts = async () => {
      if (globalQuickHomeCache.categoryProducts.has(headerId)) {
        setCategoryProducts(globalQuickHomeCache.categoryProducts.get(headerId));
        return;
      }
      try {
        const res = await customerApi.getProducts({ categoryId: headerId, limit: 50 });
        if (res?.data?.success) {
          const rawResult = res.data.result;
          const dbProds = Array.isArray(res.data.results)
            ? res.data.results
            : Array.isArray(rawResult?.items)
            ? rawResult.items
            : Array.isArray(rawResult)
            ? rawResult
            : [];
          const formatted = dbProds.map((p) => ({
            ...p,
            id: p._id,
            image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
            price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
            originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
            weight: p.weight || "1 unit",
            deliveryTime: "8-15 mins",
          }));
          globalQuickHomeCache.categoryProducts.set(headerId, formatted);
          setCategoryProducts(formatted);
        }
      } catch (e) {
        console.error("Error fetching category products:", e);
      }
    };

    fetchHeader();
    fetchCategoryProducts();
  }, [activeCategory]);

  return {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    categoryProducts, // null when "All" is active, array when a specific category is selected
    quickCategories,
    experienceSections,
    offerSections,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    isLoading: isLoading || !isBootstrapped,
    loadingHeaderSections,
    isBootstrapped,
    actions: {
        refresh: () => {
            globalQuickHomeCache.data = null;
            fetchData();
        }
    }
  };
};

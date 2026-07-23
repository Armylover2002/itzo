import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { customerApi } from "../services/customerApi";
import { Sparkles } from "lucide-react";
import { resolveQuickImageUrl } from "../utils/image";
import { 
  DEFAULT_CATEGORY_THEME, 
  CATEGORY_METADATA, 
  ICON_COMPONENTS, 
  ALL_CATEGORY 
} from "../constants/homeData";

const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";

// --- Global Persistence Cache ---
let globalQuickHomeCache = {
  data: null,
  headerSections: new Map(), // headerId -> sections
  categoryProducts: new Map(), // headerId -> products
  lastFetched: 0,
  hasValidLocation: false,
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

  const lat = currentLocation?.latitude;
  const lng = currentLocation?.longitude;

  const fetchData = useCallback(async () => {
    const seq = ++fetchDataSeqRef.current;
    const hasValidLocation = Number.isFinite(lat) && Number.isFinite(lng);
    
    // Use cache immediately if strictly valid
    if (globalQuickHomeCache.data && (Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS)) {
       // Re-fetch in background if we now have a valid location but cache was built without one
       if (hasValidLocation && !globalQuickHomeCache.hasValidLocation) {
           setIsBootstrapped(true);
           setIsLoading(false);
           // Let execution continue below without setting isLoading to true!
       } else {
           setIsBootstrapped(true);
           setIsLoading(false);
           return;
       }
    }

    if (!globalQuickHomeCache.data) {
      setIsLoading(true);
    } else {
      setIsBootstrapped(true);
      setIsLoading(false);
    }

    try {
      const productParams = { limit: 20 };
      if (hasValidLocation) {
        productParams.lat = lat;
        productParams.lng = lng;
      }

      const [homeRes, catRes, prodRes] = await Promise.all([
        customerApi.getHomeData().catch(() => null),
        customerApi.getCategories().catch((err) => ({ data: { success: false, result: [], error: err } })),
        customerApi.getProducts(productParams).catch((err) => ({ data: { success: false, result: { items: [] }, error: err } })),
      ]);

      if (seq !== fetchDataSeqRef.current) return;

      const homePayload = homeRes?.data?.result || {};

      const newDataCache = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: homePayload.sections || [],
        offerSections: homePayload.offerSections || [],
        heroConfig: homePayload.hero || { banners: { items: [] }, categoryIds: [] },
        categoryMap: {},
        subcategoryMap: {},
      };

      // Process Categories (from catRes or homeData.categories)
      const dbCats = (catRes?.data?.success && (catRes.data.results || catRes.data.result)) || homePayload.categories || [];
      if (Array.isArray(dbCats) && dbCats.length > 0) {
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
        const storedHeaderReturn = typeof window !== "undefined" ? window.sessionStorage.getItem(QUICK_HEADER_RETURN_STORAGE_KEY) : null;
        const storedExpReturn = typeof window !== "undefined" ? window.sessionStorage.getItem("experienceReturn") : null;
        
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

      // Process Products (from prodRes or homePayload.bestSellers)
      const rawProds = (prodRes?.data?.success && (prodRes.data.results || prodRes.data.result?.items || prodRes.data.result)) || homePayload.bestSellers || [];
      const dbProds = Array.isArray(rawProds) ? rawProds : [];
      if (dbProds.length > 0) {
        const formattedProds = dbProds.map((p) => ({
          ...p, id: p._id || p.id, image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
          price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
          originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
          weight: p.weight || "1 unit", deliveryTime: "8-15 mins"
        }));
        setProducts(formattedProds);
        newDataCache.products = formattedProds;
      }

      if (homePayload.sections && Array.isArray(homePayload.sections)) {
        setExperienceSections(homePayload.sections);
      }
      if (homePayload.offerSections && Array.isArray(homePayload.offerSections)) {
        setOfferSections(homePayload.offerSections);
      }
      if (homePayload.hero) {
        setHeroConfig(homePayload.hero);
      }

      globalQuickHomeCache.data = newDataCache;
      globalQuickHomeCache.lastFetched = Date.now();
      if (hasValidLocation) {
        globalQuickHomeCache.hasValidLocation = true;
      }
    } catch (error) {
      console.error("Error fetching quick home data:", error);
    } finally {
      if (seq === fetchDataSeqRef.current) {
        setIsBootstrapped(true);
        setIsLoading(false);
      }
    }
  }, [lat, lng, getQuickCategoryImage]);

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

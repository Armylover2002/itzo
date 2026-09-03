import { useState, useEffect, useMemo, useCallback, useRef, startTransition, useDeferredValue } from "react";
import { publicGetOnce, restaurantAPI, adminAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import * as imgUtils from "@food/utils/imageUtils";

/**
 * Custom hook to manage all data fetching and filtering for the Food Module Home Page.
 * Encapsulates banners, categories, settings, and restaurant filtering logic.
 */
// --- Global Persistence Cache (Outlives Component Lifecycle) ---
let globalHomeCache = {
  bootstrap: null,
  restaurants: null,
  lastFetched: 0,
};

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESTAURANTS_PAGE_SIZE = 20;

export const useFoodHomeData = ({
  zoneId,
  location,
  vegMode,
  backendOrigin,
  availabilityTick,
  // Skips the restaurant fetch entirely until the Food tab is actually active —
  // the Home page also renders the Quick Commerce tab, and there is no reason
  // to pull restaurant data while the customer hasn't opened Food.
  activeTab = "food",
}) => {
  // Use cache as initial state if valid
  const hasValidCache = globalHomeCache.bootstrap && (Date.now() - globalHomeCache.lastFetched < CACHE_EXPIRY_MS);
  
  // --- Bootstrap State ---
  const [isBootstrapped, setIsBootstrapped] = useState(hasValidCache);
  
  // --- Banners State ---
  const [heroBannerImages, setHeroBannerImages] = useState(globalHomeCache.bootstrap?.banners?.images || []);
  const [heroBannersData, setHeroBannersData] = useState(globalHomeCache.bootstrap?.banners?.data || []);
  const [loadingBanners, setLoadingBanners] = useState(!hasValidCache);

  // --- Categories State ---
  const [realCategories, setRealCategories] = useState(globalHomeCache.bootstrap?.categories || []);
  const [loadingRealCategories, setLoadingRealCategories] = useState(!hasValidCache);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [landingCategories, setLandingCategories] = useState([]);
  
  // --- Landing Config State ---
  const [landingExploreMore, setLandingExploreMore] = useState(globalHomeCache.bootstrap?.exploreMore || []);
  const [exploreMoreHeading, setExploreMoreHeading] = useState(globalHomeCache.bootstrap?.settings?.heading || "Explore More");
  const [headerVideoUrl, setHeaderVideoUrl] = useState(globalHomeCache.bootstrap?.settings?.videoUrl || "");
  const [recommendedRestaurantIds, setRecommendedRestaurantIds] = useState(globalHomeCache.bootstrap?.settings?.recommendedIds || []);
  const [recommendedRestaurantsFromSettings, setRecommendedRestaurantsFromSettings] = useState(globalHomeCache.bootstrap?.settings?.recommendedRaw || []);
  const [loadingLandingConfig, setLoadingLandingConfig] = useState(!hasValidCache);

  // --- Restaurants State ---
  const [restaurantsData, setRestaurantsData] = useState(globalHomeCache.restaurants || []);
  const [loadingRestaurants, setLoadingRestaurants] = useState(!globalHomeCache.restaurants);
  const [isLoadingMoreRestaurants, setIsLoadingMoreRestaurants] = useState(false);
  const [restaurantsPage, setRestaurantsPage] = useState(1);
  const [totalRestaurants, setTotalRestaurants] = useState(globalHomeCache.restaurants?.length || 0);
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  
  // ... existing filter state ...
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({
    activeFilters: new Set(),
    sortBy: null,
    selectedCuisine: null,
  });

  // --- Internal Refs ---
  const restaurantsRequestSeqRef = useRef(0);
  const menuUnionRequestSeqRef = useRef(0);
  const menuUnionCacheRef = useRef(new Map());
  const publicCategoriesCacheRef = useRef(new Map());

  // --- Image Helpers ---
  const normalizeImageUrl = useCallback((imageUrl) => 
    imgUtils.normalizeImageUrl(imageUrl, backendOrigin), [backendOrigin]);
  
  const extractImages = useCallback((source) => 
    imgUtils.extractImages(source, backendOrigin), [backendOrigin]);

  const buildRestaurantImageCandidates = useCallback((value) => 
    imgUtils.buildRestaurantImageCandidates(value, backendOrigin), [backendOrigin]);

  const slugifyCategory = imgUtils.slugifyCategory;

  // --- Consolidated Bootstrap Fetch ---
  useEffect(() => {
    let cancelled = false;
    const zoneKey = String(zoneId || "global");

    const fetchBootstrap = async () => {
      // Re-use cache if strictly valid
      if (globalHomeCache.bootstrap && (Date.now() - globalHomeCache.lastFetched < CACHE_EXPIRY_MS)) {
        return;
      }

      // Fire all metadata requests in parallel
      const results = await Promise.allSettled([
        publicGetOnce(zoneId 
          ? `/food/hero-banners/public?zoneId=${encodeURIComponent(String(zoneId))}`
          : "/food/hero-banners/public"
        ),
        (async () => {
          const res = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {});
          const list = res?.data?.data?.categories || res?.data?.categories || [];
          return list.map((cat, idx) => ({
            id: String(cat?.id || cat?._id || cat?.slug || idx),
            name: cat?.name || "",
            slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
            image: normalizeImageUrl(cat?.image || cat?.imageUrl) || foodImages[idx % foodImages.length],
          }));
        })(),
        publicGetOnce("/food/explore-icons/public"),
        publicGetOnce("/food/landing/settings/public"),
      ]);

      if (cancelled) return;

      const newBootstrapCache = { banners: {}, categories: [], exploreMore: [], settings: {} };

      // Process Banners
      if (results[0].status === "fulfilled") {
        const data = results[0].value?.data?.data;
        const list = Array.isArray(data?.banners) ? data.banners : (Array.isArray(data) ? data : []);
        setHeroBannersData(list);
        const imgs = list.map(b => b?.imageUrl).filter(Boolean);
        setHeroBannerImages(imgs);
        newBootstrapCache.banners = { data: list, images: imgs };
      }

      // Process Categories
      if (results[1].status === "fulfilled") {
        const cats = results[1].value;
        setRealCategories(cats);
        newBootstrapCache.categories = cats;
      }

      // Process Explore & Settings
      if (results[2].status === "fulfilled") {
        const exploreData = results[2].value?.data?.data;
        const items = Array.isArray(exploreData?.items) ? exploreData.items : (Array.isArray(exploreData) ? exploreData : []);
        const transformedItems = items.map(it => {
          let href = "/food/user";
          const type = it.linkType || "";
          const target = it.link || it.targetPath || "";

          if (type === 'offers') href = "/user/offers";
          else if (type === 'gourmet') href = "/user/gourmet";
          else if (type === 'collections') href = "/user/collections";
          else if (target) href = target;

          return {
            ...it,
            image: normalizeImageUrl(it.image || it.imageUrl || it.iconUrl || it.icon),
            label: it.label || it.name || "Explore",
            href,
          };
        }).filter(it => it.linkType !== 'top-10' && !it.label?.toLowerCase().includes('top 10'));

        setLandingExploreMore(transformedItems);
        newBootstrapCache.exploreMore = transformedItems;
      }

      if (results[3].status === "fulfilled") {
        const settings = results[3].value?.data?.data || {};
        setExploreMoreHeading(settings.exploreMoreHeading || "Explore More");
        setHeaderVideoUrl(settings.headerVideoUrl || "");
        setRecommendedRestaurantIds(settings.recommendedRestaurantIds || []);
        setRecommendedRestaurantsFromSettings(settings.recommendedRestaurants || []);
        newBootstrapCache.settings = {
          heading: settings.exploreMoreHeading,
          videoUrl: settings.headerVideoUrl,
          recommendedIds: settings.recommendedRestaurantIds,
          recommendedRaw: settings.recommendedRestaurants,
        };
      }

      // Update global cache
      globalHomeCache.bootstrap = newBootstrapCache;
      globalHomeCache.lastFetched = Date.now();

      setLoadingBanners(false);
      setLoadingRealCategories(false);
      setLoadingLandingConfig(false);
      setIsBootstrapped(true);
    };

    fetchBootstrap();
    return () => { cancelled = true; };
  }, [zoneId, normalizeImageUrl]);

  // --- Fetch Restaurants (server-paginated — a home page never needs 1000
  // restaurants in one response; more is fetched on demand via "load more") ---
  const fetchRestaurants = useCallback(async (filters = {}, page = 1, append = false) => {
    const requestSeq = ++restaurantsRequestSeqRef.current;
    try {
      if (append) setIsLoadingMoreRestaurants(true);
      else setLoadingRestaurants(true);

      const params = { limit: RESTAURANTS_PAGE_SIZE, page };
      if (Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)) {
        params.lat = location.latitude;
        params.lng = location.longitude;
      }
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.selectedCuisine) params.cuisine = filters.selectedCuisine;
      if (zoneId) params.zoneId = zoneId;

      // Map local active filters to API params
      if (filters.activeFilters?.has("rating-45-plus")) params.minRating = 4.5;
      else if (filters.activeFilters?.has("rating-4-plus")) params.minRating = 4.0;

      const response = await restaurantAPI.getRestaurants(params);
      if (requestSeq !== restaurantsRequestSeqRef.current) return;

      if (response.data?.success && response.data?.data?.restaurants) {
        const transformed = response.data.data.restaurants.map(restaurant => {
          const profileImageCandidates = buildRestaurantImageCandidates(restaurant.profileImage || restaurant.image);
          const coverImages = extractImages(restaurant.coverImages || restaurant.coverImage);
          const allImages = Array.from(new Set([...profileImageCandidates, ...coverImages].filter(Boolean)));

          return {
            id: restaurant.restaurantId || restaurant._id,
            mongoId: restaurant._id,
            name: restaurant.restaurantName || restaurant.name || "Restaurant",
            cuisine: restaurant.cuisines?.[0] || "Multi-cuisine",
            rating: Number(restaurant.rating) || 0,
            deliveryTime: restaurant.estimatedDeliveryTime || "25-30 mins",
            distance: restaurant.distanceInKm
              ? `${restaurant.distanceInKm} km`
              : (restaurant.distance ? String(restaurant.distance).includes("km") ? restaurant.distance : `${restaurant.distance} km` : `${(2 + Math.random()).toFixed(1)} km`),
            featuredDish: restaurant.featuredDish || "Special Dish",
            featuredPrice: restaurant.featuredPrice || (restaurant.restaurantName === "Sayaji" ? "249" : "199"),
            image: allImages[0] || "",
            images: allImages,
            pureVegRestaurant: restaurant.pureVegRestaurant === true,
            location: restaurant.location,
            offer: restaurant.offer,
            slug: restaurant.slug,
            // Timing fields for availability status
            openingTime: restaurant.openingTime,
            closingTime: restaurant.closingTime,
            outletTimings: restaurant.outletTimings,
            deliveryTimings: restaurant.deliveryTimings,
            openDays: restaurant.openDays,
            isActive: restaurant.isActive,
            isAcceptingOrders: restaurant.isAcceptingOrders,
          };
        });

        const total = Number(response.data?.data?.total ?? transformed.length);

        startTransition(() => {
          setRestaurantsData((prev) => {
            const next = append ? [...prev, ...transformed] : transformed;
            globalHomeCache.restaurants = next;
            return next;
          });
          setTotalRestaurants(total);
          setRestaurantsPage(page);
        });
      }
    } catch (err) {
      if (!append) setRestaurantsData([]);
    } finally {
      if (requestSeq === restaurantsRequestSeqRef.current) {
        setLoadingRestaurants(false);
        setIsLoadingMoreRestaurants(false);
      }
    }
  }, [location, zoneId, buildRestaurantImageCandidates, extractImages]);

  useEffect(() => {
    if (activeTab !== "food") {
      // Nothing on the Quick Commerce tab needs restaurant data — skip the
      // network call entirely instead of fetching it just to hide it with CSS.
      setLoadingRestaurants(false);
      return;
    }
    fetchRestaurants(appliedFilters, 1, false);
  }, [appliedFilters, fetchRestaurants, activeTab]);

  // --- Menu Context Fetching (Veg Mode) ---
  const menuUnionRestaurantIdsKey = restaurantsData.map(r => r.mongoId || r.id).join(",");
  useEffect(() => {
    const restaurantIds = menuUnionRestaurantIdsKey.split(",").filter(Boolean);
    const shouldFetchMenuMeta = vegMode || realCategories.length === 0;
    if (!menuUnionRestaurantIdsKey || !shouldFetchMenuMeta) {
      setMenuCategories([]);
      return;
    }

    const fetchMenu = async () => {
      const requestSeq = ++menuUnionRequestSeqRef.current;
      setLoadingMenuCategories(true);
      try {
        const categoryMap = new Map();
        for (let i = 0; i < restaurantIds.length; i += 4) {
          const batch = restaurantIds.slice(i, i + 4);
          const res = await Promise.all(batch.map(async id => {
            if (menuUnionCacheRef.current.has(id)) return menuUnionCacheRef.current.get(id);
            try {
              const r = await restaurantAPI.getMenuByRestaurantId(id);
              const m = r.data?.data?.menu || null;
              menuUnionCacheRef.current.set(id, m);
              return m;
            } catch { return null; }
          }));
          if (requestSeq !== menuUnionRequestSeqRef.current) return;
          
          res.forEach(menu => {
            if (!menu?.sections) return;
            menu.sections.forEach(section => {
              const slug = slugifyCategory(section.name);
              if (!slug) return;
              if (!categoryMap.has(slug)) {
                categoryMap.set(slug, {
                  id: slug,
                  name: section.name,
                  slug,
                  image: normalizeImageUrl(section.items?.[0]?.image) || "",
                });
              }
            });
          });
        }
        setMenuCategories(Array.from(categoryMap.values()));
      } finally {
        if (requestSeq === menuUnionRequestSeqRef.current) setLoadingMenuCategories(false);
      }
    };
    fetchMenu();
  }, [menuUnionRestaurantIdsKey, vegMode, realCategories.length, normalizeImageUrl, slugifyCategory]);

  const deferredRestaurants = useDeferredValue(restaurantsData);

  // --- Memoized Derived Data ---
  const filteredRestaurants = useMemo(() => {
    // If vegMode is 'pure', only show 100% vegetarian restaurants.
    // If vegMode is 'all' or false, show all restaurants (dish level filtering handles 'all' mode).
    let filtered = [...deferredRestaurants].filter(r => vegMode !== "pure" || r.pureVegRestaurant);
    
    // Compute availability status for sorting rather than strictly filtering out closed ones
    filtered = filtered.map(r => {
      const status = getRestaurantAvailabilityStatus(r, new Date(availabilityTick), { ignoreOperationalStatus: false });
      return { ...r, _isOpen: status.isOpen };
    });

    // Apply sorting: Open restaurants first, then by rating
    filtered.sort((a, b) => {
      if (a._isOpen !== b._isOpen) {
        return a._isOpen ? -1 : 1;
      }
      if (sortBy === "rating-high") {
        return b.rating - a.rating;
      }
      // Default: Rating
      return b.rating - a.rating;
    });
    return filtered;
  }, [deferredRestaurants, vegMode, sortBy, availabilityTick]);

  const displayCategories = useMemo(() => {
    if (realCategories.length > 0) return realCategories;
    if (menuCategories.length > 0) return menuCategories;
    return (landingCategories || []).map((cat, idx) => ({
      ...cat,
      image: normalizeImageUrl(cat.image) || foodImages[idx % foodImages.length],
    }));
  }, [realCategories, menuCategories, landingCategories, normalizeImageUrl]);

  const recommendedForYouRestaurants = useMemo(() => {
    const fetchedByMongoId = new Map(restaurantsData.map(r => [String(r.mongoId || r.id), r]));
    return recommendedRestaurantsFromSettings
      .map(r => fetchedByMongoId.get(String(r._id || r.restaurantId)))
      .filter(Boolean)
      .slice(0, 12);
  }, [restaurantsData, recommendedRestaurantsFromSettings]);

  // --- Actions ---
  const toggleFilter = useCallback((filterId) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  }, []);

  const applyFiltersAndRefetch = useCallback(async (nextFilters, nextSortBy, nextCuisine) => {
    const state = { activeFilters: new Set(nextFilters), sortBy: nextSortBy, selectedCuisine: nextCuisine };
    setAppliedFilters(state);
    setIsLoadingFilterResults(true);
    await fetchRestaurants(state, 1, false);
    setIsLoadingFilterResults(false);
  }, [fetchRestaurants]);

  // Fetches the next page from the server instead of merely revealing more of
  // an already-fully-downloaded list — the initial load only pulls 20 rows.
  const loadMoreRestaurants = useCallback(() => {
    if (isLoadingMoreRestaurants || restaurantsData.length >= totalRestaurants) return;
    fetchRestaurants(appliedFilters, restaurantsPage + 1, true);
  }, [fetchRestaurants, appliedFilters, restaurantsPage, isLoadingMoreRestaurants, restaurantsData.length, totalRestaurants]);

  return {
    banners: { images: heroBannerImages, data: heroBannersData, loading: loadingBanners },
    categories: { display: displayCategories, loading: loadingRealCategories || loadingMenuCategories },
    restaurants: {
      visible: filteredRestaurants,
      loading: loadingRestaurants,
      isLoadingFilterResults,
      isLoadingMore: isLoadingMoreRestaurants,
      hasMore: restaurantsData.length < totalRestaurants,
    },
    landing: { exploreMore: landingExploreMore, heading: exploreMoreHeading, loading: loadingLandingConfig, videoUrl: headerVideoUrl },
    meta: { recommended: recommendedForYouRestaurants },
    actions: { toggleFilter, applyFiltersAndRefetch, loadMoreRestaurants },
    state: { activeFilters, sortBy, setSortBy, selectedCuisine, setSelectedCuisine, isBootstrapped }
  };
};

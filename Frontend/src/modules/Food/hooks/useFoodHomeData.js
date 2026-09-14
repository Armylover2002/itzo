import { useState, useEffect, useMemo, useCallback, useRef, startTransition, useDeferredValue } from "react";
import { publicGetOnce, restaurantAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { filterCategoriesForVegMode } from "@food/utils/categoryVegFilter";
import * as imgUtils from "@food/utils/imageUtils";
import { parseGeoPoint } from "@food/utils/geo";

/**
 * Custom hook to manage all data fetching and filtering for the Food Module Home Page.
 * Encapsulates banners, categories, settings, and restaurant filtering logic.
 */
let globalHomeCache = {
  bootstrap: null,
  restaurants: null,
  advertisements: null,
  lastFetched: Date.now(),
};

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/** Bust in-memory home restaurant cache after distance fixes. */
export function invalidateFoodHomeRestaurantCache() {
  globalHomeCache.restaurants = null;
  globalHomeCache.lastFetched = 0;
}

export const useFoodHomeData = ({ 
  zoneId, 
  location, 
  vegMode, 
  backendOrigin,
  availabilityTick,
  enabled = true 
}) => {
  // Use cache as initial state if valid
  const cachedCategories = globalHomeCache.bootstrap?.categories || [];
  const cacheHasLiveItemCounts = cachedCategories.every(
    (cat) => cat && typeof cat.itemCount === "number" && typeof cat.nonVegItemCount === "number"
  );
  const hasValidCache =
    globalHomeCache.bootstrap &&
    cacheHasLiveItemCounts &&
    (Date.now() - globalHomeCache.lastFetched < CACHE_EXPIRY_MS);
  
  // --- Bootstrap State ---
  const [isBootstrapped, setIsBootstrapped] = useState(hasValidCache);
  
  // --- Banners State ---
  const [heroBannerImages, setHeroBannerImages] = useState(globalHomeCache.bootstrap?.banners?.images || []);
  const [heroBannersData, setHeroBannersData] = useState(globalHomeCache.bootstrap?.banners?.data || []);
  const [loadingBanners, setLoadingBanners] = useState(!hasValidCache);

  // --- Advertisements State ---
  const [advertisements, setAdvertisements] = useState(globalHomeCache.bootstrap?.advertisements || []);

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
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(6);
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
    if (!enabled) return;
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
          // Routed through publicGetOnce (same in-flight + TTL cache used by the other
          // bootstrap calls in this Promise.allSettled) so StrictMode's dev double-mount
          // and rapid re-mounts don't fire this request twice, unlike the previous
          // direct adminAPI.getPublicCategories() call which had no dedup.
          const res = await publicGetOnce("/food/restaurant/categories/public", {
            params: zoneId ? { zoneId } : {},
          });
          const list = res?.data?.data?.categories || res?.data?.categories || [];
          return list.map((cat, idx) => ({
            id: String(cat?.id || cat?._id || cat?.slug || idx),
            name: cat?.name || "",
            slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
            image: normalizeImageUrl(cat?.image || cat?.imageUrl) || foodImages[idx % foodImages.length],
            foodTypeScope: cat?.foodTypeScope || "",
            itemCount: Number(cat?.itemCount) || 0,
            vegItemCount: Number(cat?.vegItemCount) || 0,
            nonVegItemCount: Number(cat?.nonVegItemCount) || 0,
            pureVegItemCount: Number(cat?.pureVegItemCount) || 0,
          }));
        })(),
        publicGetOnce("/food/explore-icons/public"),
        publicGetOnce("/food/landing/settings/public"),
        publicGetOnce("/food/advertisements/public"),
      ]);

      if (cancelled) return;

      const newBootstrapCache = { banners: {}, categories: [], exploreMore: [], settings: {}, advertisements: [] };

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

      if (results[4].status === "fulfilled") {
        const adsData = results[4].value?.data?.data?.advertisements || [];
        setAdvertisements(adsData);
        newBootstrapCache.advertisements = adsData;
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
  }, [zoneId, normalizeImageUrl, enabled]);

  // --- Fetch Restaurants ---
  // `location` is read via a ref (kept in sync below) rather than as a useCallback
  // dependency: Home resolves location progressively (cached -> saved address -> live
  // GPS), producing several new object references for coordinates that often round to
  // the same value. Depending on the object directly gave fetchRestaurants a new
  // identity on every one of those updates, re-firing the limit=1000 restaurants
  // request each time. Depending on the rounded lat/lng string instead means the
  // identity — and the effect below — only changes when coordinates actually move.
  const locationRef = useRef(location);
  locationRef.current = location;
  const roundedOriginKey = useMemo(() => {
    const lat = Number(location?.latitude ?? location?.lat);
    const lng = Number(location?.longitude ?? location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }, [location?.latitude, location?.lat, location?.longitude, location?.lng]);

  const fetchRestaurants = useCallback(async (filters = {}) => {
    const requestSeq = ++restaurantsRequestSeqRef.current;
    try {
      setLoadingRestaurants(true);
      const params = {};
      const currentLocation = locationRef.current;
      const origin = parseGeoPoint(currentLocation) || (
        Number.isFinite(Number(currentLocation?.latitude ?? currentLocation?.lat)) &&
        Number.isFinite(Number(currentLocation?.longitude ?? currentLocation?.lng))
          ? {
              lat: Number(currentLocation.latitude ?? currentLocation.lat),
              lng: Number(currentLocation.longitude ?? currentLocation.lng),
            }
          : null
      );
      if (origin) {
        params.lat = origin.lat;
        params.lng = origin.lng;
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
          const profileImageCandidates = buildRestaurantImageCandidates(restaurant.profileImage || restaurant.image || restaurant.imageUrl || restaurant.logo);
          const coverImages = extractImages(restaurant.coverImages || restaurant.coverImage);
          const allImages = Array.from(new Set([...profileImageCandidates, ...coverImages].filter(Boolean)));
          
          return {
            id: restaurant.restaurantId || restaurant._id,
            mongoId: restaurant._id,
            name: restaurant.restaurantName || restaurant.name || "Restaurant",
            cuisine: restaurant.cuisines?.[0] || "Multi-cuisine",
            rating: Number(restaurant.rating) || 0,
            deliveryTime: restaurant.estimatedDeliveryTime || "25-30 mins",
            distance: restaurant.distanceInKm != null && Number.isFinite(Number(restaurant.distanceInKm))
              ? `${Number(restaurant.distanceInKm).toFixed(1)} km`
              : (restaurant.distance ? String(restaurant.distance).includes("km") ? restaurant.distance : `${restaurant.distance} km` : null),
            featuredDish: restaurant.featuredDish,
            featuredPrice: restaurant.featuredPrice,
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

        startTransition(() => {
          setRestaurantsData(transformed);
          globalHomeCache.restaurants = transformed;
        });
      }
    } catch (err) {
      setRestaurantsData([]);
    } finally {
      if (requestSeq === restaurantsRequestSeqRef.current) setLoadingRestaurants(false);
    }
  }, [roundedOriginKey, zoneId, buildRestaurantImageCandidates, extractImages]);

  useEffect(() => {
    if (!enabled) return;
    // Debounced so several location updates arriving in quick succession during
    // progressive GPS resolution collapse into a single limit=1000 restaurants
    // request instead of one per intermediate coordinate update (mirrors the
    // debounce useZone.jsx already uses for the same resolution sequence).
    const timer = setTimeout(() => {
      fetchRestaurants(appliedFilters);
    }, 300);
    return () => clearTimeout(timer);
  }, [appliedFilters, fetchRestaurants, enabled]);

  // Memoized stable string key — prevents .join() re-computation on every render
  const menuUnionRestaurantIdsKey = useMemo(
    () => restaurantsData.map(r => r.mongoId || r.id).join(","),
    [restaurantsData]
  );

  // Menu-union is only a fallback when the public categories API returned nothing.
  // Live veg/non-veg filtering now uses the item counts on each category, so flipping
  // the VEG toggle must not fire a menus/batch request just to rebuild the same rail.
  useEffect(() => {
    if (!enabled) {
      setMenuCategories([]);
      return;
    }
    const restaurantIds = menuUnionRestaurantIdsKey.split(",").filter(Boolean);
    if (!menuUnionRestaurantIdsKey || realCategories.length > 0) {
      setMenuCategories([]);
      return;
    }

    const fetchMenu = async () => {
      const requestSeq = ++menuUnionRequestSeqRef.current;
      setLoadingMenuCategories(true);
      try {
        const categoryMap = new Map();
        const uncachedIds = restaurantIds.filter((id) => !menuUnionCacheRef.current.has(id));

        if (uncachedIds.length > 0) {
          const batchRes = await restaurantAPI.getMenusBatch(uncachedIds);
          if (requestSeq !== menuUnionRequestSeqRef.current) return;

          const menus = batchRes.data?.data?.menus || batchRes.data?.menus || {};
          Object.entries(menus).forEach(([id, menu]) => {
            menuUnionCacheRef.current.set(id, menu);
          });
        }

        restaurantIds.forEach((id) => {
          const menu = menuUnionCacheRef.current.get(id);
          if (!menu?.sections) return;
          menu.sections.forEach((section) => {
            const slug = slugifyCategory(section.name);
            if (!slug) return;
            if (!categoryMap.has(slug)) {
              categoryMap.set(slug, {
                id: slug,
                name: section.name,
                slug,
                image: normalizeImageUrl(section.image || section.items?.[0]?.image) || "",
              });
            }
          });
        });

        setMenuCategories(Array.from(categoryMap.values()));
      } finally {
        if (requestSeq === menuUnionRequestSeqRef.current) setLoadingMenuCategories(false);
      }
    };
    fetchMenu();
  }, [menuUnionRestaurantIdsKey, realCategories.length, normalizeImageUrl, slugifyCategory, enabled]);

  const deferredRestaurants = useDeferredValue(restaurantsData);

  // --- Memoized Derived Data ---
  const filteredRestaurants = useMemo(() => {
    // If vegMode is 'pure', only show 100% vegetarian restaurants.
    // If vegMode is 'all' or false, show all restaurants (dish level filtering handles 'all' mode).
    let filtered = [...deferredRestaurants].filter(r => vegMode !== "pure" || r.pureVegRestaurant);
    
    // Apply local filters (Delivery Time)
    if (activeFilters?.has("delivery-under-30")) {
      filtered = filtered.filter(r => {
        const match = String(r.deliveryTime).match(/\d+/g);
        const maxMins = match ? Math.max(...match.map(Number)) : 999;
        return maxMins <= 30;
      });
    }
    if (activeFilters?.has("delivery-under-45")) {
      filtered = filtered.filter(r => {
        const match = String(r.deliveryTime).match(/\d+/g);
        const maxMins = match ? Math.max(...match.map(Number)) : 999;
        return maxMins <= 45;
      });
    }
    
    // Apply local filters (Distance)
    if (activeFilters?.has("distance-under-1km")) {
      filtered = filtered.filter(r => {
        const distNum = parseFloat(String(r.distance).replace(/[^\d.]/g, ''));
        return !isNaN(distNum) && distNum <= 1;
      });
    }
    if (activeFilters?.has("distance-under-2km")) {
      filtered = filtered.filter(r => {
        const distNum = parseFloat(String(r.distance).replace(/[^\d.]/g, ''));
        return !isNaN(distNum) && distNum <= 2;
      });
    }
    
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
      if (sortBy === "delivery-time") {
        const aMatch = String(a.deliveryTime).match(/\d+/g);
        const bMatch = String(b.deliveryTime).match(/\d+/g);
        const aMin = aMatch ? Math.min(...aMatch.map(Number)) : 999;
        const bMin = bMatch ? Math.min(...bMatch.map(Number)) : 999;
        return aMin - bMin;
      }
      // Default: Rating
      return b.rating - a.rating;
    });
    return filtered;
  }, [deferredRestaurants, vegMode, sortBy, availabilityTick, activeFilters]);

  const visibleRestaurants = useMemo(() => 
    filteredRestaurants.slice(0, visibleRestaurantCount), [filteredRestaurants, visibleRestaurantCount]);

  const displayCategories = useMemo(() => {
    const base = realCategories.length > 0
      ? realCategories
      : menuCategories.length > 0
        ? menuCategories
        : (landingCategories || []).map((cat, idx) => ({
          ...cat,
          image: normalizeImageUrl(cat.image) || foodImages[idx % foodImages.length],
        }));

    // Veg mode must not surface categories the user cannot order anything from.
    return filterCategoriesForVegMode(base, vegMode);
  }, [realCategories, menuCategories, landingCategories, normalizeImageUrl, vegMode]);

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
    await fetchRestaurants(state);
    setIsLoadingFilterResults(false);
  }, [fetchRestaurants]);

  const loadMoreRestaurants = useCallback(() => {
    setVisibleRestaurantCount(prev => Math.min(prev + 6, filteredRestaurants.length));
  }, [filteredRestaurants.length]);

  return {
    banners: { images: heroBannerImages, data: heroBannersData, loading: loadingBanners },
    categories: { display: displayCategories, loading: loadingRealCategories || loadingMenuCategories },
    restaurants: { 
      visible: visibleRestaurants, 
      loading: loadingRestaurants, 
      isLoadingFilterResults,
      hasMore: visibleRestaurantCount < filteredRestaurants.length 
    },
    landing: { exploreMore: landingExploreMore, heading: exploreMoreHeading, loading: loadingLandingConfig, videoUrl: headerVideoUrl },
    meta: { recommended: recommendedForYouRestaurants },
    advertisements: advertisements,
    actions: { toggleFilter, applyFiltersAndRefetch, loadMoreRestaurants },
    state: { activeFilters, sortBy, setSortBy, selectedCuisine, setSelectedCuisine, isBootstrapped }
  };
};

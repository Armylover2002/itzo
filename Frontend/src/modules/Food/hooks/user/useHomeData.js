import { useState, useCallback, useEffect, useMemo } from 'react';
import { restaurantAPI } from "@food/api";
import { normalizeImageUrl, extractImages, slugify } from "@food/utils/common";
import { getRoadDistancesToDestination } from "@/shared/services/roadDistance";

export const useHomeData = (location, zoneId) => {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [landingCategories, setLandingCategories] = useState([]);
  const [exploreMoreItems, setExploreMoreItems] = useState([]);
  const [exploreMoreHeading, setExploreMoreHeading] = useState("Explore More");
  
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [heroBannerImages, setHeroBannerImages] = useState([]);
  const [heroBannersData, setHeroBannersData] = useState([]);

  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [recommendedRestaurants, setRecommendedRestaurants] = useState([]);
  
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [restaurantDietMeta, setRestaurantDietMeta] = useState({});

  // Old backend endpoints (hero banners / landing config) are not used anymore.
  // Keep UI stable by setting safe defaults once.
  const initLandingConfig = useCallback(() => {
    setLoadingConfig(true);
    setLandingCategories([]);
    setExploreMoreItems([]);
    setExploreMoreHeading("Explore More");
    setRecommendedRestaurants([]);
    setLoadingConfig(false);
  }, []);

  const initBanners = useCallback(() => {
    setLoadingBanners(true);
    setHeroBannersData([]);
    setHeroBannerImages([]);
    setLoadingBanners(false);
  }, []);

  const fetchRestaurants = useCallback(async (filters = {}) => {
    try {
      setLoadingRestaurants(true);
      const params = {
        _ts: Date.now(),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.cuisine && { cuisine: filters.cuisine }),
        ...(zoneId && { zoneId })
      };
      const res = await restaurantAPI.getRestaurants(params);
      if (res.data?.success) {
        const raw = res.data.data.restaurants || [];
        const userLat = location?.latitude;
        const userLng = location?.longitude;

        const restaurantCoords = raw.map((r) => {
          const rLoc = r.location;
          const rLat = rLoc?.latitude || (rLoc?.coordinates?.[1]);
          const rLng = rLoc?.longitude || (rLoc?.coordinates?.[0]);
          return { lat: rLat, lng: rLng };
        });

        const roadDistances = (userLat != null && userLng != null)
          ? await getRoadDistancesToDestination(restaurantCoords, userLat, userLng)
          : [];

        const transformed = raw.map((r, index) => {
          const rLoc = r.location;
          const rLat = rLoc?.latitude || (rLoc?.coordinates?.[1]);
          const rLng = rLoc?.longitude || (rLoc?.coordinates?.[0]);
          
          const distInKm = Number.isFinite(r.distanceInKm)
            ? r.distanceInKm
            : (roadDistances[index] ?? null);
          const coverImgs = extractImages(r.coverImages);
          const menuImgs = extractImages(r.menuImages);
          const profileImgs = extractImages(r.profileImage || r.image);
          const allImgs = Array.from(new Set([...coverImgs, ...menuImgs, ...profileImgs]));

          return {
            ...r,
            id: r.restaurantId || r._id,
            mongoId: r._id,
            distanceInKm: distInKm,
            image: allImgs[0] || "",
            images: allImgs,
            rating: r.rating || 4.5,
            cuisine: r.cuisines?.[0] || "Multi-cuisine"
          };
        });
        setRestaurantsData(transformed);
      }
    } finally {
      setLoadingRestaurants(false);
    }
  }, [location, zoneId]);

  const fetchMenuMeta = useCallback(async () => {
    if (!restaurantsData.length) return;
    setLoadingMenuCategories(true);
    try {
      const categoryMap = new Map();
      const dietMeta = {};

      const menuResponses = await Promise.all(
        restaurantsData.slice(0, 50).map(async (r) => {
          try {
            const res = await restaurantAPI.getMenuByRestaurantId(r.id);
            return { id: r.id, menu: res?.data?.data?.menu };
          } catch {
            return { id: r.id, menu: null };
          }
        })
      );

      menuResponses.forEach(({ id, menu }) => {
        let hasVeg = false, hasNonVeg = false;
        const sections = menu?.sections || [];
        sections.forEach(s => {
          const items = s.items || [];
          items.forEach(i => {
            const type = String(i.foodType || "").toLowerCase();
            if (type === "veg") hasVeg = true;
            if (type.includes("non")) hasNonVeg = true;
          });
          const slug = slugify(s.name);
          if (slug && !categoryMap.has(slug)) {
            categoryMap.set(slug, {
              id: slug, name: s.name, slug, label: s.name,
              image: items[0]?.image ? normalizeImageUrl(items[0].image) : ""
            });
          }
        });
        dietMeta[id] = { hasVeg, hasNonVeg, isPureVeg: hasVeg && !hasNonVeg };
      });

      setMenuCategories(Array.from(categoryMap.values()));
      setRestaurantDietMeta(dietMeta);
    } finally {
      setLoadingMenuCategories(false);
    }
  }, [restaurantsData]);

  useEffect(() => {
    initLandingConfig();
    initBanners();
  }, [initLandingConfig, initBanners]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  useEffect(() => {
    fetchMenuMeta();
  }, [fetchMenuMeta]);

  return {
    loadingConfig, landingCategories, exploreMoreItems, exploreMoreHeading, recommendedRestaurants,
    loadingBanners, heroBannerImages, heroBannersData,
    loadingRestaurants, restaurantsData, setRestaurantsData,
    loadingMenuCategories, menuCategories, restaurantDietMeta,
    fetchRestaurants
  };
};

import { useState, useCallback, useEffect, useMemo } from 'react';
import { adminAPI, restaurantAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import { normalizeImageUrl } from "@food/utils/common";
import { useProfile } from "@food/context/ProfileContext";
import { isCategoryVisibleForVegMode } from "@food/utils/categoryVegFilter";

export const useCategoryData = (zoneId) => {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [categoryKeywords, setCategoryKeywords] = useState({});
  const { vegMode } = useProfile();

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {});
      if (response.data?.success) {
        const cats = response.data.data.categories || [];
        const transformed = [
          { id: 'all', name: "All", image: null, slug: 'all' },
          ...cats.map((cat) => ({
            id: cat.slug || cat._id,
            name: cat.name,
            image: cat.image || foodImages[0],
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
            foodTypeScope: cat.foodTypeScope || "",
            itemCount: Number(cat.itemCount) || 0,
            vegItemCount: Number(cat.vegItemCount) || 0,
            nonVegItemCount: Number(cat.nonVegItemCount) || 0,
            pureVegItemCount: Number(cat.pureVegItemCount) || 0,
          }))
        ];
        setCategories(transformed);

        const keywordsMap = {};
        cats.forEach((cat) => {
          const id = cat.slug || cat._id;
          const name = cat.name.toLowerCase();
          const words = name.split(/[\s-]+/).filter(w => w.length > 0);
          keywordsMap[id] = [name, ...words];
        });
        setCategoryKeywords(keywordsMap);
      }
    } catch (err) {
      console.error("Failed to fetch categories", err);
    } finally {
      setLoadingCategories(false);
    }
  }, [zoneId]);

  const fetchRestaurants = useCallback(async () => {
    try {
      setLoadingRestaurants(true);
      const params = zoneId ? { zoneId } : {};
      const response = await restaurantAPI.getRestaurants(params);
      if (response.data?.success) {
        const raw = response.data.data.restaurants || [];
        const transformed = raw.map(r => ({
          ...r,
          id: r.restaurantId || r._id,
          image: normalizeImageUrl(r.profileImage?.url || r.image),
          slug: r.slug || r.name?.toLowerCase().replace(/\s+/g, '-')
        }));
        setRestaurantsData(transformed);
      }
    } catch (err) {
      console.error("Failed to fetch restaurants", err);
    } finally {
      setLoadingRestaurants(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchCategories();
    fetchRestaurants();
  }, [fetchCategories, fetchRestaurants]);

  const visibleCategories = useMemo(() => {
    if (!vegMode) return categories;
    return categories.filter(
      (cat) => cat.slug === 'all' || isCategoryVisibleForVegMode(cat, vegMode)
    );
  }, [categories, vegMode]);

  return {
    categories: visibleCategories, loadingCategories,
    restaurantsData, loadingRestaurants,
    categoryKeywords
  };
};

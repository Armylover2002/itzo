import { useState, useCallback, useEffect } from 'react';
import { restaurantAPI } from "@food/api";

export const useUnder250Data = (zoneId) => {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [restRes] = await Promise.all([
        restaurantAPI.getUnder250Restaurants(zoneId ? { zoneId } : {}),
      ]);

      if (restRes.data?.success) setRestaurants(restRes.data.data.restaurants || []);
      // Old backend endpoints (categories + under-250 banner) removed.
      setCategories([]);
      setBanner(null);
    } catch (err) {
      console.error("Failed to fetch Under 250 data", err);
    } finally {
      setLoading(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { restaurants, categories, banner, loading };
};

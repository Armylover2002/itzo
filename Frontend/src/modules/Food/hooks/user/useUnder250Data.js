import { useState, useCallback, useEffect } from 'react';
import { restaurantAPI } from "@food/api";

export const useUnder250Data = (zoneId, lat, lng) => {
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (zoneId) params.zoneId = zoneId;
      if (lat) params.lat = lat;
      if (lng) params.lng = lng;

      const [restRes] = await Promise.all([
        restaurantAPI.getUnder250Restaurants(params),
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
  }, [zoneId, lat, lng]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { restaurants, categories, banner, loading };
};

import { useState, useCallback, useEffect } from 'react';
import { restaurantAPI } from "@food/api";

export const useStreetFoodData = (zoneId) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { businessType: 'Street Food Vendor', ...(zoneId ? { zoneId } : {}) };
      const res = await restaurantAPI.getRestaurants(params);
      const list = Array.isArray(res?.data?.data?.restaurants)
        ? res.data.data.restaurants
        : (Array.isArray(res?.data?.data) ? res.data.data : []);
      setRestaurants(list);
    } catch (err) {
      console.error("Failed to fetch Street Food vendors", err);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, [zoneId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { restaurants, loading, refetch: fetchData };
};

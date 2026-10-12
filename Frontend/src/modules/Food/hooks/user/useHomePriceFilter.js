import { useEffect, useState } from "react";
import { restaurantAPI } from "@food/api";

/**
 * Admin-controlled "Meals under ₹X" section: returns the section config and a flat list of
 * items (each carrying its restaurant) priced at or below the admin-set limit.
 */
export default function useHomePriceFilter({ zoneId, latitude, longitude, enabled = true } = {}) {
  const [section, setSection] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const fetchItems = async () => {
      try {
        setLoading(true);
        const params = { radiusKm: 15 };
        if (zoneId) params.zoneId = zoneId;
        if (latitude) params.lat = latitude;
        if (longitude) params.lng = longitude;

        const response = await restaurantAPI.getHomePriceFilterRestaurants(params);
        if (cancelled) return;

        const data = response?.data?.data || {};
        const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
        const flatItems = restaurants.flatMap(({ menuItems = [], ...restaurant }) =>
          menuItems.map((item) => ({ ...item, restaurant })),
        );

        setSection(data.section || null);
        setItems(flatItems);
      } catch {
        if (!cancelled) {
          setSection(null);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [zoneId, latitude, longitude, enabled]);

  return { section, items, loading };
}

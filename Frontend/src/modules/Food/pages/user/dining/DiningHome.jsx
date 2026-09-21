import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin, IndianRupee, CalendarCheck } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import PageNavbar from "@food/components/user/PageNavbar";
import OptimizedImage from "@food/components/OptimizedImage";
import DiningBannerCarousel from "@food/components/user/dining/DiningBannerCarousel";
import { diningAPI } from "@food/api";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";

export default function DiningHome() {
  const { location } = useLocation();
  const { zoneId } = useZone(location);
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [bannersRes, categoriesRes, restaurantsRes] = await Promise.all([
          diningAPI.getBanners(),
          diningAPI.getCategories(),
          diningAPI.getRestaurants(zoneId ? { zoneId } : {}),
        ]);
        if (cancelled) return;
        setBanners(bannersRes?.data?.data?.banners || []);
        setCategories(categoriesRes?.data?.data?.categories || []);
        setRestaurants(restaurantsRes?.data?.data?.restaurants || []);
      } catch {
        // fail silently, show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [zoneId]);

  const filtered = activeCategory
    ? restaurants.filter((r) => (r.categories || []).some((c) => c._id === activeCategory))
    : restaurants;

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0a0a0a]/95">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="mx-auto max-w-6xl space-y-5 px-3 pb-10 pt-4 sm:px-4 md:px-6">
          <DiningBannerCarousel banners={banners} />

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Dine In</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reserve a table and enjoy the experience</p>
            </div>
            <Link to="/food/user/dining/bookings" className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
              <CalendarCheck className="h-3.5 w-3.5" /> My bookings
            </Link>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${!activeCategory ? "border-[#FE5502] bg-red-50 text-[#FE5502]" : "border-gray-200 text-gray-600"}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setActiveCategory(cat._id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${activeCategory === cat._id ? "border-[#FE5502] bg-red-50 text-[#FE5502]" : "border-gray-200 text-gray-600"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FE5502] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">No dine-in restaurants available right now.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/food/user/dining/${restaurant.id}`}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a]"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <OptimizedImage src={restaurant.image} alt={restaurant.name} className="h-full w-full" objectFit="cover" />
                  </div>
                  <div className="p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">{restaurant.name}</h3>
                      {Number(restaurant.rating) > 0 && (
                        <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-green-700 px-1.5 py-0.5 text-white">
                          <span className="text-[10px] font-bold">{Number(restaurant.rating).toFixed(1)}</span>
                          <Star className="h-2.5 w-2.5 fill-white" strokeWidth={0} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                      <IndianRupee className="h-3 w-3" /> {restaurant.avgCostForTwo || "—"} for two
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin className="h-3 w-3" />
                      <span className="line-clamp-1">{restaurant.location?.area || restaurant.location?.city || ""}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

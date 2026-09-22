import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin, IndianRupee, CalendarCheck, UtensilsCrossed } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import PageNavbar from "@food/components/user/PageNavbar";
import OptimizedImage from "@food/components/OptimizedImage";
import DiningBannerCarousel from "@food/components/user/dining/DiningBannerCarousel";
import { diningAPI } from "@food/api";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";

function RestaurantCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#1a1a1a]">
      <div className="h-40 w-full animate-pulse bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0a0a0a]/95">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="mx-auto max-w-6xl space-y-6 px-3 pb-24 pt-4 sm:px-4 sm:pb-10 md:px-6">
          <DiningBannerCarousel banners={banners} />

          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Dine In</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reserve a table and enjoy the experience</p>
            </div>
            <Link
              to="/food/user/dining/bookings"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-[#FE5502]/40 hover:text-[#FE5502] dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-300"
            >
              <CalendarCheck className="h-3.5 w-3.5" /> My bookings
            </Link>
          </div>

          {/* Category pills — now shown with their admin-set image, not just text */}
          {categories.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveCategory(null)}
                className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  !activeCategory
                    ? "border-[#FE5502] bg-[#FE5502]/5 text-[#FE5502]"
                    : "border-transparent bg-white text-gray-600 dark:bg-[#1a1a1a] dark:text-gray-300"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <UtensilsCrossed className="h-5 w-5" />
                </span>
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setActiveCategory(cat._id)}
                  className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${
                    activeCategory === cat._id
                      ? "border-[#FE5502] bg-[#FE5502]/5 text-[#FE5502]"
                      : "border-transparent bg-white text-gray-600 dark:bg-[#1a1a1a] dark:text-gray-300"
                  }`}
                >
                  <span className="h-11 w-11 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed className="h-5 w-5 text-gray-400" />
                      </span>
                    )}
                  </span>
                  <span className="max-w-[64px] truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <RestaurantCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-[#1a1a1a]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <UtensilsCrossed className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {activeCategory ? "No restaurants in this category yet." : "No dine-in restaurants available right now."}
              </p>
              <p className="max-w-xs text-xs text-gray-400">Check back soon — we're adding dine-in partners in your area.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/food/user/dining/${restaurant.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-[#1a1a1a]"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <OptimizedImage
                      src={restaurant.image}
                      alt={restaurant.name}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      objectFit="cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="p-3.5">
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
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{restaurant.location?.area || restaurant.location?.city || ""}</span>
                    </div>
                    {(restaurant.categories || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {restaurant.categories.slice(0, 3).map((c) => (
                          <span key={c._id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
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

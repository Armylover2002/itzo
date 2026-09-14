import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  MapPin,
  Clock,
  Star,
  ChevronLeft,
  Search,
  X,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import ProductCard from "../components/shared/ProductCard";
import MiniCart from "../components/shared/MiniCart";
import {
  formatOpeningHoursAMPM,
  isStoreCurrentlyOpen,
} from "@shared/utils/timeFormat";
import { useLocation as useAppLocation } from "../context/LocationContext";
import ZoneServiceUnavailable from "../components/shared/ZoneServiceUnavailable";
import { getQuickHomePath } from "../utils/routes";
import { cn } from "@/lib/utils";

const FALLBACK_STORE_IMAGE =
  "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=400&h=400&fit=crop";
const ACCENT = "#FF0000";

const StoreRailCard = React.memo(function StoreRailCard({
  store,
  isActive,
  onSelect,
}) {
  const isOpen = isStoreCurrentlyOpen(store.openingHours);
  const storeImage = store.shopImage || FALLBACK_STORE_IMAGE;
  const rating = Number(store.rating) > 0 ? Number(store.rating).toFixed(1) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(store._id)}
      className={cn(
        "relative flex w-[148px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200",
        isActive
          ? "border-red-500 shadow-[0_10px_28px_-16px_rgba(255,0,0,0.55)] ring-2 ring-red-500/20"
          : "border-slate-200/80 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div className="relative h-[88px] w-full overflow-hidden bg-slate-100">
        <img
          src={storeImage}
          alt={store.shopName}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white",
            isOpen ? "bg-emerald-600" : "bg-slate-800/85",
          )}
        >
          {isOpen ? "Open" : "Closed"}
        </span>
        {rating && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            {rating}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2.5">
        <p
          className={cn(
            "line-clamp-2 text-[12px] font-bold leading-snug",
            isActive ? "text-red-600" : "text-slate-800",
          )}
        >
          {store.shopName}
        </p>
      </div>
    </button>
  );
});

const ProductSkeleton = () => (
  <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white">
    <div className="aspect-square bg-slate-100" />
    <div className="space-y-2 p-3">
      <div className="h-3 w-3/4 rounded bg-slate-100" />
      <div className="h-3 w-1/2 rounded bg-slate-100" />
      <div className="h-8 w-full rounded-xl bg-slate-100" />
    </div>
  </div>
);

const ShopByStorePage = () => {
  const navigate = useNavigate();
  const { currentLocation } = useAppLocation();
  const [stores, setStores] = useState([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [serviceUnavailableMessage, setServiceUnavailableMessage] = useState("");
  const [storeQuery, setStoreQuery] = useState("");

  useEffect(() => {
    const loadStores = async () => {
      const hasValidLocation =
        Number.isFinite(currentLocation?.latitude) &&
        Number.isFinite(currentLocation?.longitude);
      if (!hasValidLocation) {
        setIsLoadingStores(false);
        setStores([]);
        setActiveStoreId(null);
        setServiceUnavailableMessage(
          "Select your delivery location to see available stores",
        );
        return;
      }

      setIsLoadingStores(true);
      try {
        const res = await customerApi
          .getStores({
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
          })
          .catch(() => ({ data: {} }));
        if (res.data?.serviceAvailable === false) {
          setStores([]);
          setActiveStoreId(null);
          setServiceUnavailableMessage(
            String(
              res.data?.message || "Services not available in your area",
            ).trim(),
          );
          return;
        }
        setServiceUnavailableMessage("");
        const list = res.data?.results || res.data?.result || res.data || [];
        const normalized = Array.isArray(list) ? list : [];
        setStores(normalized);
        if (normalized.length > 0) {
          setActiveStoreId((prev) =>
            prev && normalized.some((s) => s._id === prev)
              ? prev
              : normalized[0]._id,
          );
        } else {
          setActiveStoreId(null);
        }
      } catch (e) {
        console.error("Failed to load stores", e);
      } finally {
        setIsLoadingStores(false);
      }
    };
    loadStores();
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!activeStoreId) {
        setProducts([]);
        return;
      }
      setIsLoadingProducts(true);
      try {
        const res = await customerApi.getProducts({
          sellerId: activeStoreId,
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });
        const productList =
          res.data?.result?.items || res.data?.results || [];
        setProducts(Array.isArray(productList) ? productList : []);
      } catch (e) {
        console.error("Failed to fetch products for store", e);
        setProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    loadProducts();
  }, [
    activeStoreId,
    currentLocation?.latitude,
    currentLocation?.longitude,
  ]);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      String(s.shopName || s.name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [stores, storeQuery]);

  const activeStore = stores.find((s) => s._id === activeStoreId) || null;
  const activeIsOpen = activeStore
    ? isStoreCurrentlyOpen(activeStore.openingHours)
    : true;
  const hoursLabel = activeStore?.openingHours
    ? formatOpeningHoursAMPM(activeStore.openingHours)
    : null;
  const locationLabel =
    currentLocation?.name ||
    currentLocation?.city ||
    "Your delivery area";

  return (
    <div className="min-h-screen bg-[#F5F7F8] pb-28">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 border-b border-white/15 px-4 py-3.5 shadow-sm backdrop-blur-md md:px-8"
        style={{
          backgroundImage: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT}F2 100%)`,
        }}
      >
        <div className="mx-auto flex max-w-[1920px] items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(getQuickHomePath())}
            className="rounded-full p-1.5 text-white transition-colors hover:bg-white/15"
            aria-label="Back to home"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75">
              Quick Commerce
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight text-white">
              Shop by Store
            </h1>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white sm:flex">
            <MapPin size={13} />
            <span className="max-w-[160px] truncate">{locationLabel}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1920px] px-4 pt-5 md:px-8">
        {serviceUnavailableMessage ? (
          <ZoneServiceUnavailable
            message={serviceUnavailableMessage}
            className="mt-4 min-h-[45vh] rounded-3xl border border-slate-100 bg-white"
          />
        ) : (
          <>
            {/* Intro + search */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[17px] font-black tracking-tight text-slate-900">
                  Nearby stores
                </h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  Pick a store and shop their catalogue directly.
                </p>
              </div>
              {stores.length > 4 && (
                <div className="relative w-full sm:w-[260px]">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={storeQuery}
                    onChange={(e) => setStoreQuery(e.target.value)}
                    placeholder="Search stores..."
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none ring-red-500/20 placeholder:text-slate-400 focus:border-red-400 focus:ring-2"
                  />
                  {storeQuery && (
                    <button
                      type="button"
                      onClick={() => setStoreQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Store rail */}
            <div className="mb-5">
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                {isLoadingStores &&
                  [1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-[138px] w-[148px] shrink-0 animate-pulse rounded-2xl bg-slate-200/80"
                    />
                  ))}

                {!isLoadingStores && filteredStores.length === 0 && (
                  <div className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                      <Store size={26} />
                    </div>
                    <p className="text-sm font-bold text-slate-600">
                      {storeQuery
                        ? "No stores match your search"
                        : "No stores available in your area"}
                    </p>
                    {storeQuery && (
                      <button
                        type="button"
                        onClick={() => setStoreQuery("")}
                        className="mt-3 text-xs font-bold text-red-600 hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}

                {!isLoadingStores &&
                  filteredStores.map((store) => (
                    <StoreRailCard
                      key={store._id}
                      store={store}
                      isActive={store._id === activeStoreId}
                      onSelect={setActiveStoreId}
                    />
                  ))}
              </div>
            </div>

            {/* Active store banner */}
            {activeStore && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                    <img
                      src={activeStore.shopImage || FALLBACK_STORE_IMAGE}
                      alt={activeStore.shopName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                        {activeStore.shopName}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                          activeIsOpen
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600",
                        )}
                      >
                        {activeIsOpen ? "Open now" : "Closed"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                      {hoursLabel && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {hoursLabel}
                        </span>
                      )}
                      {Number(activeStore.rating) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Star
                            size={12}
                            className="fill-amber-400 text-amber-400"
                          />
                          {Number(activeStore.rating).toFixed(1)} rating
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Store size={12} />
                        {products.length} product
                        {products.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
                {!activeIsOpen && (
                  <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 sm:px-5">
                    This store is offline right now. You can browse products,
                    but ordering will be available when they reopen.
                  </div>
                )}
              </div>
            )}

            {/* Products */}
            <div className="mb-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-black tracking-tight text-slate-900">
                  {activeStore
                    ? `Products from ${activeStore.shopName}`
                    : "Store products"}
                </h3>
                {products.length > 0 && !isLoadingProducts && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                    {products.length} items
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {isLoadingProducts &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <ProductSkeleton key={i} />
                  ))}

                {!isLoadingProducts &&
                  activeStore &&
                  products.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                        <Store size={28} />
                      </div>
                      <p className="text-sm font-bold text-slate-600">
                        No products found for this store
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        Try another store from the list above
                      </p>
                    </div>
                  )}

                {!isLoadingProducts &&
                  products.map((product) => (
                    <div
                      key={product.id || product._id}
                      className={cn(
                        "w-full transition-opacity",
                        !activeIsOpen && "opacity-70",
                      )}
                    >
                      <ProductCard
                        product={product}
                        className="h-full border border-slate-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-md"
                        compact
                      />
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      <MiniCart />
    </div>
  );
};

export default ShopByStorePage;

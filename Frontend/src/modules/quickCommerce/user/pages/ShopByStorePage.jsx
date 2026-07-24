import React, { useEffect, useState, useMemo } from "react";
import { Tag, Sparkles, ChevronRight } from "lucide-react";
import { customerApi } from "../services/customerApi";
import ProductCard from "../components/shared/ProductCard";
import { useLocation as useAppLocation } from "../context/LocationContext";
import {
  getSideImageByKey,
  getBackgroundColorByValue,
} from "@/shared/constants/offerSectionOptions";

const mapProduct = (p) => ({
  id: p._id,
  _id: p._id,
  name: p.name,
  image:
    p.mainImage ||
    p.image ||
    "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
  price: p.salePrice ?? p.price,
  originalPrice: p.price,
  weight: p.weight || "1 unit",
  deliveryTime: "8-15 mins",
});

const ShopByStorePage = () => {
  const { currentLocation } = useAppLocation();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);

  useEffect(() => {
    const load = async () => {
      const hasValidLocation =
        Number.isFinite(currentLocation?.latitude) &&
        Number.isFinite(currentLocation?.longitude);
      if (!hasValidLocation) {
        setIsLoading(false);
        setSections([]);
        setActiveStoreId(null);
        return;
      }

      setIsLoading(true);
      try {
        const res = await customerApi
          .getOfferSections({
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
          })
          .catch(() => ({ data: {} }));
        const list =
          res.data?.results || res.data?.result || res.data || [];
        const normalized = Array.isArray(list) ? list : [];
        setSections(normalized);
        if (normalized.length > 0) {
          setActiveStoreId(normalized[0]._id);
        }
      } catch (e) {
        console.error("Failed to load store sections", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const sortedStores = useMemo(
    () => [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sections]
  );

  const activeStore = sortedStores.find((s) => s._id === activeStoreId) || null;

  const activeProducts = useMemo(() => {
    if (!activeStore) return [];
    const raw =
      (activeStore.productIds || []).filter(Boolean).map((p) =>
        typeof p === "object" && p !== null ? mapProduct(p) : null
      );
    return raw.filter(Boolean);
  }, [activeStore]);

  return (
    <div className="relative z-10 py-8 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] animate-in fade-in slide-in-from-bottom-4 duration-700 mt-36 md:mt-24">
      {/* Header */}
      <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs md:text-sm font-black uppercase tracking-[0.25em] text-[#FE5502]/80 mb-2">
            Shop by store
          </p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-3">
            Curated Aisles,{" "}
            <span className="text-[#FE5502]">Just for You</span>
          </h1>
          <p className="text-slate-500 text-sm md:text-lg font-medium max-w-2xl">
            Jump straight into themed collections – from{" "}
            <span className="font-semibold">Summer Coolers</span> to{" "}
            <span className="font-semibold">Breakfast Essentials</span>. Every
            store is hand–picked by your team in the admin panel.
          </p>
        </div>
        {activeStore && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FE5502]/5 border border-[#FE5502]/15 text-xs md:text-sm font-bold text-[#FE5502]">
            <Tag size={16} />
            <span className="truncate max-w-[180px] md:max-w-xs">
              Currently exploring: {activeStore.title}
            </span>
          </div>
        )}
      </div>

      {/* Store selector strip */}
      <div className="mb-8">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 md:mx-0 md:px-0">
          {isLoading && (
            <div className="text-slate-400 text-sm font-medium">
              Loading stores...
            </div>
          )}
          {!isLoading &&
            sortedStores.map((store) => {
              const isActive = store._id === activeStoreId;
              const bgColor = getBackgroundColorByValue(store.backgroundColor);
              const sideImageUrl = getSideImageByKey(store.sideImageKey);

              return (
                <button
                  key={store._id}
                  onClick={() => setActiveStoreId(store._id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 min-w-[210px] md:min-w-[260px] pr-4 transition-all shadow-sm hover:shadow-lg ${
                    isActive
                      ? "border-[#FE5502] bg-white"
                      : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <div
                    className="h-16 w-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner"
                    style={{ backgroundColor: bgColor }}
                  >
                    <img
                      src={sideImageUrl}
                      alt={store.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1 line-clamp-1">
                      Curated store
                    </p>
                    <p className="text-sm md:text-base font-black text-slate-800 line-clamp-2">
                      {store.title}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`${
                      isActive ? "text-[#FE5502]" : "text-slate-400"
                    }`}
                  />
                </button>
              );
            })}
        </div>
      </div>

      {/* Active store hero + category style tiles */}
      {activeStore && (
        <section className="mb-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: big summer–style hero */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-100 via-amber-50 to-rose-50 border border-slate-100 shadow-xl h-full flex flex-col">
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between relative z-10">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-2">
                    {activeStore.categoryIds?.length || 0}+ categories
                  </p>
                  <h2 className="text-2xl md:text-3xl font-[1000] text-slate-900 leading-tight mb-2">
                    {activeStore.title || "Featured Store"}
                  </h2>
                  <p className="text-sm text-slate-600 font-medium max-w-md">
                    Explore all hand–picked items under this theme. Perfect for
                    quick shopping with zero search.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Sparkles size={16} className="text-amber-500" />
                  <span>Tap a block on the right to see products instantly</span>
                </div>
              </div>
              <div className="absolute -right-10 bottom-0 w-40 h-40 md:w-52 md:h-52 bg-orange-300/40 rounded-full blur-3xl" />
              <div className="absolute -left-10 -top-10 w-40 h-40 md:w-52 md:h-52 bg-amber-200/40 rounded-full blur-3xl" />
            </div>
          </div>

          {/* Right: summer–coolers style tiles for categories */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {(activeStore.categoryIds || []).length === 0 && (
                <div className="col-span-2 md:col-span-3 text-center text-slate-400 text-sm font-medium py-6">
                  No categories linked to this store yet.
                </div>
              )}
              {(activeStore.categoryIds || []).map((cat) => {
                const name =
                  typeof cat === "object" && cat?.name ? cat.name : "Category";
                const key = cat?._id || String(name);
                const sampleImage = getSideImageByKey(activeStore.sideImageKey);
                return (
                  <div
                    key={key}
                    className="relative rounded-[1.5rem] bg-gradient-to-b from-orange-50 to-amber-100 shadow-md border border-amber-100 overflow-hidden cursor-pointer group hover:-translate-y-1 transition-all"
                  >
                    <div className="absolute inset-x-0 top-0 h-16 bg-orange-200/40" />
                    <div className="relative p-3 flex flex-col items-center text-center gap-2">
                      <div className="h-16 w-full rounded-2xl overflow-hidden bg-white shadow-inner">
                        <img
                          src={sampleImage}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="mt-1">
                        <p className="text-xs md:text-sm font-black text-slate-800 leading-snug line-clamp-2">
                          {name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Product carousel for active store */}
      <section className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.06)] p-5 md:p-7">
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-3">
          <div>
            <h3 className="text-lg md:text-2xl font-[1000] text-slate-900 tracking-tight">
              {activeStore ? "All products in this store" : "Stores coming soon"}
            </h3>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              Scroll sideways to explore everything under this curated aisle.
            </p>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar scroll-smooth snap-x snap-mandatory">
          {isLoading && (
            <div className="w-full py-8 text-center text-slate-400 text-sm font-bold">
              Loading products...
            </div>
          )}
          {!isLoading && activeStore && activeProducts.length === 0 && (
            <div className="w-full py-8 text-center text-slate-400 text-sm font-bold">
              No products linked to this store yet.
            </div>
          )}
          {!isLoading &&
            activeProducts.map((product) => (
              <div
                key={product.id}
                className="w-[180px] md:w-[200px] flex-shrink-0 snap-start"
              >
                <ProductCard
                  product={product}
                  className="bg-white border border-slate-100 shadow-sm hover:shadow-md"
                  compact
                />
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};

export default ShopByStorePage;


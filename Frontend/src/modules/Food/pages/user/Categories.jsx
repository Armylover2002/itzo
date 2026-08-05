import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Grid2x2, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { adminAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import OptimizedImage from "@food/components/OptimizedImage";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";
import useAppBackNavigation from "@food/hooks/useAppBackNavigation";
import { API_BASE_URL } from "@food/api/config";

export default function Categories() {
  const navigate = useNavigate();
  const goBack = useAppBackNavigation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { location } = useLocation();
  const { zoneId } = useZone(location);

  const BACKEND_ORIGIN = useMemo(() => API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, ""), []);

  const normalizeImageUrl = (imageUrl) => {
    if (typeof imageUrl !== "string") return "";
    const trimmed = imageUrl.trim();
    if (!trimmed) return "";
    if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
    
    const normalizedInput = trimmed
      .replace(/\\/g, "/")
      .replace(/^(https?):\/(?!\/)/i, "$1://")
      .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

    if (/^(https?:)?\/\//i.test(normalizedInput)) return normalizedInput;

    return normalizedInput.startsWith("/")
      ? `${BACKEND_ORIGIN}${normalizedInput}`
      : `${BACKEND_ORIGIN}/${normalizedInput.replace(/^\.?\/*/, "")}`;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {});
        const list =
          response?.data?.data?.categories ||
          response?.data?.categories ||
          [];

        if (Array.isArray(list)) {
          const transformed = list.map((cat, idx) => ({
            id: String(cat?.id || cat?._id || cat?.slug || idx),
            name: cat?.name || "",
            slug: cat?.slug || String(cat?.name || "").toLowerCase().replace(/\s+/g, "-"),
            image: normalizeImageUrl(cat?.image || cat?.imageUrl) || foodImages[idx % foodImages.length],
            type: cat?.type || "",
          }));
          setCategories(transformed);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [zoneId, BACKEND_ORIGIN]);

  const filteredCategories = categories.filter((cat) =>
    (cat.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100 px-4 py-4 flex items-center gap-4">
        <button onClick={goBack} className="p-2 hover:bg-neutral-100 rounded-full transition-colors active:scale-95">
          <ArrowLeft className="h-6 w-6 text-neutral-800" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">All Categories</h1>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-none mt-1">What's on your mind?</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 group-focus-within:text-[#FE5502] transition-colors" />
          <input
            type="text"
            placeholder="Search specialties, cuisines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#FE5502]/5 focus:border-[#FE5502] transition-all placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-10">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 animate-pulse">
                <div className="w-full aspect-square rounded-full bg-neutral-100 border border-neutral-50" />
                <div className="h-2 w-12 bg-neutral-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-10">
            {filteredCategories.map((category, index) => {
              return (
                <motion.div
                  key={category.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link
                    to={`/food/user/category/${category.slug}`}
                    className="flex flex-col items-center gap-2.5 group"
                  >
                    <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-sm border border-neutral-100 bg-white group-active:scale-90 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                      <OptimizedImage
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        sizes="(max-width: 640px) 25vw, 15vw"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-neutral-700 text-center leading-tight">
                      {category.name}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {filteredCategories.length === 0 && !loading && (
          <div className="py-20 flex flex-col items-center text-center px-6">
            <div className="h-20 w-20 bg-neutral-50 rounded-full flex items-center justify-center mb-6">
              <Grid2x2 className="h-10 w-10 text-neutral-300" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">No results found</h3>
            <p className="text-sm text-neutral-500 mt-2 max-w-[240px]">We couldn't find any categories matching your search. Try another keyword!</p>
            <button 
              onClick={() => setSearchQuery("")}
              className="mt-8 px-8 py-3 bg-neutral-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-lg"
            >
              Show all categories
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

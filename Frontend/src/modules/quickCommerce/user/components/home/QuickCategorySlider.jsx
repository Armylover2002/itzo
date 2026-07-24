import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getQuickCategoryPath } from "../../utils/routes";
import { resolveQuickImageUrl } from "../../utils/image";

const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";

const quickCategoryPalettes = [
  { bgFrom: "#ffd96a", bgVia: "#ffeaa0", bgTo: "#fff0c7", glowColor: "rgba(255,184,0,0.18)", frameColor: "#f0d98a" },
  { bgFrom: "#9fe88c", bgVia: "#c3f1b2", bgTo: "#e4f8da", glowColor: "rgba(126,220,141,0.18)", frameColor: "#bfe3b7" },
  { bgFrom: "#f3a25d", bgVia: "#f9c48b", bgTo: "#fee0bf", glowColor: "rgba(255,139,61,0.16)", frameColor: "#efc08e" },
  { bgFrom: "#b8eff0", bgVia: "#d5f7f5", bgTo: "#edfdfc", glowColor: "rgba(122,215,215,0.16)", frameColor: "#b9e5e3" },
];

const getQuickCategoryImage = (category = {}) => {
  const candidate =
    category?.image ||
    category?.icon ||
    category?.thumbnail ||
    category?.imageUrl ||
    category?.iconUrl ||
    category?.media?.image ||
    category?.media?.url ||
    "";

  return (
    resolveQuickImageUrl(candidate) ||
    "https://cdn-icons-png.flaticon.com/128/2321/2321831.png"
  );
};

const QuickCategorySlider = ({ categories = [], activeCategory, embedded = false }) => {
  const navigate = useNavigate();
  const quickCatsRef = useRef(null);

  const scrollQuickCats = (direction) => {
    if (quickCatsRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      quickCatsRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!categories || categories.length === 0) return null;

  return (
    <div
      className={cn(
        "w-full mb-5 overflow-hidden relative group z-20 md:mt-3",
        embedded ? "mt-2" : "mt-4 md:mt-6",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-white dark:bg-card",
          embedded ? "shadow-none" : "shadow-[0_14px_28px_rgba(15,23,42,0.09)]",
        )}
      >
        <div className="relative z-10 px-4 pt-3 pb-1 md:px-8 md:pt-4">
          <h2 className="text-center text-[18px] md:text-[20px] font-bold tracking-tight text-[#132018] dark:text-white leading-none">
            Quick categories
          </h2>
        </div>

        {/* Left Scroll Button */}
        <div className="absolute left-4 lg:left-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scrollQuickCats("left")}
            className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#FE5502] transition-all"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </motion.button>
        </div>

        <div
          ref={quickCatsRef}
          className="relative z-10 flex items-start gap-2.5 md:gap-3 lg:gap-4 overflow-x-auto no-scrollbar px-4 pb-3 pt-1 md:px-8 md:pb-4 snap-x scroll-smooth"
        >
          {categories.map((cat, idx) => {
            const palette = quickCategoryPalettes[idx % quickCategoryPalettes.length];
            const categoryImage = getQuickCategoryImage(cat);
            return (
              <motion.div
                key={cat.id || cat._id || `cat-${idx}`}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(
                      QUICK_HEADER_RETURN_STORAGE_KEY,
                      JSON.stringify({
                        headerId: activeCategory?._id || activeCategory?.id || "all",
                        color: activeCategory?.headerColor || "#ffdb3a",
                        name: activeCategory?.name || "All",
                      }),
                    );
                  }
                  navigate(getQuickCategoryPath(cat._id || cat.id));
                }}
                className="flex flex-col items-center gap-1 min-w-[84px] md:min-w-[112px] lg:min-w-[128px] cursor-pointer group/item snap-start"
              >
                <div
                  className="relative w-[84px] h-[96px] md:w-[112px] md:h-[126px] lg:w-[128px] lg:h-[140px] rounded-t-full rounded-b-[24px] shadow-[0_10px_22px_rgba(15,23,42,0.10)] border flex items-start justify-center p-2 transition-all duration-300 group-hover/item:-translate-y-1 group-hover/item:shadow-[0_16px_30px_rgba(15,23,42,0.14)] overflow-hidden"
                  style={{
                    backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.6) 24%, rgba(255,255,255,0.15) 100%), linear-gradient(135deg, ${palette.bgFrom}, ${palette.bgVia}, ${palette.bgTo})`,
                    borderColor: palette.frameColor,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-40 pointer-events-none"
                    style={{ backgroundColor: palette.glowColor }}
                  />
                  {categoryImage ? (
                    <img
                      src={categoryImage}
                      alt={cat.name}
                      className="absolute left-1/2 top-3 z-10 h-[68px] w-[68px] -translate-x-1/2 object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.10)] mix-blend-multiply group-hover/item:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute left-1/2 top-3 z-10 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-[20px] bg-white/55 text-2xl font-black uppercase text-slate-400">
                      {(cat.name || "?").charAt(0)}
                    </div>
                  )}
                  <div className="absolute inset-x-2 bottom-1.5 z-20 text-center">
                    <span className="block text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[#1f2b20] leading-tight whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] group-hover/item:text-[#FE5502] transition-colors">
                      {cat.name}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <div className="absolute right-4 lg:right-10 top-[58%] -translate-y-1/2 z-20 hidden md:flex">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scrollQuickCats("right")}
            className="h-10 w-10 bg-white/90 backdrop-blur-md shadow-xl rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-white text-[#FE5502] transition-all"
          >
            <ChevronRight size={22} strokeWidth={3} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(QuickCategorySlider);

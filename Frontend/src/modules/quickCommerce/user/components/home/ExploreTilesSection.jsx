import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, Tag, Sparkles } from "lucide-react";
import { resolveQuickImageUrl } from "../../utils/image";

const cardThemes = [
  { bg: "bg-[#ffd1d1]", arrow: "text-[#FE5502]" },
  { bg: "bg-[#d1dcff]", arrow: "text-[#3b82f6]" },
  { bg: "bg-[#ffdbb3]", arrow: "text-[#f97316]" },
];

const getIcon = (label, index) => {
  const lower = String(label || "").toLowerCase();
  const colorClass =
    lower.includes("gourmet") || lower.includes("premium") || index % 3 === 2
      ? "text-[#f59e0b]"
      : "text-[#FE5502]";

  if (lower.includes("offer") || lower.includes("deal")) {
    return <Tag className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} fill="currentColor" />;
  }
  if (lower.includes("more") || lower.includes("explore")) {
    return <Sparkles className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />;
  }
  return <ShoppingBag className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />;
};

/**
 * Food Explore More–style tile grid for Quick Fast Fav / More.
 */
const ExploreTilesSection = memo(({
  heading = "Explore More",
  items = [],
  className = "",
}) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className={`px-4 py-2 w-full max-w-4xl mx-auto md:max-w-6xl md:pt-0 md:pb-4 ${className}`}>
      <div className="relative overflow-hidden rounded-[20px] bg-[#f0e6e6] p-3 md:px-5 md:py-4 shadow-sm border border-[#e8dada]">
        <div className="flex items-center justify-center gap-2 mb-3 md:mb-4 mt-0.5">
          <span className="text-[#FE5502] text-[11px] md:text-[14px] opacity-90 leading-none">⇋</span>
          <h2 className="relative z-10 text-[12px] md:text-[18px] font-extrabold text-black tracking-[0.05em] uppercase">
            {heading}
          </h2>
          <span className="text-[#FE5502] text-[11px] md:text-[14px] opacity-90 leading-none">⇌</span>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {items.map((item, index) => {
            const theme = cardThemes[index % cardThemes.length];
            const image = resolveQuickImageUrl(item.image || item.imageUrl || "");
            const href = item.href || item.targetPath || item.link || "/quick";
            const label = item.label || item.title || "Explore";
            const subtitle = item.subtitle || "Explore now";

            return (
              <Link
                key={item.id || item._id || `tile-${index}`}
                to={href}
                className={`relative flex flex-col p-1.5 md:p-3 md:px-4 rounded-[12px] md:rounded-[20px] ${theme.bg} group hover:shadow-md transition-all duration-300 overflow-hidden pb-6 md:pb-3 md:h-[140px]`}
              >
                <div className="flex flex-col items-start gap-1 md:hidden">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {image ? (
                      <img
                        src={image}
                        alt={label}
                        className="w-5 h-5 object-contain transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-[#FE5502]" strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="flex flex-col mt-0.5">
                    <span className="text-[9.5px] font-bold text-gray-900 leading-tight">
                      {label}
                    </span>
                    <span className="text-[7px] text-gray-700 mt-[1px] whitespace-nowrap">
                      {subtitle}
                    </span>
                  </div>
                </div>

                <div className="hidden md:flex flex-col justify-between h-full relative z-10 w-[55%]">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {getIcon(label, index)}
                  </div>
                  <div className="flex flex-col mb-0.5">
                    <span className="text-[18px] font-extrabold text-gray-900 leading-tight">
                      {label}
                    </span>
                    <span className="text-[12px] font-medium text-gray-700 mt-1 whitespace-nowrap">
                      {subtitle}
                    </span>
                  </div>
                </div>

                {image ? (
                  <div className="hidden md:flex absolute right-0 top-0 w-[55%] h-full pointer-events-none items-center justify-end">
                    <img
                      src={image}
                      alt={label}
                      className="w-full h-[90%] object-contain mix-blend-darken origin-right transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="absolute bottom-1.5 right-1.5 md:bottom-3 md:right-3 w-3.5 h-3.5 md:w-7 md:h-7 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 z-20 transition-transform group-hover:scale-110">
                  <ArrowRight className={`h-2 w-2 md:h-4 md:w-4 ${theme.arrow}`} strokeWidth={3} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
});

ExploreTilesSection.displayName = "ExploreTilesSection";

export default ExploreTilesSection;

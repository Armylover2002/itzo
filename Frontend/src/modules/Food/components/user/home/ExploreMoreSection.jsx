import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ExploreGridSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import { ArrowRight, ShoppingBag, Tag, UtensilsCrossed } from "lucide-react";

const ExploreMoreSection = memo(({
  exploreMoreHeading,
  showExploreSkeleton,
  finalExploreItems,
  backendOrigin = ""
}) => {
  const getSubtitle = (label) => {
    const map = {
      "Collections": "Curated for you",
      "Offers": "Best deals & discounts",
      "Gourmet": "Premium experiences"
    };
    return map[label] || "Explore now";
  };

  const getIcon = (label, themeIndex) => {
    // Colors from screenshot: Red for Collections/Offers, Orange/Yellow for Gourmet
    const colorClass = label === "Gourmet" ? "text-[#f59e0b]" : "text-[#FF0000]";
    switch (label) {
      case "Collections": return <ShoppingBag className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />;
      case "Offers": return <Tag className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} fill="currentColor" />;
      case "Gourmet": return <UtensilsCrossed className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />;
      default: return <ShoppingBag className={`w-4 h-4 ${colorClass}`} strokeWidth={2.5} />;
    }
  };

  const cardThemes = [
    { bg: "bg-[#ffd1d1]", arrow: "text-[#FF0000]" }, // Noticeably darker pink
    { bg: "bg-[#d1dcff]", arrow: "text-[#3b82f6]" }, // Noticeably darker blue
    { bg: "bg-[#ffdbb3]", arrow: "text-[#f97316]" }, // Noticeably darker orange
  ];

  return (
    <section className="px-4 py-2 w-full max-w-4xl mx-auto md:max-w-6xl md:pt-0 md:pb-4">
      <div className="relative overflow-hidden rounded-[20px] bg-[#f0e6e6] p-3 md:px-5 md:py-4 shadow-sm border border-[#e8dada]">
        
        <div className="flex items-center justify-center gap-2 mb-3 md:mb-4 mt-0.5">
           <span className="text-[#FF0000] text-[11px] md:text-[14px] opacity-90 leading-none">⇋</span>
           <h2 className="relative z-10 text-[12px] md:text-[18px] font-extrabold text-black tracking-[0.05em] uppercase">
             {exploreMoreHeading || "Explore More"}
           </h2>
           <span className="text-[#FF0000] text-[11px] md:text-[14px] opacity-90 leading-none">⇌</span>
        </div>
        
        {showExploreSkeleton ? (
           <div className="w-full px-1">
             <ExploreGridSkeleton count={3} />
           </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {finalExploreItems.map((item, index) => {
              const theme = cardThemes[index % cardThemes.length];
              return (
                <Link
                  key={item.id || `explore-${index}`}
                  to={item.href}
                  className={`relative flex flex-col p-1.5 md:p-3 md:px-4 rounded-[12px] md:rounded-[20px] ${theme.bg} group hover:shadow-md transition-all duration-300 overflow-hidden pb-6 md:pb-3 md:h-[140px]`}
                >
                  {/* MOBILE VIEW (Unchanged) */}
                  <div className="flex flex-col items-start gap-1 md:hidden">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      <OptimizedImage
                        src={item.image}
                        alt={item.label}
                        className="w-5 h-5 object-contain transition-transform duration-300 group-hover:scale-110"
                        backendOrigin={backendOrigin}
                      />
                    </div>
                    <div className="flex flex-col mt-0.5">
                      <span className="text-[9.5px] font-bold text-gray-900 leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[7px] text-gray-700 mt-[1px] whitespace-nowrap">
                        {getSubtitle(item.label)}
                      </span>
                    </div>
                  </div>

                  {/* DESKTOP VIEW */}
                  <div className="hidden md:flex flex-col justify-between h-full relative z-10 w-[55%]">
                    {/* Top Icon */}
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                       {getIcon(item.label, index)}
                    </div>
                    {/* Bottom Text */}
                    <div className="flex flex-col mb-0.5">
                      <span className="text-[18px] font-extrabold text-gray-900 leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[12px] font-medium text-gray-700 mt-1 whitespace-nowrap">
                        {getSubtitle(item.label)}
                      </span>
                    </div>
                  </div>

                  {/* DESKTOP LARGE IMAGE */}
                  <div className="hidden md:flex absolute right-0 top-0 w-[55%] h-full pointer-events-none items-center justify-end">
                     <OptimizedImage 
                        src={item.image} 
                        alt={item.label} 
                        className="w-full h-[90%] object-contain mix-blend-darken origin-right transition-transform duration-500 group-hover:scale-110" 
                        backendOrigin={backendOrigin} 
                     />
                  </div>

                  {/* ARROW BUTTON (Mobile & Desktop) */}
                  <div className="absolute bottom-1.5 right-1.5 md:bottom-3 md:right-3 w-3.5 h-3.5 md:w-7 md:h-7 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 z-20 transition-transform group-hover:scale-110">
                    <ArrowRight className={`h-2 w-2 md:h-4 md:w-4 ${theme.arrow}`} strokeWidth={3} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});

export default ExploreMoreSection;

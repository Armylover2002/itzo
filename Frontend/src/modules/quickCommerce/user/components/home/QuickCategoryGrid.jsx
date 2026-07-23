import React from "react";
import { useNavigate } from "react-router-dom";
import { getQuickCategoryPath } from "../../utils/routes";
import { resolveQuickImageUrl } from "../../utils/image";

const QuickCategoryGrid = ({ categories = [], isLoading = false }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="w-full px-4 pt-4 pb-2">
        <div className="grid grid-cols-4 gap-x-3 gap-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 animate-pulse" />
              <div className="w-12 h-3 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Display all categories without limiting or filtering 'All'
  const displayCategories = categories;

  return (
    <div className="w-full px-4 pt-4 pb-2 bg-white dark:bg-background">
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {displayCategories.map((cat, idx) => {
          const imageSrc = resolveQuickImageUrl(cat.image);
          const IconComp = cat.icon;

          return (
            <div
              key={cat._id || cat.id || idx}
              onClick={() => navigate(getQuickCategoryPath(cat))}
              className="group flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="relative w-16 h-16 rounded-[20px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden group-hover:shadow-md transition-shadow">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={cat.name}
                    loading="lazy"
                    className="w-10 h-10 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
                  />
                ) : IconComp ? (
                  typeof IconComp === "function" || (typeof IconComp === "object" && IconComp.$$typeof) ? (
                    <IconComp sx={{ fontSize: 28, color: "#475569" }} className="w-7 h-7 text-slate-600 drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <img src={IconComp} alt={cat.name} className="w-8 h-8 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                  )
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight text-slate-700 dark:text-slate-300 line-clamp-2 px-1">
                {cat.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(QuickCategoryGrid);

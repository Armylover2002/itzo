import React, { useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { getCloudinarySrcSet } from "@/shared/utils/cloudinaryUtils";

const AUTO_SLIDE_MS = 3500;

/**
 * Food-style banner carousel: one slide visible at a time, opacity crossfade,
 * moderate corner radius (not overly rounded).
 */
const ExperienceBannerCarousel = ({
  section,
  items,
  fullWidth = false,
  slideGap = 0,
  edgeToEdge = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const isMultiple = items.length > 1;
  const sectionTitle = section?.title;

  useEffect(() => {
    if (!isMultiple) return undefined;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(id);
  }, [isMultiple, items.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  if (!items.length) return null;

  const radiusClass = fullWidth || edgeToEdge
    ? "rounded-none"
    : "rounded-xl"; // ~12px — matches food promo feel, not heavy pills

  return (
    <div
      className={cn(
        "overflow-hidden",
        fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]",
        !fullWidth && !edgeToEdge && "px-0"
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-slate-100 shadow-md border border-gray-100",
          radiusClass,
          "h-48 sm:h-56 md:h-64"
        )}
      >
        {items.map((banner, idx) => {
          const isActive = idx === activeIndex % items.length;
          return (
            <div
              key={banner._id || banner.id || `${banner.imageUrl}-${idx}`}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none" }}
            >
              <img
                src={banner.imageUrl}
                srcSet={getCloudinarySrcSet(banner.imageUrl)}
                sizes="100vw"
                alt={banner.title || sectionTitle || "Banner"}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            </div>
          );
        })}
      </div>

      {isMultiple && (
        <div className="flex justify-center items-center gap-1.5 mt-2.5 pb-0.5">
          {items.map((_, idx) => {
            const isActive = idx === activeIndex % items.length;
            return (
              <button
                key={idx}
                type="button"
                aria-label={`Go to banner ${idx + 1}`}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "h-[4px] rounded-full transition-all duration-300",
                  isActive ? "w-4 bg-black" : "w-[6px] bg-gray-200"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(ExperienceBannerCarousel);

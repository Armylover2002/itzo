import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { resolveQuickImageUrl } from "../utils/image";

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0 }) => {
  const effectiveSlideGap = fullWidth ? 0 : slideGap;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const loopedItems = items?.length > 1 ? [...items, items[0]] : items || [];
  const stepPercent = loopedItems.length > 0 ? 100 / loopedItems.length : 100;

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => prev + 1);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [items?.length]);

  useEffect(() => {
    if (!items || items.length <= 1 || activeIndex !== items.length) return;

    const timeoutId = window.setTimeout(() => {
      setIsResetting(true);
      setActiveIndex(0);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, items?.length]);

  useEffect(() => {
    if (!isResetting) return;

    const frameId = window.requestAnimationFrame(() => {
      setIsResetting(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isResetting]);

  if (!items || !items.length) return null;

  return (
    <div className={cn("overflow-hidden", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}>
      <div
        className={cn("flex ease-out", isResetting ? "transition-none" : "transition-transform duration-500")}
        style={{
          width: `${loopedItems.length * 100}%`,
          gap: `${effectiveSlideGap}px`,
          transform: `translateX(-${activeIndex * stepPercent}%)`,
        }}
      >
        {loopedItems.map((banner, idx) => (
          <div
            key={idx}
            className={cn(
              "relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border",
              fullWidth ? "h-[190px] rounded-none px-0" : "h-[180px] md:h-[220px] px-4 md:px-8"
            )}
            style={{
              width: `${stepPercent}%`,
            }}
          >
            {fullWidth ? (
              <div className="relative w-full h-full">
                <img
                  src={resolveQuickImageUrl(banner.imageUrl || banner.image)}
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center"
                />
                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 bg-linear-to-r from-black/40 to-transparent flex flex-col justify-center px-8 text-white">
                    {banner.subtitle && <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">{banner.subtitle}</p>}
                    {banner.title && <h3 className="text-2xl md:text-3xl font-black uppercase italic leading-tight">{banner.title}</h3>}
                    {banner.linkType !== 'none' && (
                      <button className="mt-4 w-fit bg-[#FF1E56] text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg">
                        Order now
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full w-full max-w-[1400px] overflow-hidden rounded-[32px] bg-white shadow-[0_12px_45px_rgba(0,0,0,0.08)] relative group">
                <img
                  src={resolveQuickImageUrl(banner.imageUrl || banner.image)}
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 bg-linear-to-r from-black/30 via-transparent to-transparent flex flex-col justify-center px-10 text-white">
                    {banner.subtitle && <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-90 mb-2 drop-shadow-md">{banner.subtitle}</p>}
                    {banner.title && <h3 className="text-3xl md:text-4xl font-[1000] uppercase italic leading-none drop-shadow-xl">{banner.title}</h3>}
                    {banner.linkType !== 'none' && (
                      <button className="mt-6 w-fit bg-[#FF1E56] hover:bg-[#ff386a] text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                        Order now
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExperienceBannerCarousel;

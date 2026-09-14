import React, { memo } from "react";
import { motion } from "framer-motion";
import { HeroBannerSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";

// Lightweight text reveal — single motion.div instead of N motion.span per character
const TextReveal = ({ text, isActive, delay = 0 }) => (
  <motion.span
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 6 }}
    transition={{ duration: 0.35, delay: isActive ? delay : 0, ease: "easeOut" }}
    className="inline-block"
  >
    {text}
  </motion.span>
);

const BannerSection = memo(({
  showBannerSkeleton,
  heroBannerImages,
  heroBannersData,
  currentBannerIndex,
  setCurrentBannerIndex,
  heroShellRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  navigate,
  backendOrigin = "",
  hideOverlay = false
}) => {
  if (showBannerSkeleton) {
    return (
      <div className="h-full w-full">
        <HeroBannerSkeleton className="h-full w-full" />
      </div>
    );
  }

  if (!heroBannerImages || heroBannerImages.length === 0) return null;

  return (
    <div className="h-full w-full">
      <div
        ref={heroShellRef}
        data-home-hero-shell="true"
        className="relative w-full h-full overflow-hidden bg-transparent"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            <motion.div
              animate={{
                x: ['-200%', '200%'],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatDelay: 5,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] w-[150%] h-full"
            />
          </div>
          {heroBannerImages.map((image, index) => {
            const bannerData = heroBannersData[index];
            const isVideo = bannerData?.type === 'video' || (typeof image === 'string' && image.toLowerCase().endsWith('.mp4'));
            const isActive = currentBannerIndex === index;

            return (
              <div
                key={`${index}-${image}`}
                className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                style={{
                  opacity: isActive ? 1 : 0,
                  zIndex: isActive ? 2 : 1,
                  pointerEvents: "none",
                }}>
                {isVideo ? (
                  <video
                    src={image}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    style={{ filter: "brightness(0.95)" }}
                  />
                ) : (
                  <>
                    <OptimizedImage
                      src={image}
                      alt={`Hero Banner ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      priority={index === currentBannerIndex}
                      backendOrigin={backendOrigin}
                      draggable={false}
                    />
                    {!hideOverlay && (
                      <div className="absolute inset-0 h-full w-full flex items-center justify-center text-center px-4">
                        <div className="relative z-10 flex flex-col justify-center items-center h-full text-white w-full max-w-[320px] sm:max-w-md mt-0 sm:mt-0">
                          <h3 className="text-[15px] sm:text-[18px] font-extrabold leading-[1.4] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                            {bannerData?.title?.split('\n').map((line, i) => (
                              <div key={i}>
                                <TextReveal text={line} isActive={isActive} delay={0.1 + (i * 0.1)} />
                              </div>
                            ))}
                          </h3>
                        </div>
                      </div>
                    )}

                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="absolute inset-0 z-20 h-full w-full border-0 p-0 bg-transparent text-left"
          onClick={() => {
            const bannerData = heroBannersData[currentBannerIndex];
            if (!bannerData || !navigate) return;

            const linkedRestaurants = bannerData?.linkedRestaurants || [];
            if (linkedRestaurants.length > 0) {
              const firstRestaurant = linkedRestaurants[0];
              const restaurantSlug =
                firstRestaurant.slug || firstRestaurant.restaurantId || firstRestaurant._id;
              if (restaurantSlug) {
                navigate(`/user/restaurants/${restaurantSlug}`);
                return;
              }
            }

            const ctaLink = typeof bannerData?.ctaLink === "string" ? bannerData.ctaLink.trim() : "";
            if (ctaLink) {
              if (/^https?:\/\//i.test(ctaLink)) {
                window.open(ctaLink, "_blank", "noopener,noreferrer");
              } else {
                navigate(ctaLink.startsWith("/") ? ctaLink : `/${ctaLink}`);
              }
            }
          }}
          aria-label={`Open hero banner ${currentBannerIndex + 1}`}
        />

        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 z-30 pointer-events-none">
          {heroBannerImages.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${currentBannerIndex === index ? "bg-white/80 w-4" : "bg-white/30 w-1"
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default BannerSection;

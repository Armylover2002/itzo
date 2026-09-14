import OptimizedImage from "@food/components/OptimizedImage";

export default function Under250DesktopHero({
  bannerImages,
  currentBannerIndex,
  onSelectBanner,
  loadingBanner,
  restaurantCount,
  rupeeSymbol = "\u20B9",
}) {
  const activeBanner = bannerImages[currentBannerIndex] || null;

  return (
    <section className="hidden border-b border-gray-100 bg-[#f8f8f8] dark:border-gray-800 dark:bg-[#111111] md:block">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF0000]">
              Budget bites
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white lg:text-4xl">
              Dishes under {rupeeSymbol}250
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400 lg:text-base">
              Discover affordable meals from restaurants near you. Filter by category, delivery time, or sort by rating and distance.
            </p>
            {!loadingBanner && (
              <p className="mt-4 inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-[#1a1a1a] dark:text-gray-200 dark:ring-gray-700">
                {restaurantCount} restaurant{restaurantCount === 1 ? "" : "s"} available
              </p>
            )}
          </div>

          <div className="lg:col-span-7">
            <div className="relative h-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md dark:border-gray-800 dark:bg-[#1a1a1a] lg:h-64">
              {loadingBanner ? (
                <div className="h-full w-full animate-pulse bg-gray-200 dark:bg-gray-800" />
              ) : activeBanner ? (
                <OptimizedImage
                  src={activeBanner}
                  alt="Under 250 banner"
                  className="h-full w-full"
                  objectFit="cover"
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-950">
                  <span className="text-sm font-semibold text-red-600 dark:text-red-300">
                    Great deals under {rupeeSymbol}250
                  </span>
                </div>
              )}

              {bannerImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                  {bannerImages.map((_, index) => (
                    <button
                      key={`desktop-banner-dot-${index}`}
                      type="button"
                      aria-label={`Go to banner ${index + 1}`}
                      onClick={() => onSelectBanner(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        currentBannerIndex === index ? "w-5 bg-white" : "w-2 bg-white/55"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

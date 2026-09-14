import { Suspense, lazy } from "react";
import { HeroBannerSkeleton } from "@food/components/ui/loading-skeletons";
import PromoRow from "./PromoRow";

const BannerSection = lazy(() => import("./BannerSection"));

export default function HomeDesktopHero({
  showBannerSkeleton,
  heroBannerImages,
  heroBannersData,
  currentBannerIndex,
  setCurrentBannerIndex,
  heroShellRef,
  navigate,
  backendOrigin,
  handleVegModeChange,
  isVegMode,
}) {
  return (
    <section className="hidden md:block w-full border-b border-gray-100 bg-[#f8f8f8] dark:border-gray-800 dark:bg-[#111111]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF0000]">
            Food Delivery
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white lg:text-3xl">
            What would you like to eat today?
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <div className="h-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md dark:border-gray-800 dark:bg-[#1a1a1a] lg:h-72">
              <Suspense fallback={<HeroBannerSkeleton className="h-full w-full" />}>
                <BannerSection
                  showBannerSkeleton={showBannerSkeleton}
                  heroBannerImages={heroBannerImages}
                  heroBannersData={heroBannersData}
                  currentBannerIndex={currentBannerIndex}
                  setCurrentBannerIndex={setCurrentBannerIndex}
                  heroShellRef={heroShellRef}
                  navigate={navigate}
                  backendOrigin={backendOrigin}
                  hideOverlay={true}
                />
              </Suspense>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
              <PromoRow
                handleVegModeChange={handleVegModeChange}
                navigate={navigate}
                isVegMode={isVegMode}
                variant="desktop"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

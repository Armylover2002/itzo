import { Percent, ChevronRight } from "lucide-react";

export default function RestaurantDetailsOffers({ offers = [], activeIndex = 0, onOpenOffers }) {
  const visibleOffers = offers.filter(Boolean);
  if (visibleOffers.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 mt-4">
      <div className="max-w-7xl mx-auto">
        <button
          type="button"
          onClick={onOpenOffers}
          className="w-full text-left rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 dark:border-red-900/40 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
        >
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-sm shrink-0">
            <Percent className="h-5 w-5 text-[#FF0000]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF0000]">Offers available</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">
              {visibleOffers[activeIndex % visibleOffers.length]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{visibleOffers.length} offer{visibleOffers.length > 1 ? "s" : ""} · Tap to view</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
        </button>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, MoreVertical, X, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { FOOD_IMAGE_FALLBACK } from "./restaurantDetailsUtils";

export default function RestaurantDetailsHero({
  images = [],
  restaurantName,
  isFavorite,
  showSearch,
  searchQuery,
  onBack,
  onToggleSearch,
  onSearchChange,
  onClearSearch,
  onOpenMenu,
  onToggleFavorite,
}) {
  const gallery = images.length > 0 ? images : [FOOD_IMAGE_FALLBACK];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (gallery.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % gallery.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [gallery.length]);

  const goPrev = () => setIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  const goNext = () => setIndex((prev) => (prev + 1) % gallery.length);

  return (
    <div className="relative w-full h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden bg-gray-900">
      <AnimatePresence mode="wait">
        <motion.img
          key={gallery[index]}
          src={gallery[index]}
          alt={restaurantName || "Restaurant"}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          onError={(e) => {
            if (e.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
              e.currentTarget.src = FOOD_IMAGE_FALLBACK;
            }
          }}
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />

      {/* Top actions */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full border-0 bg-white/90 backdrop-blur-md shadow-lg hover:bg-white"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5 text-gray-900" />
          </Button>

          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            {!showSearch ? (
              <Button
                variant="outline"
                className="h-10 rounded-full border-0 bg-white/90 backdrop-blur-md shadow-lg px-4 gap-2 hover:bg-white"
                onClick={onToggleSearch}
              >
                <Search className="h-4 w-4 text-gray-800" />
                <span className="text-sm font-semibold text-gray-800 hidden sm:inline">Search menu</span>
              </Button>
            ) : (
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search dishes..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-full bg-white/95 backdrop-blur-md shadow-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <Button
              variant="outline"
              size="icon"
              className={`h-10 w-10 rounded-full border-0 backdrop-blur-md shadow-lg ${
                isFavorite ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/90 hover:bg-white"
              }`}
              onClick={onToggleFavorite}
            >
              <Bookmark className={`h-4 w-4 ${isFavorite ? "fill-white" : "text-gray-900"}`} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-0 bg-white/90 backdrop-blur-md shadow-lg hover:bg-white"
              onClick={onOpenMenu}
            >
              <MoreVertical className="h-5 w-5 text-gray-900" />
            </Button>
          </div>
        </div>
      </div>

      {/* Carousel controls */}
      {gallery.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {gallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                }`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

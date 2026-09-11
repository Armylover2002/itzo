import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Auto-rotating banner carousel for the Dining discovery page.
 *
 * Admin banners can be uploaded at any aspect ratio, so each slide uses a
 * blurred, scaled copy of the same image as a full-bleed backdrop with the
 * actual image laid on top at `object-contain` — the image is always shown
 * in full (never cropped), regardless of its original aspect ratio.
 */
export default function DiningBannerCarousel({ banners = [] }) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (banners.length <= 1) return
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length)
    }, 4500)
    return () => clearInterval(timerRef.current)
  }, [banners.length])

  useEffect(() => {
    if (index >= banners.length) setIndex(0)
  }, [banners.length, index])

  if (!banners.length) return null

  const goTo = (next) => {
    setIndex((next + banners.length) % banners.length)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  return (
    <div className="group relative mb-5 h-36 w-full overflow-hidden rounded-2xl sm:h-48 md:h-60 lg:h-72">
      {banners.map((banner, i) => (
        <div
          key={banner._id || i}
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
        >
          <div
            className="absolute inset-0 scale-110 bg-gray-200 bg-cover bg-center blur-xl"
            style={{ backgroundImage: `url(${banner.image})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
          {banner.link ? (
            <a href={banner.link} className="relative flex h-full w-full items-center justify-center">
              <img src={banner.image} alt={banner.title || "Dining offer"} className="h-full max-h-full w-auto max-w-full object-contain" />
            </a>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              <img src={banner.image} alt={banner.title || "Dining offer"} className="h-full max-h-full w-auto max-w-full object-contain" />
            </div>
          )}
        </div>
      ))}

      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-4 w-4 text-gray-800" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white"
            aria-label="Next banner"
          >
            <ChevronRight className="h-4 w-4 text-gray-800" />
          </button>

          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

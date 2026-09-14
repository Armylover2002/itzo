import { useEffect, useRef, useState } from "react";
import OptimizedImage from "@food/components/OptimizedImage";

export default function DiningBannerCarousel({ banners = [] }) {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    intervalRef.current = setInterval(() => setIndex((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(intervalRef.current);
  }, [banners.length]);

  if (!banners.length) return null;

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-2xl sm:h-56">
      <div className="flex h-full w-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((banner, i) => (
          <div key={banner._id || i} className="relative h-full w-full shrink-0">
            <OptimizedImage src={banner.image} alt={banner.title || "Dining banner"} className="h-full w-full" objectFit="cover" priority={i === 0} />
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

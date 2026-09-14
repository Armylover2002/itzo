import React from 'react';
import OptimizedImage from "@food/components/OptimizedImage";

const resolveMediaUrl = (url, backendOrigin) => {
  if (!url || typeof url !== 'string') return "";
  const normalizedUrl = url.replace(/\\/g, '/');
  if (/^(https?:|\/\/|data:|blob:)/i.test(normalizedUrl.trim())) return normalizedUrl;
  const origin = backendOrigin ? backendOrigin.replace(/\/$/, "") : '';
  return `${origin}${normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`}`;
};

export default function AdvertisementSection({ advertisements, BACKEND_ORIGIN }) {
  if (!advertisements || advertisements.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mt-6 mb-2">
      {advertisements.map((ad, index) => (
        <div key={ad._id || index} className="mb-6 last:mb-0 relative overflow-hidden rounded-2xl shadow-sm border border-gray-100">
          {/* Ad Label */}
          <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-[10px] uppercase font-bold px-2 py-1 rounded backdrop-blur-md">
            Ad
          </div>
          
          {/* Content */}
          {ad.adsType === 'Video Promotion' && ad.videoUrl ? (
            <div className="relative aspect-video w-full bg-black">
              <video
                src={resolveMediaUrl(ad.videoUrl, BACKEND_ORIGIN)}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
          ) : (ad.imageUrl ? (
            <div className="relative aspect-[21/9] w-full bg-gray-100">
              <OptimizedImage
                src={ad.imageUrl}
                backendOrigin={BACKEND_ORIGIN}
                alt={ad.title || "Advertisement"}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null)}

          {/* Text Content (optional display of title if it's not a pure banner) */}
          {(ad.title || ad.restaurantName) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
              <h3 className="text-white font-bold text-lg leading-tight">{ad.title}</h3>
              <p className="text-white/80 text-sm font-medium">{ad.restaurantName}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

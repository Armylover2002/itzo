import { BadgePercent, Clock, Star } from "lucide-react"

export default function OnboardingRestaurantCardPreview({
  restaurantName,
  profileImageUrl,
  pureVeg,
  area,
  city,
  estimatedDeliveryTime,
  cuisines = [],
}) {
  const locationLabel = [area, city].filter(Boolean).join(", ") || "Your area"
  const cuisineLabel =
    Array.isArray(cuisines) && cuisines.length > 0
      ? cuisines.slice(0, 2).join(" • ")
      : "Multi-cuisine"

  return (
    <div className="mx-auto w-full max-w-[320px]">
      <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        Customer app preview
      </p>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.1)]">
        <div className="relative aspect-[16/10] bg-slate-100">
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={restaurantName || "Restaurant"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-400">
              Profile image preview
            </div>
          )}
          {pureVeg === true ? (
            <div className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Pure Veg
            </div>
          ) : null}
          <div className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[10px] font-medium text-white backdrop-blur-md">
            {cuisineLabel}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold tracking-tight text-slate-900">
                {restaurantName?.trim() || "Your restaurant name"}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-500">{locationLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">
              <span>NEW</span>
              <Star className="h-3.5 w-3.5 fill-white text-white" strokeWidth={0} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="h-4 w-4" strokeWidth={1.5} />
            <span className="font-medium text-slate-700">
              {estimatedDeliveryTime || "Select delivery time"}
            </span>
            <span className="mx-1">|</span>
            <span className="font-medium text-slate-700">Nearby</span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <BadgePercent className="h-4 w-4 text-slate-900" strokeWidth={2} />
            <span className="font-medium">Offers appear here after you go live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Skeleton } from "@food/components/ui/skeleton"
import { cn } from "@food/utils/utils"
import { Leaf, AlertCircle, Timer, Star, Clock, Bookmark, BadgePercent } from "lucide-react"

const DEFAULT_CARD_COUNT = 4

function LoadingSkeletonRegion({ label = "Loading content", className, children }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

function SkeletonLines({ lines = 3, className, lineClassName }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={`line-${index}`}
          className={cn(
            "h-4 rounded-full",
            index === lines - 1 ? "w-2/3" : "w-full",
            lineClassName
          )}
        />
      ))}
    </div>
  )
}

function HeroBannerSkeleton({ className, compact = false }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.3)]",
        "aspect-[16/8.8] w-full sm:aspect-[16/7.2]",
        className
      )}
    >
      <div className="absolute inset-0 bg-slate-50/50" />
      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-10 rounded-full bg-slate-100" />
          <Skeleton className="h-10 w-24 rounded-full bg-slate-100" />
        </div>
        <div className="max-w-[70%] space-y-3">
          <Skeleton className="h-4 w-24 rounded-full bg-slate-200" />
          <Skeleton className="h-9 w-3/4 rounded-2xl bg-slate-200" />
          <Skeleton className="h-4 w-2/3 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

function CategoryChipRowSkeleton({ count = 8, className }) {
  return (
    <div className={cn("flex gap-4 items-center overflow-x-auto scrollbar-hide py-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={`category-${index}`} className="flex flex-col items-center gap-2 flex-shrink-0">
          <Skeleton
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
          />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function ExploreTileSkeleton({ index }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.08)]",
        index % 4 === 0 ? "bg-white" : ""
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl" />
        <Skeleton className="h-4 w-4/5 rounded-full" />
      </div>
    </div>
  )
}

function ExploreGridSkeleton({ count = 4, className }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <ExploreTileSkeleton key={`explore-${index}`} index={index} />
      ))}
    </div>
  )
}

function RestaurantCardSkeleton({ className, compact = false }) {
  return (
    <div className={cn("h-full", className)}>
      <div className="h-full overflow-hidden rounded-[28px] border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
        {/* Image Placeholder */}
        <div className={cn("relative overflow-hidden bg-gray-100 dark:bg-gray-800", compact ? "h-40 sm:h-44" : "h-44 sm:h-52 md:h-64")}>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900" />
          {/* Header Badges */}
          <Skeleton className="absolute left-4 top-4 h-8 w-24 rounded-full bg-white/40 dark:bg-white/5" />
          <Skeleton className="absolute right-4 top-4 h-11 w-11 rounded-[20px] bg-white/40 dark:bg-white/5" />
        </div>
        
        {/* Content Placeholder */}
        <div className="p-3 sm:p-4 lg:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-7 w-4/5 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-12 rounded-2xl flex-shrink-0" />
          </div>
          
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>

          <div className="mt-auto pt-2 border-t border-gray-50 dark:border-gray-800/50">
            <Skeleton className="h-5 w-3/4 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function RestaurantGridSkeleton({ count = DEFAULT_CARD_COUNT, className, compact = false }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <RestaurantCardSkeleton key={`restaurant-card-${index}`} compact={compact} />
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 8, columns = 6, className }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121212]", className)}>
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-white/5">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={`table-head-${index}`} className="h-3 w-3/4 rounded-full" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={`table-row-${rowIndex}`}
            className="grid gap-4 px-6 py-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, columnIndex) => (
              <Skeleton
                key={`table-cell-${rowIndex}-${columnIndex}`}
                className={cn(
                  "h-4 rounded-full",
                  columnIndex === columns - 1 ? "w-1/2" : columnIndex === 0 ? "w-12" : "w-4/5"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersDashboardSkeleton({ className }) {
  return (
    <LoadingSkeletonRegion label="Loading orders dashboard" className={cn("space-y-6", className)}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121212]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-8 w-60 rounded-full" />
            <Skeleton className="h-4 w-36 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-72 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>
      <TableSkeleton rows={8} columns={7} />
    </LoadingSkeletonRegion>
  )
}

function WalletSkeleton({ className }) {
  return (
    <LoadingSkeletonRegion label="Loading wallet" className={cn("space-y-6 md:space-y-8", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-6">
          <Skeleton className="h-24 w-24 rounded-[28px] md:h-28 md:w-28" />
          <div className="space-y-3 text-center md:text-left">
            <Skeleton className="mx-auto h-8 w-48 rounded-full md:mx-0" />
            <Skeleton className="mx-auto h-12 w-40 rounded-2xl md:mx-0" />
            <Skeleton className="mx-auto h-5 w-32 rounded-full md:mx-0" />
            <Skeleton className="mx-auto h-4 w-64 rounded-full md:mx-0" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-2xl md:w-56" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={`wallet-item-${index}`}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141414]"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-4 w-20 rounded-full" />
              <Skeleton className="ml-auto h-3 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingSkeletonRegion>
  )
}

function ContentPageSkeleton({ className, hero = true }) {
  return (
    <LoadingSkeletonRegion label="Loading page" className={cn("min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#151515]", className)}>
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mb-8 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </div>
        {hero ? (
          <div className="mb-6 rounded-[28px] border border-white/50 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141414]">
            <div className="flex flex-col items-center gap-5 text-center">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-8 w-56 rounded-full" />
              <SkeletonLines className="w-full max-w-2xl" lines={3} />
            </div>
          </div>
        ) : null}
        <div className="space-y-4 rounded-[28px] border border-white/60 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141414]">
          <Skeleton className="h-6 w-48 rounded-full" />
          <SkeletonLines lines={5} />
          <Skeleton className="h-44 w-full rounded-[24px]" />
          <SkeletonLines lines={4} />
        </div>
      </div>
    </LoadingSkeletonRegion>
  )
}

function RestaurantDetailSkeleton({ className }) {
  return (
    <LoadingSkeletonRegion label="Loading restaurant details" className={cn("min-h-screen bg-white dark:bg-[#0a0a0a]", className)}>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-24 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        </div>
        <div className="mt-5 space-y-5">
          <HeroBannerSkeleton compact className="h-56 rounded-[30px] sm:h-64" />
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141414]">
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4 rounded-full" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonLines lines={2} />
            </div>
          </div>
          <CategoryChipRowSkeleton count={5} />
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={`detail-item-${index}`}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141414]"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-6 w-3/5 rounded-full" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <SkeletonLines lines={2} />
                  </div>
                  <Skeleton className="h-24 w-24 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingSkeletonRegion>
  )
}

function AuthPortalSkeleton({ className }) {
  return (
    <LoadingSkeletonRegion
      label="Loading authentication portal"
      className={cn(
        "min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#fff6ec_45%,#fff1e5_100%)]",
        className
      )}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
        <div className="overflow-hidden rounded-[32px] border border-[#f3dfcf] bg-white/95 p-5 shadow-[0_24px_70px_rgba(235,89,14,0.12)]">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-9 w-28 rounded-full bg-[#fff0e1]" />
            <Skeleton className="h-10 w-10 rounded-full bg-[#fff0e1]" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-3 w-20 rounded-full bg-[#ffe4ce]" />
            <Skeleton className="h-10 w-3/4 rounded-2xl bg-[#fff1e3]" />
            <SkeletonLines lines={2} lineClassName="bg-[#ffe6d3]" />
          </div>
          <div className="mt-8 space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl bg-[#fff5ed]" />
            <Skeleton className="h-12 w-full rounded-2xl bg-[#fff5ed]" />
            <Skeleton className="h-12 w-full rounded-2xl bg-[#fff5ed]" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Skeleton className="h-11 rounded-2xl bg-[#fff0e1]" />
            <Skeleton className="h-11 rounded-2xl bg-[#fff0e1]" />
          </div>
        </div>
      </div>
    </LoadingSkeletonRegion>
  )
}



function AppShellSkeleton({ className }) {
  return (
    <LoadingSkeletonRegion label="Loading application" className={cn("min-h-screen bg-[radial-gradient(circle_at_top_left,#fff8ef,transparent_34%),linear-gradient(180deg,#fffdf9_0%,#fff8f1_100%)] dark:bg-[linear-gradient(180deg,#0b0b0b_0%,#151515_100%)]", className)}>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-11 w-40 rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-24 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        </div>
        <div className="rounded-[28px] border border-white/50 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-[#141414]">
          <Skeleton className="h-48 w-full rounded-[22px] sm:h-56" />
        </div>
        <div className="space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-7 w-52 rounded-full" />
            <CategoryChipRowSkeleton count={5} />
          </div>
          <RestaurantGridSkeleton count={3} />
        </div>
      </div>
    </LoadingSkeletonRegion>
  )
}

export {
  AppShellSkeleton,
  AuthPortalSkeleton,
  CategoryChipRowSkeleton,
  ContentPageSkeleton,
  ExploreGridSkeleton,
  HeroBannerSkeleton,

  LoadingSkeletonRegion,
  OrdersDashboardSkeleton,
  RestaurantCardSkeleton,
  RestaurantDetailSkeleton,
  RestaurantGridSkeleton,
  SkeletonLines,
  TableSkeleton,
  WalletSkeleton,
}

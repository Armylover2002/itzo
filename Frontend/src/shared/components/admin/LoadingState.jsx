import { Skeleton } from "@food/components/ui/skeleton";
import { TableSkeleton } from "@food/components/ui/loading-skeletons";
import { cn } from "@food/utils/utils";

/**
 * Loading states for the Blaze admin system. Composes the existing Skeleton
 * primitive + the existing TableSkeleton (re-exported) so there is one
 * shimmer language across every page.
 */

export function KpiCardSkeleton({ className }) {
  return (
    <div className={cn("rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-xs", className)}>
      <div className="flex flex-col justify-between gap-2">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function KpiGridSkeleton({ count = 8, className }) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }) {
  return (
    <div className={cn("blaze-card p-5", className)}>
      <Skeleton className="mb-4 h-5 w-40 rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4 rounded-full", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 320, className }) {
  return (
    <div className={cn("blaze-card p-5", className)}>
      <Skeleton className="mb-4 h-5 w-48 rounded-full" />
      <Skeleton className="w-full rounded-2xl" style={{ height }} />
    </div>
  );
}

export { TableSkeleton };

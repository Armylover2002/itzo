import { cn } from "@food/utils/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "rounded-[calc(var(--radius)-2px)] bg-slate-200/80 animate-pulse dark:bg-white/10",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

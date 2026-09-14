import { cn } from "@food/utils/utils";

/**
 * PageHeader — standard top-of-page header for every admin page.
 * Hierarchy: eyebrow (optional) → title → description (optional) + actions slot.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-slate-500">{eyebrow}</p>}
        {title && <h1 className={cn("text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight", eyebrow && "mt-0.5")}>{title}</h1>}
        {description && <p className="text-xs font-normal text-slate-500 mt-0.5">{description}</p>}
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2">{actions || children}</div>
      )}
    </div>
  );
}

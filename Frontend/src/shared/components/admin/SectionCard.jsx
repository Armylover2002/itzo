import { cn } from "@food/utils/utils";

/**
 * SectionCard — the one content/analytics/chart card surface.
 *
 * Use for: chart cards, analytics panels, list panels, any titled section.
 * Composes the shared `.itzo-card` surface (one radius + one shadow).
 *
 * Props:
 *  - title, subtitle, icon, action: header (omit all to render headerless)
 *  - footer: optional footer node
 *  - flush: remove body padding (for charts/tables that manage their own)
 *  - bodyClassName / className
 */
export default function SectionCard({
  title,
  subtitle,
  icon,
  action,
  footer,
  flush = false,
  children,
  className,
  bodyClassName,
}) {
  const hasHeader = title || subtitle || action || icon;

  return (
    <div className={cn("itzo-card flex min-w-0 flex-col", className)}>
      {hasHeader && (
        <div className="border-b border-slate-200/60 px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2">
            {icon && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shadow-xs">
                {icon}
              </span>
            )}
            <div className="min-w-0 space-y-0.5">
              {title && <h2 className="text-sm sm:text-base font-semibold tracking-tight text-[#1c1c1e] truncate">{title}</h2>}
              {subtitle && <p className="text-[11px] sm:text-xs font-normal text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(flush ? "" : "p-3 sm:p-4", "min-w-0 flex-1", bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-slate-200/60 px-3.5 py-2.5 sm:px-4">{footer}</div>}
    </div>
  );
}

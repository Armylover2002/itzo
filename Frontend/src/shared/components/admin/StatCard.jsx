import { useNavigate } from "react-router-dom";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@food/utils/utils";

/**
 * StatCard — KPI/metric card for the admin panel.
 * Seller-panel compact style: pastel surfaces, tight type, small icon chip.
 *
 * Props:
 *  - title, value, helper, icon
 *  - to / canAccess / onClick — navigation + RBAC (unchanged)
 *  - trend, trendDirection
 *  - cardBg, iconBg, iconColor — optional seller-style color tokens
 */
export default function StatCard({
  title,
  value,
  helper,
  icon,
  to,
  canAccess,
  onClick,
  trend,
  trendDirection = "up",
  cardBg,
  iconBg,
  iconColor,
  className,
}) {
  const navigate = useNavigate();

  if (to && canAccess && !canAccess(to)) return null;

  const clickable = Boolean(to || onClick);
  const handleClick = () => {
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between",
        cardBg || "bg-white border-slate-200/80",
        clickable && "cursor-pointer active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        {icon && (
          <span
            className={cn(
              "rounded-lg p-1.5 sm:p-2 shrink-0 flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105",
              iconBg || "bg-slate-100",
              iconColor || "text-slate-600"
            )}
          >
            {icon}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0",
              trendDirection === "up"
                ? "text-emerald-700 bg-emerald-100/80"
                : "text-rose-700 bg-rose-100/80"
            )}
          >
            {trendDirection === "up" ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {trend}
          </span>
        )}
        {clickable && !trend && (
          <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="mt-1.5 min-w-0">
        <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate tracking-tight">
          {title}
        </p>
        <p className="text-base sm:text-lg font-semibold tracking-tight text-[#1c1c1e] truncate mt-0.5">
          {value}
        </p>
        {helper && (
          <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 line-clamp-1 mt-0.5">
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}

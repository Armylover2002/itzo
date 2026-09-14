import React, { memo } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import {
  formatReturnWindowCountdown,
  getReturnWindowWarningLevel,
  hoursToReturnWindowDays,
} from "@/shared/utils/returnWindow";

const formatDeliveredAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const warningStyles = {
  normal: {
    container: "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    title: "text-emerald-900 dark:text-emerald-200",
    subtitle: "text-emerald-700 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
    delivered: "text-slate-500 dark:text-slate-400",
    deliveredStrong: "text-slate-700 dark:text-slate-300",
    divider: "border-slate-200 dark:border-white/10",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
    title: "text-amber-900 dark:text-amber-200",
    subtitle: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
    delivered: "text-slate-500 dark:text-slate-400",
    deliveredStrong: "text-slate-700 dark:text-slate-300",
    divider: "border-amber-200/80 dark:border-amber-500/20",
  },
  critical: {
    container: "border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10",
    title: "text-rose-900 dark:text-rose-200",
    subtitle: "text-rose-700 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
    delivered: "text-slate-500 dark:text-slate-400",
    deliveredStrong: "text-slate-700 dark:text-slate-300",
    divider: "border-rose-200/80 dark:border-rose-500/20",
  },
  expired: {
    container: "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5",
    title: "text-slate-800 dark:text-slate-200",
    subtitle: "text-slate-600 dark:text-slate-400",
    icon: "text-slate-500 dark:text-slate-400",
    delivered: "text-slate-500 dark:text-slate-400",
    deliveredStrong: "text-slate-700 dark:text-slate-300",
    divider: "border-slate-200 dark:border-white/10",
  },
};

const ReturnWindowBanner = memo(({ eligibility, deliveredAt, className = "" }) => {
  if (!eligibility) return null;

  const resolvedDeliveredAt =
    deliveredAt || eligibility.deliveredAt || eligibility.deliveredAtIso;
  const deliveredLabel = formatDeliveredAt(resolvedDeliveredAt);
  const windowDays = hoursToReturnWindowDays(eligibility.returnWindowHours);
  const warningLevel = getReturnWindowWarningLevel(eligibility.remainingSeconds);
  const styles = warningStyles[warningLevel] || warningStyles.normal;
  const isExpired = warningLevel === "expired" || eligibility.returnWindowExpired;
  const returnsDisabled = eligibility.returnsEnabled === false;

  if (returnsDisabled) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 p-4 ${className}`}>
        {deliveredLabel && (
          <p className={`text-xs ${styles.delivered}`}>
            Delivered <span className={`font-semibold ${styles.deliveredStrong}`}>{deliveredLabel}</span>
          </p>
        )}
        <p className="text-sm font-bold text-slate-800 mt-2">Returns unavailable</p>
        <p className="text-xs text-slate-600 mt-1">Returns are disabled for products in this order.</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2">Returns unavailable</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Returns are currently disabled by the store.</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className={`rounded-xl border p-4 ${styles.container} ${className}`}>
        {deliveredLabel && (
          <p className={`text-xs ${styles.delivered}`}>
            Delivered <span className={`font-semibold ${styles.deliveredStrong}`}>{deliveredLabel}</span>
          </p>
        )}
        <div className={`mt-3 border-t pt-3 ${styles.divider}`}>
          <p className={`text-sm font-bold ${styles.title}`}>Return window expired</p>
          <p className={`text-xs mt-1 ${styles.subtitle}`}>
            Returns were available for {windowDays} day{windowDays === 1 ? "" : "s"} after delivery.
          </p>
        </div>
      </div>
    );
  }

  const countdown = formatReturnWindowCountdown(eligibility.remainingSeconds);
  const Icon = warningLevel === "critical" || warningLevel === "warning" ? AlertTriangle : Clock;

  return (
    <div className={`rounded-xl border p-4 ${styles.container} ${className}`}>
      {deliveredLabel && (
        <p className={`text-xs ${styles.delivered}`}>
          Delivered <span className={`font-semibold ${styles.deliveredStrong}`}>{deliveredLabel}</span>
        </p>
      )}
      <div className={`${deliveredLabel ? `mt-3 border-t pt-3 ${styles.divider}` : ""}`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
          <div>
            <p className={`text-sm font-bold ${styles.title}`}>Return available</p>
            <p className={`text-sm font-semibold mt-1 ${styles.subtitle}`}>{countdown} left</p>
            {warningLevel === "warning" && (
              <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">Return window closing soon.</p>
            )}
            {warningLevel === "critical" && (
              <p className="text-xs mt-1 text-rose-700 dark:text-rose-300">Hurry! Return window ends very soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ReturnWindowBanner.displayName = "ReturnWindowBanner";

export default ReturnWindowBanner;

export const RETURN_WINDOW_DAY_PRESETS = [1, 3, 5, 7, 10, 15, 30];

export const hoursToReturnWindowDays = (hours) => {
  const safeHours = Number(hours);
  if (!Number.isFinite(safeHours) || safeHours <= 0) return 3;
  return Math.max(1, Math.round(safeHours / 24));
};

export const returnWindowDaysToHours = (days) => {
  const safeDays = Number(days);
  if (!Number.isFinite(safeDays) || safeDays <= 0) return 72;
  return Math.round(safeDays * 24);
};

export const formatReturnWindowCountdown = (remainingSeconds = 0) => {
  const safe = Math.max(0, Number(remainingSeconds) || 0);
  if (safe <= 0) return "Expired";

  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "Day" : "Days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "Hour" : "Hours"}`);
  if (days === 0 && hours === 0 && minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "Minute" : "Minutes"}`);
  }
  if (!parts.length) return "Less than 1 minute";

  return parts.join(" ");
};

export const getReturnWindowWarningLevel = (remainingSeconds = 0) => {
  const safe = Math.max(0, Number(remainingSeconds) || 0);
  if (safe <= 0) return "expired";
  if (safe <= 2 * 3600) return "critical";
  if (safe <= 24 * 3600) return "warning";
  return "normal";
};

export const resolveLiveReturnEligibility = (eligibility, now = Date.now()) => {
  if (!eligibility || typeof eligibility !== "object") return null;

  const resolveRow = (row) => {
    if (!row || typeof row !== "object") return null;
    const expiryMs = row.returnExpiryAt ? new Date(row.returnExpiryAt).getTime() : 0;
    const remainingSeconds = expiryMs
      ? Math.max(0, Math.floor((expiryMs - now) / 1000))
      : Math.max(0, Number(row.remainingSeconds || 0));
    const returnsEnabled = row.returnsEnabled !== false;
    const returnWindowExpired = Boolean(row.returnWindowExpired || remainingSeconds <= 0);
    return {
      ...row,
      remainingSeconds,
      returnWindowExpired,
      canReturn: Boolean(returnsEnabled && remainingSeconds > 0 && row.canReturn !== false),
    };
  };

  const itemEligibility = eligibility.itemEligibility && typeof eligibility.itemEligibility === "object"
    ? Object.fromEntries(
        Object.entries(eligibility.itemEligibility).map(([key, row]) => [key, resolveRow(row)]),
      )
    : eligibility.itemEligibility;

  const itemRows = itemEligibility && typeof itemEligibility === "object"
    ? Object.values(itemEligibility).filter(Boolean)
    : [];
  const anyItemCanReturn = itemRows.length
    ? itemRows.some((row) => row.canReturn)
    : null;

  const expiryMs = eligibility.returnExpiryAt
    ? new Date(eligibility.returnExpiryAt).getTime()
    : 0;
  const remainingSeconds = expiryMs
    ? Math.max(0, Math.floor((expiryMs - now) / 1000))
    : Math.max(0, Number(eligibility.remainingSeconds || 0));
  const returnWindowExpired = anyItemCanReturn === false
    ? true
    : anyItemCanReturn === true
      ? false
      : Boolean(eligibility.returnWindowExpired || remainingSeconds <= 0);
  const returnsEnabled = anyItemCanReturn === true
    ? true
    : eligibility.returnsEnabled !== false;
  const canReturn = Boolean(
    anyItemCanReturn === null
      ? returnsEnabled &&
          eligibility.canReturn !== false &&
          !returnWindowExpired &&
          remainingSeconds > 0
      : anyItemCanReturn,
  );

  return {
    ...eligibility,
    itemEligibility,
    remainingSeconds,
    remainingHours: Math.floor(remainingSeconds / 3600),
    returnWindowExpired,
    canReturn,
  };
};

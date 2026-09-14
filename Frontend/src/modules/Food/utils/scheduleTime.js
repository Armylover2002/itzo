/**
 * Safe scheduledAt formatters for Food Schedule Order UX.
 * Always prefer scheduledAt (never createdAt). Never emit "Invalid Date".
 */

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseValidDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * @param {unknown} value
 * @param {Intl.DateTimeFormatOptions & { timeZone?: string }} [options]
 * @returns {string|null}
 */
export function formatScheduledAt(value, options = {}) {
  const date = parseValidDate(value);
  if (!date) return null;

  const { timeZone = DEFAULT_TIME_ZONE, ...fmt } = options;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...fmt,
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Split date / time labels for card layouts (e.g. BUG-5).
 * @returns {{ dateLabel: string, timeLabel: string } | null}
 */
export function formatScheduledAtParts(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = parseValidDate(value);
  if (!date) return null;

  try {
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return { dateLabel, timeLabel };
  } catch {
    return null;
  }
}

/**
 * Compact single-line display for list rows / badges.
 * @returns {string|null}
 */
export function formatScheduledAtShort(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = parseValidDate(value);
  if (!date) return null;

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Human countdown until scheduledAt (or "Now" when due).
 * @returns {string|null}
 */
export function formatScheduleCountdown(value, now = Date.now()) {
  const date = parseValidDate(value);
  if (!date) return null;

  const diffMs = date.getTime() - now;
  if (diffMs <= 0) return "Due now";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${Math.max(1, minutes)}m left`;
}

/**
 * Prefer scheduledAt for display timestamps on scheduled / recently activated orders.
 * @param {{ scheduledAt?: unknown, createdAt?: unknown, orderStatus?: string, status?: string }} order
 * @returns {unknown}
 */
export function getDisplayScheduleTimestamp(order) {
  if (order?.scheduledAt != null && order.scheduledAt !== "") {
    return order.scheduledAt;
  }
  return order?.createdAt;
}

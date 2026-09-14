/**
 * Formats a 24-hour time string (HH:mm) into a 12-hour AM/PM string.
 * @param {string} time24 - The time in "HH:mm" format.
 * @returns {string} The time in "h:mm A" format.
 */
export const formatTimeAMPM = (time24) => {
  if (!time24 || typeof time24 !== "string" || !time24.includes(":")) return time24;
  if (/am|pm/i.test(time24)) return time24; // already formatted

  const [hourStr, minuteStr] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'

  return `${hour}:${minuteStr} ${ampm}`;
};

/**
 * Formats an opening hours string into a 12-hour AM/PM string.
 * Accepts both "HH:mm - HH:mm" and already-AM/PM labels.
 */
export const formatOpeningHoursAMPM = (hoursStr) => {
  if (!hoursStr || typeof hoursStr !== "string") return hoursStr;
  if (/am|pm/i.test(hoursStr)) return hoursStr;

  const match = hoursStr.match(
    /(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}(?::\d{2})?)/i,
  );
  if (!match) return hoursStr;
  return `${formatTimeAMPM(match[1])} - ${formatTimeAMPM(match[2])}`;
};

/**
 * Parse a single clock time to minutes from midnight.
 * Supports "09:00", "9:00 AM", "9:00PM", "21:00:00".
 */
export const parseTimeToMinutes = (raw = "") => {
  const text = String(raw || "").trim();
  if (!text) return null;

  const ampmMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2]);
    const period = ampmMatch[3].toUpperCase();
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (period === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
    return hours * 60 + minutes;
  }

  const h24Match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const hours = Number(h24Match[1]);
    const minutes = Number(h24Match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
};

export const parseOpeningHoursRange = (openingHoursStr = "") => {
  const raw = String(openingHoursStr || "").trim();
  if (!raw) return null;

  const match = raw.match(
    /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
  );
  if (!match) return null;

  const openMinutes = parseTimeToMinutes(match[1]);
  const closeMinutes = parseTimeToMinutes(match[2]);
  if (openMinutes == null || closeMinutes == null) return null;

  return { openMinutes, closeMinutes };
};

/** Current minutes from midnight in Asia/Kolkata (IST). */
export const getIstMinutesNow = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return date.getHours() * 60 + date.getMinutes();
  }
  return hour * 60 + minute;
};

/**
 * Checks if the current IST time falls within opening hours.
 * Missing/invalid hours => treat as open.
 */
export const isStoreCurrentlyOpen = (openingHoursStr) => {
  const range = parseOpeningHoursRange(openingHoursStr);
  if (!range) return true;

  try {
    const currentMinutes = getIstMinutesNow();
    const { openMinutes, closeMinutes } = range;

    if (closeMinutes <= openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch (error) {
    console.error("Error evaluating opening hours:", error);
    return true;
  }
};

export const buildShopClosedMessage = (openingHoursStr = "") => {
  const hours = String(openingHoursStr || "").trim();
  if (hours) {
    return `Shop is currently closed. Open hours: ${hours}`;
  }
  return "Shop is currently closed. Please try again during opening hours.";
};

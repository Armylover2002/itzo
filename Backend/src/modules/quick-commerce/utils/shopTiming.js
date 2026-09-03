/**
 * Utility to parse shop opening hours and determine if a shop is currently open.
 * Supports various formats:
 * - "09:00 AM - 10:00 PM"
 * - "9:00 AM to 10:00 PM"
 * - "09:00 - 22:00"
 * - "09:00-22:00"
 * - Overnight hours e.g. "08:00 PM - 02:00 AM"
 */

export const parseShopHours = (openingHours) => {
  if (!openingHours || typeof openingHours !== "string") {
    return null;
  }
  const raw = openingHours.trim();
  if (!raw) return null;

  // Regex to match "HH:mm [AM|PM] [-|to] HH:mm [AM|PM]"
  const match = raw.match(
    /(\d{1,2}):(\d{2})(?:\s*(AM|PM))?\s*(?:-|to)\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i
  );

  if (!match) return null;

  let [, startH, startM, startMeridiem, endH, endM, endMeridiem] = match;
  let sH = parseInt(startH, 10);
  let sM = parseInt(startM, 10);
  let eH = parseInt(endH, 10);
  let eM = parseInt(endM, 10);

  if (startMeridiem) {
    const sm = startMeridiem.toUpperCase();
    if (sm === "PM" && sH < 12) sH += 12;
    if (sm === "AM" && sH === 12) sH = 0;
  }
  if (endMeridiem) {
    const em = endMeridiem.toUpperCase();
    if (em === "PM" && eH < 12) eH += 12;
    if (em === "AM" && eH === 12) eH = 0;
  }

  return {
    startMinutes: sH * 60 + sM,
    endMinutes: eH * 60 + eM,
    startFormatted: `${String(sH % 12 || 12).padStart(2, "0")}:${String(sM).padStart(2, "0")} ${sH >= 12 ? "PM" : "AM"}`,
    endFormatted: `${String(eH % 12 || 12).padStart(2, "0")}:${String(eM).padStart(2, "0")} ${eH >= 12 ? "PM" : "AM"}`,
  };
};

/**
 * Returns current Indian Standard Time (IST, UTC+5:30) in minutes from midnight.
 */
export const getCurrentISTMinutes = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 3600000 * 5.5);
  return ist.getHours() * 60 + ist.getMinutes();
};

/**
 * Determines whether a shop is open right now based on its openingHours string.
 * @param {string} openingHours e.g. "09:00 AM - 10:00 PM"
 * @returns {{ isOpen: boolean, statusText: string, timingText: string, hoursLabel: string }}
 */
export const isShopCurrentlyOpen = (openingHours) => {
  const parsed = parseShopHours(openingHours);
  if (!parsed) {
    // If opening hours are not specified, default to open with informative text
    return {
      isOpen: true,
      statusText: "Open Now",
      timingText: "Regular Business Hours",
      hoursLabel: "Open Regular Hours",
    };
  }

  const { startMinutes, endMinutes, startFormatted, endFormatted } = parsed;
  const currentMinutes = getCurrentISTMinutes();

  let isOpen = false;
  if (startMinutes <= endMinutes) {
    isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight hours (e.g. 8:00 PM to 2:00 AM)
    isOpen = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  let statusText = isOpen ? "Open Now" : "Closed";
  let timingText = "";

  if (isOpen) {
    timingText = `Closes at ${endFormatted}`;
  } else {
    if (currentMinutes < startMinutes) {
      timingText = `Opens today at ${startFormatted}`;
    } else {
      timingText = `Opens tomorrow at ${startFormatted}`;
    }
  }

  return {
    isOpen,
    statusText,
    timingText,
    hoursLabel: `${startFormatted} - ${endFormatted}`,
  };
};

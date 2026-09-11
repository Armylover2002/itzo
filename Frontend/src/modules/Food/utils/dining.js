/** Shared formatting helpers for the Dining feature (admin + restaurant + user). */

/** "18:00" -> "6:00 PM". Falls back to the raw input if it isn't HH:mm. */
export const formatTime12Hour = (time24) => {
  if (!time24 || typeof time24 !== "string" || !time24.includes(":")) return time24 || ""
  const [h, m] = time24.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time24
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

/** "18:00" + "19:00" -> "6:00 PM - 7:00 PM" */
export const formatSlotRange = (slotStart, slotEnd) => {
  const start = formatTime12Hour(slotStart)
  if (!slotEnd) return start
  return `${start} - ${formatTime12Hour(slotEnd)}`
}

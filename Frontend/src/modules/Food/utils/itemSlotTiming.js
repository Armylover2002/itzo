export const formatSlotTime12Hour = (time24) => {
  const raw = String(time24 || "").trim()
  if (!raw) return ""
  const [hoursPart, minutesPart] = raw.split(":")
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw

  const period = hours >= 12 ? "PM" : "AM"
  const hours12 = hours % 12 || 12
  const minutesStr = String(minutes).padStart(2, "0")
  return `${hours12}:${minutesStr} ${period}`
}

export const getFoodItemSlotTiming = (item = {}) => {
  const slot = item?.itemSlotTiming
  if (slot && (slot.endTime || slot.startTime)) return slot
  return null
}

export const getFoodItemSlotAvailabilityText = (item = {}) => {
  const slot = getFoodItemSlotTiming(item)
  if (!slot?.endTime) return null
  return `Available till ${formatSlotTime12Hour(slot.endTime)}`
}

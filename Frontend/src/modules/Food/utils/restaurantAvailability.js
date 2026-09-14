const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const normalizeDay = (value) => {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  const match = DAY_NAMES.find((day) => day.toLowerCase() === trimmed)
  if (match) return match

  const abbreviatedMatch = DAY_NAMES.find((day) =>
    day.toLowerCase().startsWith(trimmed.slice(0, 3))
  )
  return abbreviatedMatch || null
}

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== "string") return null
  const raw = timeValue.trim()
  if (!raw) return null

  const normalized = raw.toLowerCase()
  const meridiemMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/)
  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2])
    const period = meridiemMatch[3]

    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null

    if (period === "pm" && hour < 12) hour += 12
    if (period === "am" && hour === 12) hour = 0
    if (hour < 0 || hour > 23) return null
    return hour * 60 + minute
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!twentyFourHourMatch) return null

  const hour = Number(twentyFourHourMatch[1])
  const minute = Number(twentyFourHourMatch[2])
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}

const getTodayTiming = (restaurant, dayName) => {
  const outletTimingsArray = restaurant?.outletTimings?.timings
  if (Array.isArray(outletTimingsArray)) {
    const exact = outletTimingsArray.find((entry) => normalizeDay(entry?.day) === dayName)
    if (exact) return exact
  }

  const outletTimingsObject = restaurant?.outletTimings
  if (outletTimingsObject && typeof outletTimingsObject === "object" && !Array.isArray(outletTimingsObject)) {
    const direct = outletTimingsObject[dayName]
    if (direct && typeof direct === "object") return direct
  }

  return null
}

const isWithinTimeWindow = (nowMinutes, openingMinutes, closingMinutes) => {
  if (openingMinutes === null || closingMinutes === null) return true
  if (openingMinutes === closingMinutes) return true

  if (closingMinutes > openingMinutes) {
    return nowMinutes >= openingMinutes && nowMinutes <= closingMinutes
  }

  return nowMinutes >= openingMinutes || nowMinutes <= closingMinutes
}

const getMinutesUntilClosing = (nowMinutes, openingMinutes, closingMinutes) => {
  if (openingMinutes === null || closingMinutes === null) return null
  if (!isWithinTimeWindow(nowMinutes, openingMinutes, closingMinutes)) return null

  if (closingMinutes > openingMinutes) {
    return closingMinutes - nowMinutes
  }

  if (nowMinutes <= closingMinutes) {
    return closingMinutes - nowMinutes
  }

  return (24 * 60 - nowMinutes) + closingMinutes
}

const formatTimeLabel = (timeValue) => {
  const totalMinutes = parseTimeToMinutes(timeValue)
  if (totalMinutes === null) return timeValue || null

  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const period = hours24 >= 12 ? "PM" : "AM"
  const hours12 = hours24 % 12 || 12

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`
}

const formatClosingCountdown = (minutesUntilClose, closingTime) => {
  if (minutesUntilClose === null || minutesUntilClose === undefined) return null

  if (minutesUntilClose <= 0) {
    const closingLabel = formatTimeLabel(closingTime)
    return closingLabel ? `Closes at ${closingLabel}` : null
  }

  if (minutesUntilClose < 60) {
    return `Closes in ${minutesUntilClose} min`
  }

  const hours = Math.floor(minutesUntilClose / 60)
  const minutes = minutesUntilClose % 60

  if (minutes === 0) {
    return `Closes in ${hours}h`
  }

  return `Closes in ${hours}h ${minutes}m`
}

export const getRestaurantAvailabilityStatus = (restaurant, now = new Date(), options = {}) => {
  if (!restaurant) {
    return {
      isOpen: false,
      isActive: false,
      isAcceptingOrders: false,
      isWithinTimings: false,
      reason: "missing-restaurant",
    }
  }

  const ignoreOperationalStatus = options?.ignoreOperationalStatus === true
  const isActive = restaurant.isActive !== false
  const isAcceptingOrders = restaurant.isAcceptingOrders !== false

  if (!ignoreOperationalStatus && !isActive) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "inactive",
    }
  }

  if (!ignoreOperationalStatus && !isAcceptingOrders) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "not-accepting-orders",
    }
  }

  // --- TIMEZONE FIX for Android WebView ---
  // WebView mein new Date() kabhi kabhi UTC time deta hai instead of local IST time.
  // IST = UTC + 5:30 = UTC + 330 minutes
  // Hum Intl.DateTimeFormat use karke IST-aware time nikalte hain
  let istNow = now
  try {
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    const parsed = new Date(istString)
    if (!isNaN(parsed.getTime())) {
      istNow = parsed
    }
  } catch {
    // Fallback: manually add IST offset (UTC+5:30 = 330 minutes)
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000)
    istNow = new Date(utcMs + (330 * 60000))
  }

  const dayName = DAY_NAMES[istNow.getDay()]
  const todayTiming = getTodayTiming(restaurant, dayName)

  // Legacy openDays can get stale; enforce only when no explicit outlet timing exists for today.
  const openDays = Array.isArray(restaurant.openDays) ? restaurant.openDays : []
  if (!todayTiming && openDays.length > 0) {
    const normalizedOpenDays = new Set(openDays.map((day) => normalizeDay(day)).filter(Boolean))
    if (normalizedOpenDays.size > 0 && !normalizedOpenDays.has(dayName)) {
      return {
        isOpen: false,
        isActive,
        isAcceptingOrders,
        isWithinTimings: false,
        reason: "closed-day",
      }
    }
  }

  if (todayTiming?.isOpen === false) {
    return {
      isOpen: false,
      isActive,
      isAcceptingOrders,
      isWithinTimings: false,
      reason: "day-closed",
    }
  }

  const openingTime =
    todayTiming?.openingTime ||
    restaurant?.deliveryTimings?.openingTime ||
    restaurant?.openingTime ||
    null
  const closingTime =
    todayTiming?.closingTime ||
    restaurant?.deliveryTimings?.closingTime ||
    restaurant?.closingTime ||
    null

  const openingMinutes = parseTimeToMinutes(openingTime)
  const closingMinutes = parseTimeToMinutes(closingTime)
  const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes()
  const hasExplicitWindow = Boolean(openingTime || closingTime)
  // If a restaurant provides only one side of the window, treat timings as not enforced
  // (prevents accidental "offline" due to partial data).
  const isWithinTimings = hasExplicitWindow
    ? (openingMinutes !== null && closingMinutes !== null
      ? isWithinTimeWindow(nowMinutes, openingMinutes, closingMinutes)
      : true)
    : true
  const minutesUntilClose = isWithinTimings
    ? getMinutesUntilClosing(nowMinutes, openingMinutes, closingMinutes)
    : null

  return {
    isOpen: isWithinTimings,
    isActive,
    isAcceptingOrders,
    isWithinTimings,
    openingTime,
    closingTime,
    minutesUntilClose,
    closingCountdownLabel: isWithinTimings
      ? formatClosingCountdown(minutesUntilClose, closingTime)
      : null,
    reason: isWithinTimings
      ? (isAcceptingOrders ? "open" : "open-by-timings")
      : (hasExplicitWindow ? "outside-hours" : "no-timings"),
  }
}

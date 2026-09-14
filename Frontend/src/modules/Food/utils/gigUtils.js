/**
 * Gig Booking Utility Functions
 * Helper functions for date generation, slot creation, and validation
 */

import { USER_LEVELS } from '@food/store/gigStore'

/**
 * Generate available dates based on user level
 * @param {string} userLevel - User level (Blue, Brown, Silver, Diamond)
 * @returns {Array} - Array of date objects
 */
export const generateAvailableDates = (userLevel = 'Brown') => {
  const days = USER_LEVELS[userLevel]?.days || 2
  const dates = []
  const today = new Date()
  
  for (let i = 0; i <= days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    date.setHours(0, 0, 0, 0)
    
    const isToday = i === 0
    const isTomorrow = i === 1
    
    dates.push({
      date: formatDateKey(date),
      displayDate: formatDisplayDate(date, isToday, isTomorrow),
      fullDate: new Date(date),
      isToday,
      isTomorrow
    })
  }
  
  return dates
}

/**
 * Format date as key (YYYY-MM-DD)
 */
export const formatDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date for display
 */
export const formatDisplayDate = (date, isToday = false, isTomorrow = false) => {
  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'
  
  const d = new Date(date)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  
  return `${dayName} - ${day} ${month}`
}

/**
 * Generate time slots for a date
 * @param {string} dateKey - Date key (YYYY-MM-DD)
 * @returns {Array} - Array of time slot objects
 */
export const generateTimeSlots = (dateKey) => {
  // Standard time slots: 1-2 hour intervals
  const slots = [
    { start: '08:00', end: '10:00', duration: 2 },
    { start: '10:00', end: '12:00', duration: 2 },
    { start: '12:00', end: '14:00', duration: 2 },
    { start: '14:00', end: '16:00', duration: 2 },
    { start: '16:00', end: '18:00', duration: 2 },
    { start: '18:00', end: '20:00', duration: 2 },
    { start: '20:00', end: '22:00', duration: 2 }
  ]

  return slots.map(slot => ({
    date: dateKey,
    startTime: slot.start,
    endTime: slot.end,
    duration: slot.duration,
    id: `${dateKey}-${slot.start}-${slot.end}`
  }))
}

/**
 * Format time for display (e.g., "10:00" -> "10 AM")
 */
export const formatTimeDisplay = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Calculate total hours from selected slots
 */
export const calculateTotalHours = (slots) => {
  return slots.reduce((total, slot) => {
    return total + (slot.duration || 0)
  }, 0)
}

/**
 * Get time range string from slots
 */
export const getTimeRangeString = (slots) => {
  if (slots.length === 0) return ''
  
  // Sort slots by start time
  const sorted = slots.toSorted((a, b) => a.startTime.localeCompare(b.startTime))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  
  return `${formatTimeDisplay(first.startTime)} - ${formatTimeDisplay(last.endTime)}`
}

/**
 * Check if a date is available (not in the past and within advance limit)
 */
export const isDateAvailable = (dateKey, userLevel = 'Brown') => {
  const date = new Date(dateKey)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Can't book past dates
  if (date < today) return false
  
  // Check advance limit
  const days = USER_LEVELS[userLevel]?.days || 2
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + days)
  
  return date <= maxDate
}

/**
 * Get level badge color
 */
export const getLevelBadgeColor = (level) => {
  return USER_LEVELS[level]?.color || '#6b7280'
}

/**
 * Get level icon
 */
export const getLevelIcon = (level) => {
  return USER_LEVELS[level]?.icon || '💙'
}

/**
 * Check if slot is in the past
 */
export const isSlotInPast = (slot) => {
  const now = new Date()
  const slotDate = new Date(slot.date)
  const [hours, minutes] = slot.startTime.split(':').map(Number)
  slotDate.setHours(hours, minutes, 0, 0)
  
  return slotDate < now
}

/**
 * Get gig status badge color
 */
export const getGigStatusColor = (status) => {
  switch (status) {
    case 'booked':
      return 'bg-blue-100 text-blue-800'
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-gray-100 text-gray-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Sort gigs by date (most recent first)
 */
export const sortGigsByDate = (gigs) => {
  return gigs.toSorted((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    return dateB - dateA
  })
}

/**
 * Categorize slots by meal time
 */
export const categorizeSlotsByMeal = (slots) => {
  const categories = {
    breakfast: { name: 'Breakfast Gigs', start: '06:00', end: '11:00', icon: '🌅', slots: [] },
    lunch: { name: 'Lunch Gigs', start: '11:00', end: '15:00', icon: '☀️', slots: [] },
    dinner: { name: 'Dinner Gigs', start: '15:00', end: '22:00', icon: '🌙', slots: [] }
  }

  slots.forEach(slot => {
    const startHour = parseInt(slot.startTime.split(':')[0])
    
    if (startHour >= 6 && startHour < 11) {
      categories.breakfast.slots.push(slot)
    } else if (startHour >= 11 && startHour < 15) {
      categories.lunch.slots.push(slot)
    } else if (startHour >= 15 && startHour < 22) {
      categories.dinner.slots.push(slot)
    }
  })

  // Filter out empty categories
  return Object.values(categories).filter(cat => cat.slots.length > 0)
}

/**
 * Generate pay rate for a slot based on time and demand
 */
export const generatePayRate = (slot) => {
  const startHour = parseInt(slot.startTime.split(':')[0])
  let baseMin = 70
  let baseMax = 100

  // Adjust based on time of day
  if (startHour >= 6 && startHour < 11) {
    // Breakfast: ₹70-₹100
    baseMin = 70
    baseMax = 100
  } else if (startHour >= 11 && startHour < 15) {
    // Lunch: ₹90-₹120
    baseMin = 90
    baseMax = 120
  } else if (startHour >= 15 && startHour < 19) {
    // Afternoon: ₹100-₹130
    baseMin = 100
    baseMax = 130
  } else {
    // Evening: ₹110-₹140
    baseMin = 110
    baseMax = 140
  }

  // Add variation based on duration
  const durationBonus = (slot.duration - 2) * 5
  return {
    min: baseMin + durationBonus,
    max: baseMax + durationBonus
  }
}

/**
 * Get time range for a category
 */
export const getCategoryTimeRange = (category) => {
  if (category.slots.length === 0) return ''
  
  const sorted = category.slots.toSorted((a, b) => a.startTime.localeCompare(b.startTime))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  
  return `${formatTimeDisplay(first.startTime)} - ${formatTimeDisplay(last.endTime)}`
}


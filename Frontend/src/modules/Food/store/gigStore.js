const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Gig Booking State Management using Zustand
 * Manages gig slots, bookings, user level, and online status
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// User level configuration
export const USER_LEVELS = {
  Blue: { days: 1, color: '#3b82f6', icon: '💙' },
  Brown: { days: 2, color: '#92400e', icon: '🤎' },
  Silver: { days: 3, color: '#6b7280', icon: '💿' },
  Diamond: { days: 4, color: '#60a5fa', icon: '💎' }
}

// Default state
const DEFAULT_STATE = {
  selectedSlots: [],
  bookedGigs: [],
  userLevel: 'Brown', // Default level
  isOnline: true,
  currentGig: null, // Currently active gig
  zoneMapVisible: false,
  selectedDropLocation: null // Selected drop location
}

/**
 * Get user level from localStorage or return default
 */
const getUserLevel = () => {
  try {
    const level = localStorage.getItem('delivery_user_level')
    return level || DEFAULT_STATE.userLevel
  } catch {
    return DEFAULT_STATE.userLevel
  }
}

/**
 * Get selected drop location from localStorage or return null
 */
const getSelectedDropLocation = () => {
  try {
    return localStorage.getItem('selectedDropLocation') || null
  } catch {
    return null
  }
}

/**
 * Gig Store
 */
export const useGigStore = create(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      userLevel: getUserLevel(),
      selectedDropLocation: getSelectedDropLocation(),

      // Set user level
      setUserLevel: (level) => {
        localStorage.setItem('delivery_user_level', level)
        set({ userLevel: level })
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
      },

      // Toggle slot selection
      toggleSlot: (slot) => {
        const { selectedSlots } = get()
        const slotId = `${slot.date}-${slot.startTime}-${slot.endTime}`
        
        // Check if slot is already selected
        const isSelected = selectedSlots.some(s => 
          s.date === slot.date && 
          s.startTime === slot.startTime && 
          s.endTime === slot.endTime
        )

        if (isSelected) {
          // Remove slot
          set({
            selectedSlots: selectedSlots.filter(s => 
              !(s.date === slot.date && s.startTime === slot.startTime && s.endTime === slot.endTime)
            )
          })
        } else {
          // Add slot and validate consecutiveness
          const newSlots = [...selectedSlots, slot]
          const validatedSlots = validateConsecutiveSlots(newSlots)
          set({ selectedSlots: validatedSlots })
        }
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
      },

      // Clear selected slots
      clearSelectedSlots: () => {
        set({ selectedSlots: [] })
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
      },

      // Book gig (save selected slots as booked)
      bookGig: () => {
        const { selectedSlots, userLevel } = get()
        if (selectedSlots.length === 0) return false

        // Group slots by date
        const slotsByDate = {}
        selectedSlots.forEach(slot => {
          if (!slotsByDate[slot.date]) {
            slotsByDate[slot.date] = []
          }
          slotsByDate[slot.date].push(slot)
        })

        // Create gig entries for each date
        const newGigs = Object.entries(slotsByDate).map(([date, slots]) => {
          // Sort slots by time
          const sortedSlots = slots.sort((a, b) => 
            a.startTime.localeCompare(b.startTime)
          )
          
          const startTime = sortedSlots[0].startTime
          const endTime = sortedSlots[sortedSlots.length - 1].endTime
          const totalHours = calculateTotalHours(slots)

          return {
            id: `gig-${date}-${Date.now()}`,
            date,
            slots: sortedSlots,
            startTime,
            endTime,
            totalHours,
            status: 'booked',
            bookedAt: new Date().toISOString(),
            userLevel
          }
        })

        set(state => ({
          bookedGigs: [...state.bookedGigs, ...newGigs],
          selectedSlots: [],
          currentGig: newGigs[0] // Set first gig as current
        }))

        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
        window.dispatchEvent(new CustomEvent('gigBooked'))
        return true
      },

      // Go online (activate current gig)
      goOnline: () => {
        const { currentGig, bookedGigs } = get()
        
        // If no current gig, find the next upcoming gig
        let gigToActivate = currentGig
        if (!gigToActivate && bookedGigs.length > 0) {
          const now = new Date()
          const upcomingGig = bookedGigs
            .filter(gig => {
              const gigDate = new Date(gig.date)
              gigDate.setHours(0, 0, 0, 0)
              return gigDate >= now && gig.status === 'booked'
            })
            .reduce((earliest, gig) =>
              !earliest || new Date(gig.date) < new Date(earliest.date) ? gig : earliest
            , null)
          
          if (upcomingGig) {
            gigToActivate = upcomingGig
          }
        }

        if (!gigToActivate) return false

        // Update gig status to active
        const updatedGigs = bookedGigs.map(gig => 
          gig.id === gigToActivate.id 
            ? { ...gig, status: 'active', startedAt: new Date().toISOString() }
            : gig
        )

        set({
          isOnline: true,
          bookedGigs: updatedGigs,
          currentGig: { ...gigToActivate, status: 'active', startedAt: new Date().toISOString() },
          zoneMapVisible: true
        })

        localStorage.setItem('delivery_online_status', 'true')
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
        window.dispatchEvent(new CustomEvent('deliveryOnlineStatusChanged'))
        return true
      },

      // Go offline
      goOffline: () => {
        const { currentGig, bookedGigs } = get()
        
        // Update current gig status to completed if active
        let updatedGigs = bookedGigs
        if (currentGig && currentGig.status === 'active') {
          updatedGigs = bookedGigs.map(gig => 
            gig.id === currentGig.id 
              ? { ...gig, status: 'completed', completedAt: new Date().toISOString() }
              : gig
          )
        }

        set({
          isOnline: false,
          bookedGigs: updatedGigs,
          currentGig: null,
          zoneMapVisible: false
        })

        localStorage.setItem('delivery_online_status', 'false')
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
        window.dispatchEvent(new CustomEvent('deliveryOnlineStatusChanged'))
      },

      // Set current gig
      setCurrentGig: (gig) => {
        set({ currentGig: gig })
        window.dispatchEvent(new CustomEvent('gigStateUpdated'))
      },

      // Toggle zone map visibility
      toggleZoneMap: () => {
        set(state => ({ zoneMapVisible: !state.zoneMapVisible }))
      },

      // Get available advance days based on user level
      getAdvanceDays: () => {
        const { userLevel } = get()
        return USER_LEVELS[userLevel]?.days || 1
      },

      // Check if slot is booked
      isSlotBooked: (slot) => {
        const { bookedGigs } = get()
        return bookedGigs.some(gig => 
          gig.date === slot.date &&
          gig.slots.some(s => 
            s.startTime === slot.startTime && s.endTime === slot.endTime
          )
        )
      },

      // Get booked slots for a date
      getBookedSlotsForDate: (date) => {
        const { bookedGigs } = get()
        const gig = bookedGigs.find(g => g.date === date)
        return gig ? gig.slots : []
      },

      // Set selected drop location
      setSelectedDropLocation: (location) => {
        localStorage.setItem('selectedDropLocation', location)
        set({ selectedDropLocation: location })
        window.dispatchEvent(new CustomEvent('dropLocationUpdated'))
      },

      // Get selected drop location
      getSelectedDropLocation: () => {
        const { selectedDropLocation } = get()
        return selectedDropLocation || localStorage.getItem('selectedDropLocation')
      }
    }),
    {
      name: 'delivery_gig_storage',
      partialize: (state) => ({
        bookedGigs: state.bookedGigs,
        userLevel: state.userLevel,
        isOnline: state.isOnline,
        currentGig: state.currentGig,
        selectedDropLocation: state.selectedDropLocation
      })
    }
  )
)

/**
 * Validate that slots are consecutive
 */
function validateConsecutiveSlots(slots) {
  if (slots.length === 0) return []
  
  // Group by date
  const slotsByDate = {}
  slots.forEach(slot => {
    if (!slotsByDate[slot.date]) {
      slotsByDate[slot.date] = []
    }
    slotsByDate[slot.date].push(slot)
  })

  // Validate each date's slots
  const validatedSlots = []
  Object.entries(slotsByDate).forEach(([date, dateSlots]) => {
    // Sort by start time
    const sorted = dateSlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
    
    // Check consecutiveness
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        validatedSlots.push(sorted[i])
      } else {
        const prev = sorted[i - 1]
        const current = sorted[i]
        
        // Check if current slot starts when previous ends
        if (prev.endTime === current.startTime) {
          validatedSlots.push(current)
        } else {
          // Not consecutive, remove this and all following slots for this date
          break
        }
      }
    }
  })

  return validatedSlots
}

/**
 * Calculate total hours from slots
 */
function calculateTotalHours(slots) {
  return slots.reduce((total, slot) => {
    const start = parseTime(slot.startTime)
    const end = parseTime(slot.endTime)
    const hours = (end - start) / (1000 * 60 * 60)
    return total + hours
  }, 0)
}

/**
 * Parse time string to Date object (for calculation)
 */
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

/**
 * Initialize online status from localStorage
 */
export const initializeOnlineStatus = () => {
  try {
    const isOnline = localStorage.getItem('delivery_online_status') === 'true'
    if (isOnline) {
      useGigStore.setState({ isOnline: true })
    }
  } catch (error) {
    debugError('Error initializing online status:', error)
  }
}



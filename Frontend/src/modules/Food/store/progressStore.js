/**
 * Today's Progress State Management using Zustand
 * Manages today's earnings, trips, and time on orders data
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Default state
const DEFAULT_STATE = {
  todayProgress: {
    earnings: 0,
    trips: 0,
    timeOnOrders: 0, // in hours
    lastUpdated: null
  },
  // Store data by date for historical tracking
  dailyData: {}
}

/**
 * Get today's date key
 */
const getTodayKey = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

/**
 * Progress Store
 */
export const useProgressStore = create(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      // Update today's earnings
      updateTodayEarnings: (earnings) => {
        const todayKey = getTodayKey()
        const state = get()
        const todayData = state.dailyData[todayKey] || { earnings: 0, trips: 0, timeOnOrders: 0 }
        
        set({
          todayProgress: {
            ...state.todayProgress,
            earnings,
            lastUpdated: new Date().toISOString()
          },
          dailyData: {
            ...state.dailyData,
            [todayKey]: {
              ...todayData,
              earnings
            }
          }
        })
        window.dispatchEvent(new CustomEvent('progressDataUpdated'))
      },

      // Update today's trips count
      updateTodayTrips: (trips) => {
        const todayKey = getTodayKey()
        const state = get()
        const todayData = state.dailyData[todayKey] || { earnings: 0, trips: 0, timeOnOrders: 0 }
        
        set({
          todayProgress: {
            ...state.todayProgress,
            trips,
            lastUpdated: new Date().toISOString()
          },
          dailyData: {
            ...state.dailyData,
            [todayKey]: {
              ...todayData,
              trips
            }
          }
        })
        window.dispatchEvent(new CustomEvent('progressDataUpdated'))
      },

      // Update today's time on orders (in hours)
      updateTodayTimeOnOrders: (hours) => {
        const todayKey = getTodayKey()
        const state = get()
        const todayData = state.dailyData[todayKey] || { earnings: 0, trips: 0, timeOnOrders: 0 }
        
        set({
          todayProgress: {
            ...state.todayProgress,
            timeOnOrders: hours,
            lastUpdated: new Date().toISOString()
          },
          dailyData: {
            ...state.dailyData,
            [todayKey]: {
              ...todayData,
              timeOnOrders: hours
            }
          }
        })
        window.dispatchEvent(new CustomEvent('progressDataUpdated'))
      },

      // Update all today's progress at once
      updateTodayProgress: (data) => {
        const todayKey = getTodayKey()
        const state = get()
        const todayData = state.dailyData[todayKey] || { earnings: 0, trips: 0, timeOnOrders: 0 }
        
        set({
          todayProgress: {
            earnings: data.earnings ?? state.todayProgress.earnings,
            trips: data.trips ?? state.todayProgress.trips,
            timeOnOrders: data.timeOnOrders ?? state.todayProgress.timeOnOrders,
            lastUpdated: new Date().toISOString()
          },
          dailyData: {
            ...state.dailyData,
            [todayKey]: {
              earnings: data.earnings ?? todayData.earnings,
              trips: data.trips ?? todayData.trips,
              timeOnOrders: data.timeOnOrders ?? todayData.timeOnOrders
            }
          }
        })
        window.dispatchEvent(new CustomEvent('progressDataUpdated'))
      },

      // Get today's progress
      getTodayProgress: () => {
        const todayKey = getTodayKey()
        const state = get()
        const todayData = state.dailyData[todayKey]
        
        // If we have data for today, use it; otherwise use todayProgress
        if (todayData) {
          return {
            earnings: todayData.earnings,
            trips: todayData.trips,
            timeOnOrders: todayData.timeOnOrders
          }
        }
        
        return state.todayProgress
      },

      // Get data for a specific date
      getDateData: (date) => {
        const state = get()
        const dateKey = typeof date === 'string' ? date : 
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return state.dailyData[dateKey] || { earnings: 0, trips: 0, timeOnOrders: 0 }
      },

      // Check if data exists for a specific date
      hasDateData: (date) => {
        const state = get()
        const dateKey = typeof date === 'string' ? date : 
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return !!state.dailyData[dateKey]
      },

      // Reset today's progress (useful for new day)
      resetTodayProgress: () => {
        const todayKey = getTodayKey()
        set({
          todayProgress: {
            earnings: 0,
            trips: 0,
            timeOnOrders: 0,
            lastUpdated: new Date().toISOString()
          }
        })
        window.dispatchEvent(new CustomEvent('progressDataUpdated'))
      }
    }),
    {
      name: 'delivery_progress_storage',
      partialize: (state) => ({
        todayProgress: state.todayProgress,
        dailyData: state.dailyData
      })
    }
  )
)


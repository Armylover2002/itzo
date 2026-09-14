const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Delivery Module State Management using Zustand
 * Manages general delivery module data with localStorage persistence
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Default state
const DEFAULT_STATE = {
  // User preferences
  preferences: {
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    theme: 'light'
  },
  
  // App state
  appState: {
    lastActiveTime: null,
    onboardingCompleted: false,
    version: '1.0.0'
  },
  
  // Cache data
  cache: {
    restaurants: [],
    orders: [],
    lastUpdated: null
  },
  
  // Custom data storage (for flexible use)
  customData: {}
}

/**
 * Delivery Store
 */
export const useDeliveryStore = create(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      // ============ Preferences ============
      
      /**
       * Update user preferences
       * @param {Object} updates - Partial preferences object
       */
      updatePreferences: (updates) => {
        set(state => ({
          preferences: {
            ...state.preferences,
            ...updates
          }
        }))
        window.dispatchEvent(new CustomEvent('deliveryPreferencesUpdated'))
      },

      /**
       * Toggle notification preference
       */
      toggleNotifications: () => {
        set(state => ({
          preferences: {
            ...state.preferences,
            notificationsEnabled: !state.preferences.notificationsEnabled
          }
        }))
        window.dispatchEvent(new CustomEvent('deliveryPreferencesUpdated'))
      },

      /**
       * Toggle sound preference
       */
      toggleSound: () => {
        set(state => ({
          preferences: {
            ...state.preferences,
            soundEnabled: !state.preferences.soundEnabled
          }
        }))
        window.dispatchEvent(new CustomEvent('deliveryPreferencesUpdated'))
      },

      /**
       * Toggle vibration preference
       */
      toggleVibration: () => {
        set(state => ({
          preferences: {
            ...state.preferences,
            vibrationEnabled: !state.preferences.vibrationEnabled
          }
        }))
        window.dispatchEvent(new CustomEvent('deliveryPreferencesUpdated'))
      },

      /**
       * Set theme preference
       * @param {string} theme - Theme value ('light' | 'dark')
       */
      setTheme: (theme) => {
        set(state => ({
          preferences: {
            ...state.preferences,
            theme
          }
        }))
        window.dispatchEvent(new CustomEvent('deliveryPreferencesUpdated'))
      },

      // ============ App State ============

      /**
       * Update app state
       * @param {Object} updates - Partial app state object
       */
      updateAppState: (updates) => {
        set(state => ({
          appState: {
            ...state.appState,
            ...updates
          }
        }))
      },

      /**
       * Mark onboarding as completed
       */
      completeOnboarding: () => {
        set(state => ({
          appState: {
            ...state.appState,
            onboardingCompleted: true
          }
        }))
      },

      /**
       * Update last active time
       */
      updateLastActiveTime: () => {
        set(state => ({
          appState: {
            ...state.appState,
            lastActiveTime: new Date().toISOString()
          }
        }))
      },

      // ============ Cache Management ============

      /**
       * Update cache data
       * @param {string} key - Cache key ('restaurants' | 'orders')
       * @param {any} data - Data to cache
       */
      updateCache: (key, data) => {
        set(state => ({
          cache: {
            ...state.cache,
            [key]: data,
            lastUpdated: new Date().toISOString()
          }
        }))
      },

      /**
       * Clear cache
       * @param {string} key - Optional specific cache key to clear, or 'all' to clear all
       */
      clearCache: (key = 'all') => {
        if (key === 'all') {
          set({
            cache: {
              restaurants: [],
              orders: [],
              lastUpdated: null
            }
          })
        } else {
          set(state => ({
            cache: {
              ...state.cache,
              [key]: key === 'restaurants' ? [] : [],
              lastUpdated: new Date().toISOString()
            }
          }))
        }
      },

      /**
       * Get cached data
       * @param {string} key - Cache key
       * @returns {any} Cached data or null
       */
      getCachedData: (key) => {
        const { cache } = get()
        return cache[key] || null
      },

      /**
       * Check if cache is stale
       * @param {number} maxAgeMinutes - Maximum age in minutes (default: 30)
       * @returns {boolean} True if cache is stale
       */
      isCacheStale: (maxAgeMinutes = 30) => {
        const { cache } = get()
        if (!cache.lastUpdated) return true
        
        const lastUpdated = new Date(cache.lastUpdated)
        const now = new Date()
        const diffMinutes = (now - lastUpdated) / (1000 * 60)
        
        return diffMinutes > maxAgeMinutes
      },

      // ============ Custom Data Storage ============

      /**
       * Set custom data
       * @param {string} key - Data key
       * @param {any} value - Data value
       */
      setCustomData: (key, value) => {
        set(state => ({
          customData: {
            ...state.customData,
            [key]: value
          }
        }))
      },

      /**
       * Get custom data
       * @param {string} key - Data key
       * @param {any} defaultValue - Default value if key doesn't exist
       * @returns {any} Data value or defaultValue
       */
      getCustomData: (key, defaultValue = null) => {
        const { customData } = get()
        return customData[key] !== undefined ? customData[key] : defaultValue
      },

      /**
       * Remove custom data
       * @param {string} key - Data key to remove
       */
      removeCustomData: (key) => {
        set(state => {
          const newCustomData = { ...state.customData }
          delete newCustomData[key]
          return { customData: newCustomData }
        })
      },

      /**
       * Clear all custom data
       */
      clearCustomData: () => {
        set({ customData: {} })
      },

      // ============ Utility Methods ============

      /**
       * Reset store to default state
       */
      reset: () => {
        set({ ...DEFAULT_STATE })
        window.dispatchEvent(new CustomEvent('deliveryStoreReset'))
      },

      /**
       * Export store data as JSON
       * @returns {string} JSON string of store data
       */
      exportData: () => {
        const state = get()
        return JSON.stringify(state, null, 2)
      },

      /**
       * Import store data from JSON
       * @param {string} jsonData - JSON string to import
       */
      importData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData)
          set(data)
          window.dispatchEvent(new CustomEvent('deliveryStoreImported'))
        } catch (error) {
          debugError('Error importing delivery store data:', error)
          throw new Error('Invalid JSON data')
        }
      }
    }),
    {
      name: 'delivery_module_storage',
      partialize: (state) => ({
        preferences: state.preferences,
        appState: state.appState,
        cache: state.cache,
        customData: state.customData
      })
    }
  )
)

/**
 * Initialize delivery store
 * Call this on app startup if needed
 */
export const initializeDeliveryStore = () => {
  try {
    const store = useDeliveryStore.getState()
    store.updateLastActiveTime()
  } catch (error) {
    debugError('Error initializing delivery store:', error)
  }
}



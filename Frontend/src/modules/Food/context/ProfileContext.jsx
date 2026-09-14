import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI, invalidateUserMeCache } from "@food/api"
import { clearUserSession } from "@food/utils/auth"
import {
  getCachedUserProfile,
  setCachedUserProfile,
  getCachedUserAddresses,
  setCachedUserAddresses,
  invalidateUserSessionCache,
} from "@food/utils/userSessionCache"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const ProfileContext = createContext(null)
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters", "activeAddressId", "deliveryAddressMode"]

export function ProfileProvider({ children }) {
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    const normalized = String(label || "").trim().toLowerCase()
    if (normalized === "current location") return "Current Location"
    if (normalized === "home") return "Home"
    if (normalized === "office" || normalized === "work") return "Office"
    return "Other"
  }
  const normalizeAddress = (address) => {
    if (!address || typeof address !== "object") return null
    const id = getAddressId(address)
    return {
      ...address,
      label: normalizeAddressLabel(address.label),
      ...(id ? { id: String(id) } : {}),
    }
  }
  const dedupeAddressesByLabel = (addressList = []) => {
    const addressMap = new Map()
    addressList.forEach((addr, index) => {
      const normalizedAddress = normalizeAddress(addr)
      if (!normalizedAddress) return
      const key = normalizedAddress.label || getAddressId(normalizedAddress) || index
      // Keep latest address for each label so newly saved Home/Work/Other is visible immediately
      addressMap.set(key, normalizedAddress)
    })
    return Array.from(addressMap.values())
  }
  const syncAddressesToStorage = (nextAddresses) => {
    localStorage.setItem("userAddresses", JSON.stringify(nextAddresses))
  }
  const getUserSessionToken = () =>
    localStorage.getItem("user_accessToken") ||
    localStorage.getItem("auth_customer") ||
    localStorage.getItem("accessToken") ||
    null
  const hasUserSession = Boolean(getUserSessionToken())

  const [userProfile, setUserProfile] = useState(() => {
    if (!hasUserSession) return null
    const cached = getCachedUserProfile()
    if (cached) return cached
    const userStr = localStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        debugError("Error parsing user_user from localStorage:", e)
      }
    }
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        debugError("Error parsing userProfile from localStorage:", e)
      }
    }
    return null
  })
  
  const [loading, setLoading] = useState(() => {
    if (!hasUserSession) return false
    return !getCachedUserProfile()
  })
  const [addresses, setAddresses] = useState(() => {
    if (!hasUserSession) return []
    const cached = getCachedUserAddresses()
    if (cached?.length) return cached
    try {
      const saved = localStorage.getItem("userAddresses")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [paymentMethods, setPaymentMethods] = useState(() => {
    if (!hasUserSession) return []
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : []
  })

  const [favorites, setFavorites] = useState(() => {
    if (!hasUserSession) return []
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    if (!hasUserSession) return []
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    if (!hasUserSession) return false
    const saved = localStorage.getItem("userVegMode")
    // Support new string values 'pure', 'all' or legacy boolean
    if (saved === "pure" || saved === "all") return saved
    if (saved === "true") return "pure" // Legacy migration
    return false
  })

  // Helper to check if authenticated
  const isAuthenticated = Boolean(getUserSessionToken())

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    if (userProfile || isAuthenticated) {
      localStorage.setItem("userProfile", JSON.stringify(userProfile))
    }
  }, [userProfile, isAuthenticated])

  useEffect(() => {
    if (addresses.length > 0 || isAuthenticated) {
      localStorage.setItem("userAddresses", JSON.stringify(addresses))
    }
  }, [addresses, isAuthenticated])

  useEffect(() => {
    if (paymentMethods.length > 0 || isAuthenticated) {
      localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
    }
  }, [paymentMethods, isAuthenticated])

  useEffect(() => {
    if (favorites.length > 0 || isAuthenticated) {
      localStorage.setItem("userFavorites", JSON.stringify(favorites))
    }
  }, [favorites, isAuthenticated])

  useEffect(() => {
    if (dishFavorites.length > 0 || isAuthenticated) {
      localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
    }
  }, [dishFavorites, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("userVegMode", vegMode.toString())
    }
  }, [vegMode, isAuthenticated])

  // Single Source of Truth for Selected Address
  const [activeAddressId, setActiveAddressIdState] = useState(() => {
    if (!hasUserSession) return null
    return localStorage.getItem("activeAddressId") || null
  })

  const setActiveAddressId = useCallback((id) => {
    if (id) {
      localStorage.setItem("activeAddressId", id)
    } else {
      localStorage.removeItem("activeAddressId")
    }
    setActiveAddressIdState(id)
  }, [])

  const activeAddress = useMemo(() => {
    if (activeAddressId) {
      const match = addresses.find(a => String(getAddressId(a)) === String(activeAddressId))
      if (match) return match
    }

    // Fallback: If legacy deliveryAddressMode was "current", use the current location document from MongoDB
    const legacyMode = localStorage.getItem("deliveryAddressMode")
    if (legacyMode === "current") {
      const curr = addresses.find(a => a.type === "current")
      if (curr) return curr
    }

    // Default to default address or first available saved address
    return addresses.find((addr) => addr.isDefault) || addresses.find(a => a.type !== "current") || addresses[0] || null
  }, [addresses, activeAddressId])

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    let cancelled = false

    const fetchUserProfile = async (forceRefresh = false) => {
      // Check if user is authenticated
      const isAuthenticated = Boolean(getUserSessionToken())
      
      if (!isAuthenticated) {
        if (cancelled) return
        setUserProfile(null)
        setAddresses([])
        setPaymentMethods([])
        setFavorites([])
        setDishFavorites([])
        setVegMode(false)
        clearUserSession()
        invalidateUserSessionCache()
        USER_SESSION_PREFERENCE_KEYS.forEach((key) => {
          localStorage.removeItem(key)
        })
        setLoading(false)
        return
      }

      const cachedProfile = forceRefresh ? null : getCachedUserProfile()
      const cachedAddresses = forceRefresh ? null : getCachedUserAddresses()
      if (cachedProfile && !cancelled) {
        setUserProfile(cachedProfile)
      }
      if (cachedAddresses && !cancelled) {
        setAddresses(dedupeAddressesByLabel(cachedAddresses))
      }
      if (cachedProfile && cachedAddresses) {
        if (!cancelled) setLoading(false)
        // Background refresh so admin COD / status changes are not stuck behind cache.
        invalidateUserMeCache()
        authAPI.getCurrentUser()
          .then((response) => {
            if (cancelled) return
            const userData = response?.data?.data?.user || response?.data?.user || response?.data
            if (userData) {
              setUserProfile(userData)
              setCachedUserProfile(userData)
              localStorage.setItem("user_user", JSON.stringify(userData))
              localStorage.setItem("userProfile", JSON.stringify(userData))
            }
          })
          .catch(() => {})
        return
      }

      try {
        if (!cachedProfile && !cancelled) setLoading(true)

        if (!cachedProfile) {
          const response = await authAPI.getCurrentUser()
          const userData = response?.data?.data?.user || response?.data?.user || response?.data

          if (userData && !cancelled) {
            setUserProfile(userData)
            setCachedUserProfile(userData)
            localStorage.setItem("user_user", JSON.stringify(userData))
            localStorage.setItem("userProfile", JSON.stringify(userData))
          }
        }

        if (!cachedAddresses) {
          try {
            const addressesResponse = await userAPI.getAddresses()
            const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
            const normalizedAddresses = dedupeAddressesByLabel(addressesData)
            if (!cancelled) {
              setAddresses(normalizedAddresses)
              setCachedUserAddresses(normalizedAddresses)
              localStorage.setItem("userAddresses", JSON.stringify(normalizedAddresses))
            }
          } catch (addressError) {
            debugError("Error fetching addresses:", addressError)
            const saved = localStorage.getItem("userAddresses")
            if (saved) {
              try {
                if (!cancelled) setAddresses(dedupeAddressesByLabel(JSON.parse(saved)))
              } catch (e) {
                debugError("Error parsing saved addresses:", e)
              }
            }
          }
        }
      } catch (error) {
        debugError("Error fetching user profile:", error)
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            if (!cancelled) setAddresses(dedupeAddressesByLabel(JSON.parse(saved)))
          } catch (e) {
            debugError("Error parsing saved addresses:", e)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchUserProfile()
    
    // Listen for auth changes
    const handleAuthChange = () => {
      invalidateUserMeCache()
      invalidateUserSessionCache()
      fetchUserProfile(true)
    }
    
    window.addEventListener("userAuthChanged", handleAuthChange)
    
    return () => {
      cancelled = true
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  const refreshAddresses = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      userAPI.getAddresses.invalidateCache?.()
    }
    const addressesResponse = await userAPI.getAddresses()
    const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
    const normalizedAddresses = dedupeAddressesByLabel(addressesData)
    setAddresses(normalizedAddresses)
    setCachedUserAddresses(normalizedAddresses)
    syncAddressesToStorage(normalizedAddresses)
    return normalizedAddresses
  }, [])

  // Address functions - memoized with useCallback
  const addAddress = useCallback(async (address) => {
    try {
      const response = await userAPI.addAddress(address)
      const newAddress = response?.data?.data?.address || response?.data?.address
      
      if (newAddress) {
        await refreshAddresses()
        return normalizeAddress(newAddress)
      }
    } catch (error) {
      debugError("Error adding address:", error)
      throw error
    }
  }, [refreshAddresses])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    try {
      const response = await userAPI.updateAddress(id, updatedAddress)
      const updatedAddr = response?.data?.data?.address || response?.data?.address
      
      if (updatedAddr) {
        await refreshAddresses()
        return normalizeAddress(updatedAddr)
      }
    } catch (error) {
      debugError("Error updating address:", error)
      throw error
    }
  }, [refreshAddresses])

  const deleteAddress = useCallback(async (id) => {
    try {
      await userAPI.deleteAddress(id)
      await refreshAddresses()
    } catch (error) {
      debugError("Error deleting address:", error)
      throw error
    }
  }, [refreshAddresses])

  const setDefaultAddress = useCallback(async (id) => {
    // Optimistic UI update first
    const previousAddresses = addresses
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: String(getAddressId(addr)) === String(id),
      }))
    )

    try {
      await userAPI.setDefaultAddress(id)
      await refreshAddresses()
    } catch (error) {
      debugError("Error setting default address:", error)
      setAddresses(previousAddresses)
      syncAddressesToStorage(previousAddresses)
      throw error
    }
  }, [addresses, refreshAddresses])

  const getDefaultAddress = useCallback(() => {
    return addresses.find((addr) => addr.isDefault) || addresses[0] || null
  }, [addresses])

  // Payment method functions - memoized with useCallback
  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => {
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        isDefault: prev.length === 0 ? true : false,
      }
      return [...prev, newPayment]
    })
  }, [])

  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm))
    )
  }, [])

  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id)
      const newPayments = prev.filter((pm) => pm.id !== id)
      
      // If deleting default, set first remaining as default
      if (paymentToDelete?.isDefault && newPayments.length > 0) {
        newPayments[0].isDefault = true
      }
      
      return newPayments
    })
  }, [])

  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    )
  }, [])

  const getDefaultPaymentMethod = useCallback(() => {
    return paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null
  }, [paymentMethods])

  const getAddressById = useCallback((id) => {
    return addresses.find((addr) => String(getAddressId(addr)) === String(id))
  }, [addresses])

  const getPaymentMethodById = useCallback((id) => {
    return paymentMethods.find((pm) => pm.id === id)
  }, [paymentMethods])

  // Favorites functions - memoized with useCallback
  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => {
      const exists = prev.find(fav => 
        (fav.slug && restaurant.slug && fav.slug === restaurant.slug) ||
        (fav.id && restaurant.id && fav.id === restaurant.id) ||
        (fav._id && restaurant._id && fav._id === restaurant._id) ||
        (fav.restaurantId && restaurant.restaurantId && fav.restaurantId === restaurant.restaurantId)
      )
      if (!exists) {
        return [...prev, restaurant]
      }
      return prev
    })
  }, [])

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter(fav => fav.slug !== slug && fav.id !== slug && fav._id !== slug))
  }, [])

  const isFavorite = useCallback((slug) => {
    return favorites.some(fav => fav.slug === slug || fav.id === slug || fav._id === slug)
  }, [favorites])

  const getFavorites = useCallback(() => {
    const unique = [];
    const seen = new Set();
    for (const fav of favorites) {
      const key = fav.slug || fav.id || fav._id || fav.restaurantId;
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(fav);
      } else if (!key) {
        unique.push(fav);
      }
    }
    return unique;
  }, [favorites])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => {
      const dishId = dish.id || dish._id;
      const exists = prev.find(fav => (fav.id === dishId || fav._id === dishId) && fav.restaurantId === dish.restaurantId)
      if (!exists) {
        return [...prev, { ...dish, id: dishId }]
      }
      return prev
    })
  }, [])

  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) => 
      prev.filter(fav => !((fav.id === dishId || fav._id === dishId) && fav.restaurantId === restaurantId))
    )
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantId) => {
    return dishFavorites.some(fav => (fav.id === dishId || fav._id === dishId) && fav.restaurantId === restaurantId)
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    const unique = [];
    const seen = new Set();
    for (const fav of dishFavorites) {
      const dishId = fav.id || fav._id;
      const key = `${dishId}-${fav.restaurantId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(fav);
      }
    }
    return unique;
  }, [dishFavorites])

  // User profile functions - memoized with useCallback
  const updateUserProfile = useCallback((updatedProfile) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }))
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      activeAddressId,
      setActiveAddressId,
      activeAddress,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    }),
    [
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      dishFavorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      activeAddressId,
      setActiveAddressId,
      activeAddress,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    ]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    // Return fallback values instead of throwing error
    // This prevents crashes when ProfileProvider is not available
    debugWarn("useProfile called outside ProfileProvider - using fallback values")
    return {
      userProfile: null,
      loading: false,
      updateUserProfile: () => debugWarn("ProfileProvider not available"),
      addresses: [],
      paymentMethods: [],
      favorites: [],
      addAddress: () => debugWarn("ProfileProvider not available"),
      updateAddress: () => debugWarn("ProfileProvider not available"),
      deleteAddress: () => debugWarn("ProfileProvider not available"),
      setDefaultAddress: () => debugWarn("ProfileProvider not available"),
      getDefaultAddress: () => null,
      getAddressById: () => null,
      activeAddressId: null,
      setActiveAddressId: () => debugWarn("ProfileProvider not available"),
      activeAddress: null,
      addPaymentMethod: () => debugWarn("ProfileProvider not available"),
      updatePaymentMethod: () => debugWarn("ProfileProvider not available"),
      deletePaymentMethod: () => debugWarn("ProfileProvider not available"),
      setDefaultPaymentMethod: () => debugWarn("ProfileProvider not available"),
      getDefaultPaymentMethod: () => null,
      getPaymentMethodById: () => null,
      addFavorite: () => debugWarn("ProfileProvider not available"),
      removeFavorite: () => debugWarn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      dishFavorites: [],
      addDishFavorite: () => debugWarn("ProfileProvider not available"),
      removeDishFavorite: () => debugWarn("ProfileProvider not available"),
      isDishFavorite: () => false,
      getDishFavorites: () => [],
      vegMode: false,
      setVegMode: () => debugWarn("ProfileProvider not available")
    }
  }
  return context
}



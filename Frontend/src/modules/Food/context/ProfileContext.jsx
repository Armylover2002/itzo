import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI } from "@food/api"
import { clearUserSession } from "@food/utils/auth"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const ProfileContext = createContext(null)
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters"]

export function ProfileProvider({ children }) {
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    const normalized = String(label || "").trim().toLowerCase()
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
  const getUserSessionToken = () => {
    let token = localStorage.getItem("user_accessToken") || localStorage.getItem("auth_customer");
    if (!token) {
      const generic = localStorage.getItem("accessToken");
      if (generic) {
        try {
          const payload = JSON.parse(window.atob(generic.split(".")[1]));
          if (payload?.role && payload.role.toUpperCase() !== "USER") return null;
        } catch (e) {}
        token = generic;
      }
    }
    return token;
  };
  const hasUserSession = Boolean(getUserSessionToken())

  const [userProfile, setUserProfile] = useState(() => {
    if (!hasUserSession) return null
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
  
  const [loading, setLoading] = useState(true)

  const [addresses, setAddresses] = useState([])

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

  // Food Wishlist state - fetched from backend
  const [foodWishlist, setFoodWishlist] = useState([])


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

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      // Check if user is authenticated
      const isAuthenticated = Boolean(getUserSessionToken())
      
      if (!isAuthenticated) {
        setUserProfile(null)
        setAddresses([])
        setPaymentMethods([])
        setFavorites([])
        setDishFavorites([])
        setFoodWishlist([])
        setVegMode(false)
        clearUserSession()
        USER_SESSION_PREFERENCE_KEYS.forEach((key) => {
          localStorage.removeItem(key)
        })
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Fetch user profile
        const response = await authAPI.getCurrentUser()
        const userData = response?.data?.data?.user || response?.data?.user || response?.data
        
        if (userData) {
          setUserProfile(userData)
          // Update localStorage
          localStorage.setItem("user_user", JSON.stringify(userData))
          localStorage.setItem("userProfile", JSON.stringify(userData))
          
          if (userData.role && userData.role !== 'USER') {
            return;
          }
        }

        // Fetch addresses
        try {
          const addressesResponse = await userAPI.getAddresses()
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
          const normalizedAddresses = dedupeAddressesByLabel(addressesData)
          setAddresses(normalizedAddresses)
          localStorage.setItem("userAddresses", JSON.stringify(normalizedAddresses))
        } catch (addressError) {
          debugError("Error fetching addresses:", addressError)
          // Try to load from localStorage as fallback
          const saved = localStorage.getItem("userAddresses")
          if (saved) {
            try {
              setAddresses(dedupeAddressesByLabel(JSON.parse(saved)))
            } catch (e) {
              debugError("Error parsing saved addresses:", e)
            }
          }
        }

        // Fetch food wishlist
        try {
          const wishlistResponse = await userAPI.getFoodWishlist();
          const wishlistData = wishlistResponse?.data?.data?.wishlist || [];
          setFoodWishlist(wishlistData);
        } catch (wishlistError) {
          debugError("Error fetching food wishlist:", wishlistError);
        }
      } catch (error) {
        // Silently handle error - use existing profile from localStorage
        debugError("Error fetching user profile:", error)
        // Try to load from localStorage as fallback
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            setAddresses(dedupeAddressesByLabel(JSON.parse(saved)))
          } catch (e) {
            debugError("Error parsing saved addresses:", e)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
    
    // Listen for auth changes
    const handleAuthChange = () => {
      fetchUserProfile()
    }
    
    window.addEventListener("userAuthChanged", handleAuthChange)
    
    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  const refreshAddresses = useCallback(async () => {
    userAPI.getAddresses.invalidateCache?.()
    const addressesResponse = await userAPI.getAddresses()
    const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
    const normalizedAddresses = dedupeAddressesByLabel(addressesData)
    setAddresses(normalizedAddresses)
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
      if (!prev.find(fav => fav.slug === restaurant.slug)) {
        return [...prev, restaurant]
      }
      return prev
    })
  }, [])

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter(fav => fav.slug !== slug))
  }, [])

  const isFavorite = useCallback((slug) => {
    return favorites.some(fav => fav.slug === slug)
  }, [favorites])

  const getFavorites = useCallback(() => {
    return favorites
  }, [favorites])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => {
      if (!prev.find(fav => fav.id === dish.id && fav.restaurantId === dish.restaurantId)) {
        return [...prev, dish]
      }
      return prev
    })
  }, [])

  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) => 
      prev.filter(fav => !(fav.id === dishId && fav.restaurantId === restaurantId))
    )
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantId) => {
    return dishFavorites.some(fav => fav.id === dishId && fav.restaurantId === restaurantId)
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    return dishFavorites
  }, [dishFavorites])

  // Food Wishlist functions - memoized with useCallback
  const toggleFoodWishlistItem = useCallback(async (dishData) => {
    try {
      const response = await userAPI.toggleFoodWishlist(dishData);
      const isAdded = response?.data?.data?.isAdded;
      const updatedWishlist = response?.data?.data?.wishlist || [];
      setFoodWishlist(updatedWishlist);
      return isAdded;
    } catch (error) {
      debugError("Error toggling food wishlist:", error);
      throw error;
    }
  }, []);

  const isFoodWishlisted = useCallback((restaurantId, dishName) => {
    return foodWishlist.some(fav => String(fav.restaurantId) === String(restaurantId) && fav.dishName === dishName);
  }, [foodWishlist]);

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
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      foodWishlist,
      toggleFoodWishlistItem,
      isFoodWishlisted,
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
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      foodWishlist,
      toggleFoodWishlistItem,
      isFoodWishlisted,
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
      foodWishlist: [],
      toggleFoodWishlistItem: () => debugWarn("ProfileProvider not available"),
      isFoodWishlisted: () => false,
      vegMode: false,
      setVegMode: () => debugWarn("ProfileProvider not available")
    }
  }
  return context
}



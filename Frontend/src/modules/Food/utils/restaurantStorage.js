// Utility for managing restaurant data across pages
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const STORAGE_KEY = "appzeto_restaurants"

// Get restaurants from localStorage
export const getRestaurants = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
    return []
  } catch (error) {
    debugError("Error loading restaurants:", error)
    return []
  }
}

// Save restaurants to localStorage
export const saveRestaurants = (restaurants) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restaurants))
    return true
  } catch (error) {
    debugError("Error saving restaurants:", error)
    return false
  }
}

// Add a new restaurant
export const addRestaurant = (restaurantData) => {
  const restaurants = getRestaurants()
  const newRestaurant = {
    id: restaurants.length > 0 ? Math.max(...restaurants.map(r => r.id)) + 1 : 1,
    name: restaurantData.restaurantName,
    ownerName: `${restaurantData.firstName} ${restaurantData.lastName}`,
    ownerPhone: `${restaurantData.phoneCode} ${restaurantData.phone}`,
    zone: restaurantData.zone,
    cuisine: restaurantData.cuisine,
    status: true,
    rating: 0,
    logo: restaurantData.logo ? URL.createObjectURL(restaurantData.logo) : null,
    ...restaurantData
  }
  const updatedRestaurants = [...restaurants, newRestaurant]
  saveRestaurants(updatedRestaurants)
  return newRestaurant
}

// Update a restaurant
export const updateRestaurant = (id, updates) => {
  const restaurants = getRestaurants()
  const updatedRestaurants = restaurants.map(r => 
    r.id === id ? { ...r, ...updates } : r
  )
  saveRestaurants(updatedRestaurants)
  return updatedRestaurants.find(r => r.id === id)
}

// Delete a restaurant
export const deleteRestaurant = (id) => {
  const restaurants = getRestaurants()
  const updatedRestaurants = restaurants.filter(r => r.id !== id)
  saveRestaurants(updatedRestaurants)
  return true
}



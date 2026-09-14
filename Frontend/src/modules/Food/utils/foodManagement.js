const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Food Management Utility Functions
 * Centralized management for restaurant foods across the restaurant module
 */

import { usdToInr } from './currency'

// Default foods data (matching existing hardcoded data)
const DEFAULT_FOODS = [
  {
    id: 1,
    name: "Medu Vada",
    nameArabic: "ميدو فادا",
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop",
    category: "Varieties",
    rating: 0.0,
    reviews: 0,
    price: 95.00,
    stock: 100,
    discount: null,
    originalPrice: null,
    foodType: "Non-Veg",
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "Fada list consists of crispy, thin, soft and delicious lentil pancakes from South Indian cuisine.",
    discountType: "Percent",
    discountAmount: 0.0,
    isAvailable: true,
    isRecommended: false,
    variations: [
      { id: 1, name: "Capacity - 1 Person", price: 0.00, stock: 10 },
      { id: 2, name: "Capacity - 2 Person", price: 70.00, stock: 30 },
      { id: 3, name: "Capacity - 4 Person", price: 130.00, stock: 30 }
    ],
    tags: ["breakfast"],
    nutrition: ["Calories", "Protein"],
    allergies: ["Dairy"]
  },
  {
    id: 2,
    name: "grilled lemon herb Mediterranea...",
    nameArabic: "",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop",
    category: "Varieties",
    rating: 0.0,
    reviews: 0,
    price: 320.00,
    stock: "Unlimited",
    discount: null,
    originalPrice: null,
    foodType: "Non-Veg",
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "",
    discountType: "Percent",
    discountAmount: 0.0,
    isAvailable: true,
    isRecommended: false,
    variations: [],
    tags: [],
    nutrition: [],
    allergies: []
  },
  {
    id: 3,
    name: "Meat Pizza",
    nameArabic: "",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    category: "Varieties",
    rating: 4.7,
    reviews: 3,
    price: 350.00,
    stock: 50,
    discount: 30.0,
    originalPrice: 500.00,
    foodType: "Non-Veg",
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "Delicious meat pizza with fresh ingredients",
    discountType: "Percent",
    discountAmount: 30.0,
    isAvailable: true,
    isRecommended: true,
    variations: [],
    tags: ["pizza", "meat"],
    nutrition: ["Calories", "Protein", "Carbs"],
    allergies: []
  },
  {
    id: 4,
    name: "Cheese Pizza",
    nameArabic: "",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    category: "Italian",
    rating: 0.0,
    reviews: 0,
    price: usdToInr(232.50),
    originalPrice: usdToInr(250.00),
    discount: "7.0% OFF",
    stock: "Unlimited",
    foodType: "Non-Veg",
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "Classic cheese pizza",
    discountType: "Percent",
    discountAmount: 7.0,
    isAvailable: true,
    isRecommended: false,
    variations: [],
    tags: ["pizza", "cheese"],
    nutrition: [],
    allergies: ["Dairy"]
  },
  {
    id: 5,
    name: "Thai Fried Rice",
    nameArabic: "",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
    category: "Varieties",
    rating: 0.0,
    reviews: 0,
    price: usdToInr(160.00),
    originalPrice: null,
    discount: null,
    stock: "Unlimited",
    foodType: "Non-Veg",
    availabilityTimeStart: "12:01 AM",
    availabilityTimeEnd: "11:57 PM",
    description: "Authentic Thai fried rice",
    discountType: "Percent",
    discountAmount: 0.0,
    isAvailable: true,
    isRecommended: false,
    variations: [],
    tags: ["rice", "thai"],
    nutrition: [],
    allergies: []
  }
]

const FOODS_STORAGE_KEY = 'restaurant_foods'
const FOOD_ID_COUNTER_KEY = 'restaurant_food_id_counter'

/**
 * Get all foods (Legacy function, no longer uses localStorage)
 * @returns {Array} - Empty array, use backend API instead
 */
export const getAllFoods = () => {
  return []
}

/**
 * Save all foods (Legacy function, no-op)
 * @param {Array} foods - Array of food objects
 */
const setAllFoods = (foods) => {
  // No-op
}

/**
 * Get food by ID
 * @param {string|number} id - The food ID
 * @returns {Object|null} - Null, handled by backend
 */
export const getFoodById = (id) => {
  return null
}

/**
 * Get next food ID
 * @returns {number} - 0
 */
const getNextFoodId = () => {
  return 0
}

/**
 * Save or update a food
 * @param {Object} foodData - Food object to save
 * @returns {Object} - null
 */
export const saveFood = (foodData) => {
  return null
}

/**
 * Delete a food by ID
 * @param {string|number} id - The food ID to delete
 * @returns {boolean} - false
 */
export const deleteFood = (id) => {
  return false
}

/**
 * Update food stock
 * @param {string|number} id - The food ID
 * @param {number|string} stock - New stock value
 * @returns {boolean} - false
 */
export const updateFoodStock = (id, stock) => {
  return false
}



// src/context/cart-context.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { buildCartLineId } from "@food/utils/foodVariants"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    debugWarn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    debugWarn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    debugWarn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    debugWarn('CartProvider not available - clearCart called');
  },
  cleanCartForRestaurant: () => {
    debugWarn('CartProvider not available - cleanCartForRestaurant called');
  },
  replaceCart: () => {
    debugWarn('CartProvider not available - replaceCart called');
  },
}

const CartContext = createContext(defaultCartContext)

const getItemOrderType = (item) => (item?.orderType === "quick" ? "quick" : "food")
const getItemSourceId = (item, orderType) =>
  String(
    item?.sourceId ||
      (orderType === "quick"
        ? item?.quickStoreId || item?.storeId || item?.sellerId || item?.restaurantId || ""
        : item?.restaurantId || item?.sourceRestaurantId || ""),
  )

const normalizeCartData = (rawCart) => {
  if (!Array.isArray(rawCart)) return []

  return rawCart
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const parsedQuantity = Number(item.quantity)
      const parsedPrice = Number(item.price)
      const normalizedRestaurantName =
        typeof item.restaurant === "string"
          ? item.restaurant
          : typeof item.restaurant?.name === "string"
            ? item.restaurant.name
            : ""

      const normalizedRestaurantId =
        item.restaurantId ||
        item.restaurant_id ||
        item.restaurant?._id ||
        item.restaurant?.restaurantId ||
        null

      const normalizedImage =
        item.image ||
        item.imageUrl ||
        item.product?.imageUrl ||
        item.product?.image ||
        ""

      const baseItemId =
        item.itemId ||
        item.productId ||
        item.foodId ||
        item.baseItemId ||
        item.menuItemId ||
        item.id ||
        item._id ||
        `cart-item-${index}`

      const variantId = item.variantId || item.variant?._id || item.variant?.id || ""
      const variantName =
        typeof item.variantName === "string"
          ? item.variantName
          : typeof item.variant?.name === "string"
            ? item.variant.name
            : ""
      const parsedVariantPrice = Number(
        item.variantPrice ?? item.variant?.price ?? item.price,
      )
      const orderType = item.orderType === "quick" ? "quick" : "food"
      const sourceId = getItemSourceId(item, orderType)
      const lineItemId =
        item.lineItemId ||
        item.cartLineId ||
        buildCartLineId(baseItemId, variantId)

      return {
        ...item,
        id: lineItemId,
        lineItemId,
        itemId: String(baseItemId),
        productId: String(baseItemId),
        variantId: variantId ? String(variantId) : "",
        variantName,
        variantPrice: Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0,
        name: item.name || item.product?.name || "Item",
        orderType,
        type: orderType,
        sourceId,
        sourceName:
          item.sourceName ||
          (orderType === "quick"
            ? item.quickStoreName || item.storeName || item.sellerName || "Quick Commerce"
            : normalizedRestaurantName),
        quantity:
          Number.isFinite(parsedQuantity) && parsedQuantity > 0
            ? Math.floor(parsedQuantity)
            : 1,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        otherPrice: Number(item.otherPrice) || 0,
        restaurant: normalizedRestaurantName,
        restaurantId: normalizedRestaurantId,
        image: normalizedImage,
        imageUrl: normalizedImage,
      }
    })
}

const resolveCartEntryId = (items, itemId, variantId = "") => {
  const normalizedItemId = String(itemId || "")
  const safeItems = Array.isArray(items) ? items : []

  const directMatch = safeItems.find((item) => item.id === normalizedItemId)
  if (directMatch) return directMatch.id

  const preferredId = buildCartLineId(normalizedItemId, variantId)

  const exactMatch = safeItems.find((item) => item.id === preferredId)
  if (exactMatch) return exactMatch.id

  if (!variantId) {
    const legacyBaseMatch = safeItems.find(
      (item) =>
        String(item.itemId || item.productId || item.id || "") === normalizedItemId &&
        !String(item.variantId || "").trim(),
    )
    if (legacyBaseMatch) return legacyBaseMatch.id
  }

  return preferredId
}

export function CartProvider({ children }) {
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("cart")
      const parsed = saved ? JSON.parse(saved) : []
      return normalizeCartData(parsed)
    } catch {
      return []
    }
  })

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      // Only save if we have items or user is authenticated to avoid cluttering localStorage for every guest visitor
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken");
      if (cart.length > 0) {
        localStorage.setItem("cart", JSON.stringify(normalizeCartData(cart)))
      } else {
        localStorage.removeItem("cart")
      }
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart])

  const addToCart = (item, sourcePosition = null) => {
    if (getItemOrderType(item) === "quick") {
      debugError('❌ Cannot add quick commerce item to food cart!');
      return { ok: false, error: 'Cannot add quick commerce items to food cart.', code: 'INVALID_ORDER_TYPE' };
    }

    const safeCart = normalizeCartData(cart)
    if (safeCart.length > 0) {
      const currentOrderType = getItemOrderType(safeCart[0])
      const nextOrderType = getItemOrderType(item)

      if (currentOrderType === "food" && nextOrderType === "food") {
        const firstItemRestaurantId = safeCart[0]?.restaurantId
        const firstItemRestaurantName = safeCart[0]?.restaurant
        const newItemRestaurantId = item?.restaurantId
        const newItemRestaurantName = item?.restaurant
        const normalizeName = (name) => (name ? String(name).trim().toLowerCase() : '')

        const firstRestaurantNameNormalized = normalizeName(firstItemRestaurantName)
        const newRestaurantNameNormalized = normalizeName(newItemRestaurantName)
        const hasNameMismatch =
          firstRestaurantNameNormalized &&
          newRestaurantNameNormalized &&
          firstRestaurantNameNormalized !== newRestaurantNameNormalized

        const hasIdMismatch =
          !firstRestaurantNameNormalized &&
          !newRestaurantNameNormalized &&
          firstItemRestaurantId &&
          newItemRestaurantId &&
          String(firstItemRestaurantId) !== String(newItemRestaurantId)

        if (hasNameMismatch || hasIdMismatch) {
          const message = `Cart already contains items from "${firstItemRestaurantName || 'another restaurant'}". Please clear cart or complete order first.`
          return { ok: false, error: message, code: 'RESTAURANT_MISMATCH' }
        }
      }
    }

    if (!item?.restaurantId && !item?.restaurant) {
      return {
        ok: false,
        error: 'Item is missing restaurant information. Please refresh the page.',
        code: 'MISSING_RESTAURANT'
      }
    }

    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existingOrderType = getItemOrderType(safePrev[0])
      const incomingOrderType = getItemOrderType(item)

      // CRITICAL: Validate restaurant consistency
      // If cart already has items, ensure new item belongs to the same restaurant
      if (safePrev.length > 0) {
        const firstItemRestaurantId = safePrev[0]?.restaurantId;
        const firstItemRestaurantName = safePrev[0]?.restaurant;
        const newItemRestaurantId = item?.restaurantId;
        const newItemRestaurantName = item?.restaurant;
        
        // Normalize restaurant names for comparison (trim and case-insensitive)
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstItemRestaurantName);
        const newRestaurantNameNormalized = normalizeName(newItemRestaurantName);
        
        // Check restaurant name first (more reliable than IDs which can have different formats)
        // If names match, allow it even if IDs differ (same restaurant, different ID format)
        if (firstRestaurantNameNormalized && newRestaurantNameNormalized) {
          if (firstRestaurantNameNormalized !== newRestaurantNameNormalized) {
            debugError('❌ Cannot add item: Restaurant name mismatch!', {
              cartRestaurantId: firstItemRestaurantId,
              cartRestaurantName: firstItemRestaurantName,
              newItemRestaurantId: newItemRestaurantId,
              newItemRestaurantName: newItemRestaurantName
            });
            return safePrev;
          }
          // Names match - allow it (even if IDs differ, it's the same restaurant)
        } else if (firstItemRestaurantId && newItemRestaurantId) {
          // If names are not available, fallback to ID comparison
          if (firstItemRestaurantId !== newItemRestaurantId) {
            debugError('❌ Cannot add item: Cart contains items from different restaurant!', {
              cartRestaurantId: firstItemRestaurantId,
              cartRestaurantName: firstItemRestaurantName,
              newItemRestaurantId: newItemRestaurantId,
              newItemRestaurantName: newItemRestaurantName
            });
            return safePrev;
          }
        }
      }
      
      const existing = safePrev.find((i) => i.id === item.id)
      if (existing) {
        // Set last add event for animation when incrementing existing item
        if (sourcePosition) {
          setLastAddEvent({
            product: {
              id: item.id,
              name: item.name,
              imageUrl: item.image || item.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes (increased delay)
          setTimeout(() => setLastAddEvent(null), 1500)
        }
        return safePrev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      
      // Validate item has required restaurant info
      if (!item.restaurantId && !item.restaurant) {
        debugError('❌ Cannot add item: Missing restaurant information!', item);
        return safePrev;
      }
      
      const newItem = { ...item, quantity: 1 }
      
      // Set last add event for animation if sourcePosition is provided
      if (sourcePosition) {
        setLastAddEvent({
          product: {
            id: item.id,
            name: item.name,
            imageUrl: item.image || item.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes (increased delay to allow full animation)
        setTimeout(() => setLastAddEvent(null), 1500)
      }
      
      return [...safePrev, newItem]
    })

    return { ok: true }
  }

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const resolvedItemId = resolveCartEntryId(safePrev, itemId)
      const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
      if (itemToRemove && sourcePosition && productInfo) {
        // Set last remove event for animation
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemToRemove.id,
            name: productInfo.name || itemToRemove.name,
            imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.filter((i) => i.id !== resolvedItemId)
    })
  }

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null) => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId)
    if (quantity <= 0) {
      setCart((prev) => {
        const safePrev = normalizeCartData(prev)
        const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
        if (itemToRemove && sourcePosition && productInfo) {
          // Set last remove event for animation
          setLastRemoveEvent({
            product: {
              id: productInfo.id || itemToRemove.id,
              name: productInfo.name || itemToRemove.name,
              imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes
          setTimeout(() => setLastRemoveEvent(null), 1500)
        }
        return safePrev.filter((i) => i.id !== resolvedItemId)
      })
      return
    }
    
    // When quantity decreases (but not to 0), also trigger removal animation
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existingItem = safePrev.find((i) => i.id === resolvedItemId)
      if (existingItem && quantity < existingItem.quantity && sourcePosition && productInfo) {
        // Set last remove event for animation when decreasing quantity
        setLastRemoveEvent({
          product: {
            id: productInfo.id || existingItem.id,
            name: productInfo.name || existingItem.name,
            imageUrl: productInfo.imageUrl || productInfo.image || existingItem.image || existingItem.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.map((i) => (i.id === resolvedItemId ? { ...i, quantity } : i))
    })
  }

  const getCartCount = () =>
    normalizeCartData(cart).reduce((total, item) => total + (item.quantity || 0), 0)

  const isInCart = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId, variantId)
    return safeCart.some((i) => i.id === resolvedItemId)
  }

  const getCartItem = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId, variantId)
    return safeCart.find((i) => i.id === resolvedItemId) || null
  }

  const clearCart = () => setCart([])

  const replaceCart = (items) => {
    const normalizedItems = normalizeCartData(items).filter((item) => {
      const quantity = Number(item?.quantity)
      return item?.id && (item?.restaurantId || item?.restaurant) && Number.isFinite(quantity) && quantity > 0 && getItemOrderType(item) !== "quick"
    })

    setCart(normalizedItems)
    return { ok: true, count: normalizedItems.length }
  }

  // Clean cart to remove items from different restaurants
  // Keeps only items from the specified restaurant
  const cleanCartForRestaurant = (restaurantId, restaurantName) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      if (safePrev.length === 0) return safePrev;
      
      // Normalize restaurant name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetRestaurantNameNormalized = normalizeName(restaurantName);
      
      // Filter cart to keep only items from the target restaurant
      const cleanedCart = safePrev.filter((item) => {
        const itemRestaurantId = item?.restaurantId;
        const itemRestaurantName = item?.restaurant;
        const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
        
        // Check by restaurant name first (more reliable)
        if (targetRestaurantNameNormalized && itemRestaurantNameNormalized) {
          return itemRestaurantNameNormalized === targetRestaurantNameNormalized;
        }
        // Fallback to ID comparison
        if (restaurantId && itemRestaurantId) {
          return itemRestaurantId === restaurantId || 
                 itemRestaurantId === restaurantId.toString() ||
                 itemRestaurantId.toString() === restaurantId;
        }
        // If no match, remove item
        return false;
      });
      
      if (cleanedCart.length !== safePrev.length) {
        debugWarn('🧹 Cleaned cart: Removed items from different restaurants', {
          before: safePrev.length,
          after: cleanedCart.length,
          removed: safePrev.length - cleanedCart.length
        });
      }
      
      return cleanedCart;
    });
  }

  // Validate and clean cart on mount/load to prevent multiple restaurant items
  // This runs only once on initial load to clean up any corrupted cart data from localStorage
  useEffect(() => {
    let safeCart = normalizeCartData(cart)
    
    // Completely separate quick commerce items from food cart
    const hasQuickItems = safeCart.some(item => getItemOrderType(item) === "quick");
    if (hasQuickItems) {
      debugWarn('🧹 Cleaning cart: Removing quick commerce items from food cart');
      safeCart = safeCart.filter(item => getItemOrderType(item) !== "quick");
      setCart(safeCart);
      if (safeCart.length === 0) return;
    }

    if (safeCart.length !== cart.length && !hasQuickItems) {
      setCart(safeCart)
      return
    }
    if (safeCart.length === 0) return;

    const restaurantIds = safeCart.map(item => item.restaurantId).filter(Boolean);
    const restaurantNames = safeCart.map(item => item.restaurant).filter(Boolean);
    const uniqueRestaurantIds = [...new Set(restaurantIds)];
    const uniqueRestaurantNames = [...new Set(restaurantNames)];
    
    // Normalize restaurant names for comparison
    const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
    const uniqueRestaurantNamesNormalized = uniqueRestaurantNames.map(normalizeName);
    const uniqueRestaurantNamesSet = new Set(uniqueRestaurantNamesNormalized);
    
    // Check if cart has items from multiple restaurants
    if (uniqueRestaurantIds.length > 1 || uniqueRestaurantNamesSet.size > 1) {
      debugWarn('⚠️ Cart contains items from multiple restaurants. Cleaning cart...', {
        restaurantIds: uniqueRestaurantIds,
        restaurantNames: uniqueRestaurantNames
      });
      
      // Keep items from the first restaurant (most recent or first in cart)
      const firstRestaurantId = uniqueRestaurantIds[0];
      const firstRestaurantName = uniqueRestaurantNames[0];
      
      setCart((prev) => {
        const safePrev = normalizeCartData(prev)
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstRestaurantName);
        
        return safePrev.filter((item) => {
          const itemRestaurantId = item?.restaurantId;
          const itemRestaurantName = item?.restaurant;
          const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
          
          // Check by restaurant name first
          if (firstRestaurantNameNormalized && itemRestaurantNameNormalized) {
            return itemRestaurantNameNormalized === firstRestaurantNameNormalized;
          }
          // Fallback to ID comparison
          if (firstRestaurantId && itemRestaurantId) {
            return itemRestaurantId === firstRestaurantId || 
                   itemRestaurantId === firstRestaurantId.toString() ||
                   itemRestaurantId.toString() === firstRestaurantId;
          }
          return false;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to clean up localStorage data

  // Transform cart to match AddToCartAnimation expected structure
  const cartForAnimation = useMemo(() => {
    const safeCart = normalizeCartData(cart)
    const items = safeCart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))
    
    const itemCount = safeCart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = safeCart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
    
    return {
      items,
      itemCount,
      total,
    }
  }, [cart])

  const value = useMemo(
    () => ({
      _isProvider: true, // Flag to identify this is from the actual provider
      // Keep original cart array for backward compatibility
      cart,
      // Add animation-compatible structure
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
      replaceCart,
    }),
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      debugWarn('⚠️ useCart called outside CartProvider. Using default values.');
      debugWarn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}

